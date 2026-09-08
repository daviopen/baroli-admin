import { ACTIONS, PERMISSION_LEVELS } from '../constants/modules.js';

export function normalizePermissionLevel(level) {
  const normalized = String(level || '').trim().toUpperCase();
  return PERMISSION_LEVELS.includes(normalized) ? normalized : 'NONE';
}

export function isSuperAdmin(profile) {
  return Boolean(profile?.active && profile?.role === 'SUPER_ADMIN');
}

export function permissionAllowsAction(level, actionName) {
  if (!ACTIONS.includes(actionName)) return false;
  const normalizedLevel = normalizePermissionLevel(level);
  if (normalizedLevel === 'EDIT') return true;
  return normalizedLevel === 'READ' && actionName === 'READ';
}

function legacyProfileAllowsNewModule(session, moduleName, actionName) {
  if (moduleName !== 'tasks' || !session?.profile?.active) return false;
  const profileType = String(session.profile.profileType || '').toUpperCase();
  return ['GESTAO', 'ADMINISTRATIVO', 'CORRETOR'].includes(profileType) && ACTIONS.includes(actionName);
}

export function hasPermission(session, moduleName, actionName) {
  if (!session?.profile?.active) return false;
  if (isSuperAdmin(session.profile)) return true;
  const explicitLevel = session.permissions?.[moduleName];
  if (explicitLevel) return permissionAllowsAction(explicitLevel, actionName);
  return legacyProfileAllowsNewModule(session, moduleName, actionName);
}

export function canAccessModule(session, moduleName) {
  return hasPermission(session, moduleName, 'READ');
}
