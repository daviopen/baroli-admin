import { hasPermission, isSuperAdmin } from '../core/authorization.js';
import { sendPasswordReset } from '../features/auth/auth.js';
import {
  DEFAULT_USER_PERMISSION_LEVELS,
  buildPermissionLevels,
  buildPermissionPayload,
  getProfilePermissionLevels,
  getUserProfileDefinition,
  normalizeUserProfile
} from '../features/permissions/permission-levels.js';
import {
  createManagedUserRecords,
  getUserPermissions,
  listUsers,
  setManagedUserActiveRecord,
  updateManagedUserRecords
} from '../repositories/admin.repository.js';
import { getFirebaseServices } from './firebase.service.js';

function normalizeText(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function validateEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Informe um e-mail válido.');
  }
  return normalized;
}

function validateName(name) {
  const normalized = String(name || '').trim();
  if (normalized.length < 2) throw new Error('Informe o nome do usuário.');
  return normalized;
}

function inferProfileType(user = {}) {
  if (user.profileType) return normalizeUserProfile(user.profileType);
  if (user.role === 'SUPER_ADMIN') return 'ADM_SUPER';
  if (user.role === 'ADMIN') return 'GESTAO';
  return 'CORRETOR';
}

function actorFromSession(session) {
  return {
    uid: session?.authUser?.uid || session?.profile?.uid || session?.profile?.id,
    email: session?.profile?.email || session?.authUser?.email || null,
    name: session?.profile?.name || session?.authUser?.displayName || null
  };
}

function cryptoRandom() {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(36)).join('');
  }
  return `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

export function getUserManagementCapabilities(session) {
  return Object.freeze({
    canCreate: hasPermission(session, 'users', 'CREATE'),
    canUpdate: hasPermission(session, 'users', 'UPDATE'),
    canManagePermissions: isSuperAdmin(session?.profile)
  });
}

export function filterUsers(users, filters = {}) {
  const search = normalizeText(filters.search);
  const status = String(filters.status || 'ALL').toUpperCase();
  const profile = String(filters.profile || 'ALL').toUpperCase();

  return users.filter((user) => {
    const matchesSearch = !search
      || normalizeText(user.name).includes(search)
      || normalizeText(user.email).includes(search);
    const matchesStatus = status === 'ALL'
      || (status === 'ACTIVE' ? user.active === true : user.active !== true);
    const matchesProfile = profile === 'ALL' || inferProfileType(user) === profile;
    return matchesSearch && matchesStatus && matchesProfile;
  });
}

export async function loadUsers() {
  return listUsers();
}

export async function loadUserPermissionLevels(userId) {
  const permissions = await getUserPermissions(userId);
  return buildPermissionLevels(permissions);
}

export function getDefaultUserPermissionLevels() {
  return { ...DEFAULT_USER_PERMISSION_LEVELS };
}

export function getPermissionLevelsForProfile(profile) {
  return getProfilePermissionLevels(profile);
}

export async function createManagedUser(input, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canCreate) throw new Error('Você não possui permissão para cadastrar usuários.');

  const name = validateName(input.name);
  const email = validateEmail(input.email);
  const profileType = capabilities.canManagePermissions ? normalizeUserProfile(input.profileType) : 'CORRETOR';
  const role = getUserProfileDefinition(profileType).systemRole;
  const permissionLevels = buildPermissionPayload(getProfilePermissionLevels(profileType));
  const actor = actorFromSession(session);

  const { app, appSdk, authSdk } = await getFirebaseServices();
  const appName = `baroli-user-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const secondaryApp = appSdk.initializeApp(app.options, appName);
  const secondaryAuth = authSdk.getAuth(secondaryApp);
  let credential = null;
  let profileCreated = false;

  try {
    const temporaryPassword = `${cryptoRandom()}aA1!`;
    credential = await authSdk.createUserWithEmailAndPassword(secondaryAuth, email, temporaryPassword);
    const uid = credential.user.uid;
    await createManagedUserRecords({ uid, name, email, role, profileType, permissionLevels, actor });
    profileCreated = true;

    let passwordResetSent = false;
    let passwordResetError = null;
    try {
      await sendPasswordReset(email);
      passwordResetSent = true;
    } catch (error) {
      passwordResetError = error?.message || 'Não foi possível solicitar o e-mail de definição de senha.';
    }

    return { uid, passwordResetSent, passwordResetError };
  } catch (error) {
    if (!profileCreated && credential?.user && typeof credential.user.delete === 'function') {
      try { await credential.user.delete(); } catch { /* rollback best-effort */ }
    }
    if (error?.code === 'auth/email-already-in-use') throw new Error('Já existe um usuário com este e-mail.');
    throw error;
  } finally {
    try { await authSdk.signOut(secondaryAuth); } catch { /* noop */ }
    await appSdk.deleteApp(secondaryApp).catch(() => undefined);
  }
}

export async function updateManagedUser(userId, input, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canUpdate) throw new Error('Você não possui permissão para editar usuários.');
  if (!userId) throw new Error('Usuário inválido.');

  const name = validateName(input.name);
  const profileType = capabilities.canManagePermissions ? normalizeUserProfile(input.profileType) : 'CORRETOR';
  const role = getUserProfileDefinition(profileType).systemRole;
  const permissionLevels = buildPermissionPayload(getProfilePermissionLevels(profileType));

  await updateManagedUserRecords(userId, {
    name,
    active: input.active !== false,
    role,
    profileType,
    permissionLevels,
    actor: actorFromSession(session)
  });
  return { ok: true };
}

export async function setManagedUserActive(userId, active, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canUpdate) throw new Error('Você não possui permissão para alterar o status de usuários.');
  return setManagedUserActiveRecord(userId, Boolean(active), actorFromSession(session));
}

export async function requestManagedUserPasswordReset(email, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canUpdate) throw new Error('Você não possui permissão para executar esta ação.');
  return sendPasswordReset(validateEmail(email));
}
