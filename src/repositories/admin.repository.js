import { getFirebaseServices } from '../services/firebase.service.js';

export async function listUsers() {
  const { db, firestoreSdk } = await getFirebaseServices();
  const q = firestoreSdk.query(firestoreSdk.collection(db, 'users'), firestoreSdk.orderBy('name'));
  const snap = await firestoreSdk.getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function listAuditLogs(limit = 100) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const q = firestoreSdk.query(
    firestoreSdk.collection(db, 'auditLogs'),
    firestoreSdk.orderBy('createdAt', 'desc'),
    firestoreSdk.limit(limit)
  );
  const snap = await firestoreSdk.getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  return { ok: true };
}
