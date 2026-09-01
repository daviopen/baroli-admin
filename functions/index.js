const { randomBytes } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();
const auth = getAuth();
const REGION = 'southamerica-east1';
const ROLES = new Set(['USER', 'ADMIN', 'SUPER_ADMIN']);
const ACTIONS = new Set(['READ', 'CREATE', 'UPDATE', 'DELETE']);
const LEVELS = new Set(['NONE', 'READ', 'EDIT']);
const MODULE_PATTERN = /^[a-z][a-z0-9_-]{1,48}$/;
const DEFAULT_USER_PERMISSIONS = Object.freeze({ dashboard: 'READ' });

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function getCaller(request, { active = true } = {}) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Autenticação obrigatória.');
  const ref = db.collection('users').doc(request.auth.uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'Usuário não cadastrado.');
  const profile = snap.data();
  if (active && profile.active !== true) throw new HttpsError('permission-denied', 'Usuário inativo.');
  return { uid: request.auth.uid, ...profile };
}

function isSuperAdmin(caller) {
  return caller.active === true && caller.role === 'SUPER_ADMIN';
}

function requireSuperAdmin(caller) {
  if (!isSuperAdmin(caller)) throw new HttpsError('permission-denied', 'Ação exclusiva de SUPER_ADMIN.');
}

function levelAllowsAction(level, actionName) {
  if (!ACTIONS.has(actionName)) return false;
  const normalized = String(level || 'NONE').toUpperCase();
  if (normalized === 'EDIT') return true;
  return normalized === 'READ' && actionName === 'READ';
}

async function callerHasPermission(caller, moduleName, actionName) {
  if (isSuperAdmin(caller)) return true;
  const snap = await db.collection('permissions').doc(`${caller.uid}__${moduleName}`).get();
  if (!snap.exists) return false;
  const permission = snap.data();
  return permission.userId === caller.uid &&
    permission.module === moduleName &&
    levelAllowsAction(permission.level, actionName);
}

async function requirePermission(caller, moduleName, actionName) {
  if (!(await callerHasPermission(caller, moduleName, actionName))) {
    throw new HttpsError('permission-denied', `Permissão ${moduleName}:${actionName} obrigatória.`);
  }
}

function normalizePermissionsPayload(permissions, { optional = false } = {}) {
  if (permissions == null && optional) return null;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new HttpsError('invalid-argument', 'Permissões inválidas.');
  }

  const normalized = {};
  for (const [moduleName, rawLevel] of Object.entries(permissions)) {
    if (!MODULE_PATTERN.test(moduleName)) throw new HttpsError('invalid-argument', `Módulo inválido: ${moduleName}`);
    const level = String(rawLevel || 'NONE').toUpperCase();
    if (!LEVELS.has(level)) throw new HttpsError('invalid-argument', `Nível inválido em ${moduleName}.`);
    normalized[moduleName] = level;
  }
  return normalized;
}

function applyPermissionsToBatch(batch, userId, permissions, actorUserId) {
  if (!permissions) return;
  for (const [moduleName, level] of Object.entries(permissions)) {
    const permissionRef = db.collection('permissions').doc(`${userId}__${moduleName}`);
    if (level === 'NONE') {
      batch.delete(permissionRef);
    } else {
      batch.set(permissionRef, {
        userId,
        module: moduleName,
        level,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUserId
      });
    }
  }
}

function auditData(caller, action, entityType, entityId, extra = {}) {
  return {
    actorUserId: caller.uid,
    actorUserEmail: caller.email ?? null,
    actorUserName: caller.name ?? null,
    action,
    entityType,
    entityId,
    createdAt: FieldValue.serverTimestamp(),
    ...extra
  };
}

async function assertCanDemoteOrDeactivate(targetUserId, before, after) {
  const losingSuperAdmin = before.role === 'SUPER_ADMIN' && before.active === true &&
    (after.role !== 'SUPER_ADMIN' || after.active !== true);
  if (!losingSuperAdmin) return;

  const snapshot = await db.collection('users')
    .where('role', '==', 'SUPER_ADMIN')
    .where('active', '==', true)
    .limit(2)
    .get();

  const otherActiveSuperAdmin = snapshot.docs.some((doc) => doc.id !== targetUserId);
  if (!otherActiveSuperAdmin) {
    throw new HttpsError('failed-precondition', 'Não é permitido remover o último SUPER_ADMIN ativo.');
  }
}

exports.recordSessionLogin = onCall({ region: REGION }, async (request) => {
  const caller = await getCaller(request);
  const batch = db.batch();
  batch.update(db.collection('users').doc(caller.uid), {
    lastAccessAt: FieldValue.serverTimestamp()
  });
  batch.set(db.collection('auditLogs').doc(), auditData(caller, 'LOGIN', 'SESSION', caller.uid));
  await batch.commit();
  return { ok: true };
});

exports.recordSessionLogout = onCall({ region: REGION }, async (request) => {
  const caller = await getCaller(request, { active: false });
  await db.collection('auditLogs').add(auditData(caller, 'LOGOUT', 'SESSION', caller.uid));
  return { ok: true };
});

