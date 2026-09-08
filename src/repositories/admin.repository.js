import { cachedRead, invalidateReadCache } from '../core/read-cache.js';
import { getFirebaseServices } from '../services/firebase.service.js';

const USERS_LIMIT = 100;
const USERS_TTL_MS = 60_000;
const AUDIT_TTL_MS = 30_000;

export async function listUsers({ force = false } = {}) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const uid = auth.currentUser?.uid || 'anonymous';
  return cachedRead(`users:list:${uid}`, async () => {
    const q = firestoreSdk.query(
      firestoreSdk.collection(db, 'users'),
      firestoreSdk.orderBy('name'),
      firestoreSdk.limit(USERS_LIMIT)
    );
    const snap = await firestoreSdk.getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, { ttlMs: USERS_TTL_MS, force });
}

export async function listAuditLogs(limit = 100, { force = false } = {}) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const uid = auth.currentUser?.uid || 'anonymous';
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  return cachedRead(`audit:list:${uid}:${safeLimit}`, async () => {
    const q = firestoreSdk.query(
      firestoreSdk.collection(db, 'auditLogs'),
      firestoreSdk.orderBy('createdAt', 'desc'),
      firestoreSdk.limit(safeLimit)
    );
    const snap = await firestoreSdk.getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, { ttlMs: AUDIT_TTL_MS, force });
}

export async function getUserPermissions(userId) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const q = firestoreSdk.query(
    firestoreSdk.collection(db, 'permissions'),
    firestoreSdk.where('userId', '==', userId)
  );
  const snap = await firestoreSdk.getDocs(q);
  return Object.fromEntries(snap.docs.map((doc) => {
    const data = doc.data();
    return [data.module, String(data.level || 'NONE').toUpperCase()];
  }));
}

function actorData(actor = {}) {
  return {
    actorUserId: actor.uid || actor.id,
    actorUserEmail: actor.email || null,
    actorUserName: actor.name || null
  };
}

function writePermissions(batch, db, firestoreSdk, userId, levels, actorUserId) {
  for (const [moduleName, rawLevel] of Object.entries(levels || {})) {
    const level = String(rawLevel || 'NONE').toUpperCase();
    const ref = firestoreSdk.doc(db, 'permissions', `${userId}__${moduleName}`);
    if (level === 'NONE') {
      batch.delete(ref);
    } else {
      batch.set(ref, {
        userId,
        module: moduleName,
        level,
        updatedAt: firestoreSdk.serverTimestamp(),
        updatedBy: actorUserId
      });
    }
  }
}

function invalidateAdminReads(userId = '') {
  invalidateReadCache('users:list', 'audit:list', 'tasks:refs');
  if (userId) invalidateReadCache(`session:${userId}:profile`, `session:${userId}:permissions`, `profile:${userId}`);
}

export async function createManagedUserRecords({ uid, name, email, role, profileType, permissionLevels, actor }) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const actorUserId = actor?.uid || actor?.id;
  if (!actorUserId) throw new Error('Ator administrativo não identificado.');

  const batch = firestoreSdk.writeBatch(db);
  const now = firestoreSdk.serverTimestamp();
  const profile = {
    uid,
    name,
    email,
    role,
    profileType,
    active: true,
    createdAt: now,
    createdBy: actorUserId,
    updatedAt: now,
    updatedBy: actorUserId,
    lastAccessAt: null
  };

  batch.set(firestoreSdk.doc(db, 'users', uid), profile);
  writePermissions(batch, db, firestoreSdk, uid, permissionLevels, actorUserId);
  batch.set(firestoreSdk.doc(firestoreSdk.collection(db, 'auditLogs')), {
    ...actorData(actor),
    action: 'USER_CREATED',
    entityType: 'USER',
    entityId: uid,
    createdAt: firestoreSdk.serverTimestamp(),
    details: { profileType, role }
  });
  await batch.commit();
  invalidateAdminReads(uid);
  return { uid, ...profile };
}

export async function updateManagedUserRecords(userId, { name, active, role, profileType, permissionLevels, actor }) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const actorUserId = actor?.uid || actor?.id;
  if (!actorUserId) throw new Error('Ator administrativo não identificado.');

  const userRef = firestoreSdk.doc(db, 'users', userId);
  const beforeSnap = await firestoreSdk.getDoc(userRef);
  if (!beforeSnap.exists()) throw new Error('Usuário não encontrado.');
  const before = beforeSnap.data();
  const patch = {
    name,
    active: Boolean(active),
    role,
    profileType,
    updatedAt: firestoreSdk.serverTimestamp(),
    updatedBy: actorUserId
  };

  const batch = firestoreSdk.writeBatch(db);
  batch.update(userRef, patch);
  writePermissions(batch, db, firestoreSdk, userId, permissionLevels, actorUserId);
  batch.set(firestoreSdk.doc(firestoreSdk.collection(db, 'auditLogs')), {
    ...actorData(actor),
    action: 'USER_UPDATED',
    entityType: 'USER',
    entityId: userId,
    createdAt: firestoreSdk.serverTimestamp(),
    before: { name: before.name || null, active: before.active === true, role: before.role || null, profileType: before.profileType || null },
    after: { name, active: Boolean(active), role, profileType }
  });
  await batch.commit();
  invalidateAdminReads(userId);
  return { ok: true };
}

export async function setManagedUserActiveRecord(userId, active, actor) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const actorUserId = actor?.uid || actor?.id;
  if (!actorUserId) throw new Error('Ator administrativo não identificado.');
  const userRef = firestoreSdk.doc(db, 'users', userId);
  const snap = await firestoreSdk.getDoc(userRef);
  if (!snap.exists()) throw new Error('Usuário não encontrado.');
  const before = snap.data();

  const batch = firestoreSdk.writeBatch(db);
  batch.update(userRef, {
    active: Boolean(active),
    updatedAt: firestoreSdk.serverTimestamp(),
    updatedBy: actorUserId
  });
  batch.set(firestoreSdk.doc(firestoreSdk.collection(db, 'auditLogs')), {
    ...actorData(actor),
    action: active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'USER',
    entityId: userId,
    createdAt: firestoreSdk.serverTimestamp(),
    before: { active: before.active === true },
    after: { active: Boolean(active) }
  });
  await batch.commit();
  invalidateAdminReads(userId);
  return { ok: true };
}
