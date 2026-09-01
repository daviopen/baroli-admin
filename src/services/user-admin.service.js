import { hasPermission, isSuperAdmin } from '../core/authorization.js';
import { sendPasswordReset } from '../features/auth/auth.js';
import {
  DEFAULT_USER_PERMISSION_LEVELS,
  buildPermissionLevels,
  buildPermissionPayload
} from '../features/permissions/permission-levels.js';
import { callAdminFunction, getUserPermissions, listUsers } from '../repositories/admin.repository.js';

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

function normalizeRole(role) {
  const normalized = String(role || 'USER').trim().toUpperCase();
  return ['USER', 'ADMIN', 'SUPER_ADMIN'].includes(normalized) ? normalized : 'USER';
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

  return users.filter((user) => {
    const matchesSearch = !search
      || normalizeText(user.name).includes(search)
      || normalizeText(user.email).includes(search);
    const matchesStatus = status === 'ALL'
      || (status === 'ACTIVE' ? user.active === true : user.active !== true);
    return matchesSearch && matchesStatus;
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

export async function saveUserAccess(userId, role, permissionLevels, session) {
  if (!isSuperAdmin(session?.profile)) {
    throw new Error('Somente SUPER_ADMIN pode alterar perfis e permissões.');
  }
  if (!userId) throw new Error('Usuário inválido.');
  return callAdminFunction('adminUpdateUser', {
    userId,
    role: normalizeRole(role),
    permissions: buildPermissionPayload(permissionLevels)
  });
}

export async function createManagedUser(input, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canCreate) throw new Error('Você não possui permissão para cadastrar usuários.');

  const name = validateName(input.name);
  const email = validateEmail(input.email);
  const request = { name, email, role: 'USER' };

  if (input.permissionLevels && capabilities.canManagePermissions) {
    request.permissions = buildPermissionPayload(input.permissionLevels);
  }

  const created = await callAdminFunction('adminCreateUser', request);
  let passwordResetSent = false;
  let passwordResetError = null;
  try {
    await sendPasswordReset(email);
    passwordResetSent = true;
  } catch (error) {
    passwordResetError = error?.message || 'Não foi possível solicitar o e-mail de definição de senha.';
  }

  return { ...created, passwordResetSent, passwordResetError };
}

export async function updateManagedUser(userId, input, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canUpdate) throw new Error('Você não possui permissão para editar usuários.');
  if (!userId) throw new Error('Usuário inválido.');

  const request = {
    userId,
    name: validateName(input.name),
    active: input.active !== false
  };
  if (input.permissionLevels && capabilities.canManagePermissions) {
    request.permissions = buildPermissionPayload(input.permissionLevels);
  }

  await callAdminFunction('adminUpdateUser', request);
  return { ok: true };
}

export async function setManagedUserActive(userId, active, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canUpdate) throw new Error('Você não possui permissão para alterar o status de usuários.');
  return callAdminFunction('adminUpdateUser', { userId, active: Boolean(active) });
}

export async function requestManagedUserPasswordReset(email, session) {
  const capabilities = getUserManagementCapabilities(session);
  if (!capabilities.canUpdate) throw new Error('Você não possui permissão para executar esta ação.');
  return sendPasswordReset(validateEmail(email));
}