exports.adminCreateUser = onCall({ region: REGION }, async (request) => {
  const caller = await getCaller(request);
  await requirePermission(caller, 'users', 'CREATE');

  const name = cleanString(request.data?.name, 160);
  const email = cleanString(request.data?.email, 320).toLowerCase();
  const role = 'USER';
  const permissionInput = request.data?.permissions;
  if (!name || !email || !email.includes('@')) throw new HttpsError('invalid-argument', 'Nome e e-mail são obrigatórios.');

  let permissions = { ...DEFAULT_USER_PERMISSIONS };
  if (permissionInput != null) {
    requireSuperAdmin(caller);
    permissions = normalizePermissionsPayload(permissionInput);
  }

  let authUser;
  try {
    const temporaryPassword = `${randomBytes(24).toString('base64url')}aA1!`;
    authUser = await auth.createUser({ email, password: temporaryPassword, displayName: name, disabled: false });
    const now = FieldValue.serverTimestamp();
    const profile = {
      uid: authUser.uid,
      name,
      email,
      role,
      active: true,
      createdAt: now,
      createdBy: caller.uid,
      updatedAt: now,
      updatedBy: caller.uid,
      lastAccessAt: null
    };
    const batch = db.batch();
    batch.create(db.collection('users').doc(authUser.uid), profile);
    applyPermissionsToBatch(batch, authUser.uid, permissions, caller.uid);
    batch.set(db.collection('auditLogs').doc(), auditData(caller, 'USER_CREATED', 'USER', authUser.uid, {
      after: profile,
      initialPermissions: permissions
    }));
    batch.set(db.collection('auditLogs').doc(), auditData(caller, 'PERMISSIONS_UPDATED', 'PERMISSIONS', authUser.uid, {
      after: permissions,
      source: 'USER_CREATED'
    }));
    await batch.commit();
    return { uid: authUser.uid };
  } catch (error) {
    if (authUser?.uid) await auth.deleteUser(authUser.uid).catch(() => undefined);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Não foi possível criar o usuário.');
  }
});

exports.adminUpdateUser = onCall({ region: REGION }, async (request) => {
  const caller = await getCaller(request);
  await requirePermission(caller, 'users', 'UPDATE');
  const userId = cleanString(request.data?.userId, 128);
  if (!userId) throw new HttpsError('invalid-argument', 'userId obrigatório.');

  const permissionInput = request.data?.permissions;
  let permissions = null;
  if (permissionInput != null) {
    requireSuperAdmin(caller);
    permissions = normalizePermissionsPayload(permissionInput);
  }

  const ref = db.collection('users').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');
  const before = snap.data();
  const after = { ...before };
  if (typeof request.data?.name === 'string') after.name = cleanString(request.data.name, 160);
  if (typeof request.data?.active === 'boolean') after.active = request.data.active;
  if (typeof request.data?.role === 'string') {
    if (!ROLES.has(request.data.role)) throw new HttpsError('invalid-argument', 'Perfil inválido.');
    if (request.data.role !== before.role) requireSuperAdmin(caller);
    after.role = request.data.role;
  }
  if (!after.name) throw new HttpsError('invalid-argument', 'Nome obrigatório.');

  if (before.role === 'SUPER_ADMIN' && before.active !== after.active) requireSuperAdmin(caller);
  await assertCanDemoteOrDeactivate(userId, before, after);

  const oldAuthState = await auth.getUser(userId);
  await auth.updateUser(userId, { displayName: after.name, disabled: !after.active });

  const patch = {
    name: after.name,
    role: after.role,
    active: after.active,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid
  };
  try {
    const batch = db.batch();
    batch.update(ref, patch);
    applyPermissionsToBatch(batch, userId, permissions, caller.uid);
    batch.set(db.collection('auditLogs').doc(), auditData(caller, 'USER_UPDATED', 'USER', userId, {
      before,
      after: { ...after, ...patch }
    }));
    if (permissions) {
      batch.set(db.collection('auditLogs').doc(), auditData(caller, 'PERMISSIONS_UPDATED', 'PERMISSIONS', userId, {
        after: permissions,
        source: 'USER_UPDATED'
      }));
    }
    await batch.commit();
  } catch (error) {
    await auth.updateUser(userId, {
      displayName: oldAuthState.displayName ?? undefined,
      disabled: oldAuthState.disabled
    }).catch(() => undefined);
    throw new HttpsError('internal', 'Não foi possível concluir a atualização do usuário.');
  }
  return { ok: true };
});

exports.adminSetPermissions = onCall({ region: REGION }, async (request) => {
  const caller = await getCaller(request);
  requireSuperAdmin(caller);
  const userId = cleanString(request.data?.userId, 128);
  const permissions = normalizePermissionsPayload(request.data?.permissions);
  if (!userId) throw new HttpsError('invalid-argument', 'Usuário e permissões são obrigatórios.');
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');

  const batch = db.batch();
  applyPermissionsToBatch(batch, userId, permissions, caller.uid);
  batch.set(db.collection('auditLogs').doc(), auditData(caller, 'PERMISSIONS_UPDATED', 'PERMISSIONS', userId, { after: permissions }));
  await batch.commit();
  return { ok: true };
});
