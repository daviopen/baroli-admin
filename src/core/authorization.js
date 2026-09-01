import { ACTIONS } from '../constants/modules.js';

export function normalizeActions(actions = []) {
  const allowed = new Set(ACTIONS);
  return [...new Set(actions)].filter((action) => allowed.has(action));
}

export function isSuperAdmin(profile) {
  return Boolean(profile?.active && profile?.role === 'SUPER_ADMIN');
}

export function hasPermission(session, moduleName, actionName) {
  if (!session?.profile?.active) return false;
  if (isSuperAdmin(session.profile)) return true;
  if (!ACTIONS.includes(actionName)) return false;
  const actions = session.permissions?.[moduleName] ?? [];
  return actions.includes(actionName);
}

export function canAccessModule(session, moduleName) {
  return hasPermission(session, moduleName, 'READ');
}
