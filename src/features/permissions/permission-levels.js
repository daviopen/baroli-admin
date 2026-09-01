import { ACTIONS, MODULES } from '../../constants/modules.js';

export const PERMISSION_LEVELS = Object.freeze(['NONE', 'READ', 'EDIT']);

export const DEFAULT_USER_PERMISSION_LEVELS = Object.freeze(
  Object.fromEntries(MODULES.map(({ id }) => [id, id === 'dashboard' ? 'READ' : 'NONE']))
);

export function normalizePermissionLevel(level) {
  const normalized = String(level || '').trim().toUpperCase();
  return PERMISSION_LEVELS.includes(normalized) ? normalized : 'NONE';
}

export function permissionLevelToActions(level) {
  switch (normalizePermissionLevel(level)) {
    case 'EDIT':
      return [...ACTIONS];
    case 'READ':
      return ['READ'];
    default:
      return [];
  }
}

export function actionsToPermissionLevel(actions = []) {
  const normalized = new Set(Array.isArray(actions) ? actions : []);
  if (ACTIONS.some((action) => action !== 'READ' && normalized.has(action))) return 'EDIT';
  return normalized.has('READ') ? 'READ' : 'NONE';
}

export function buildPermissionPayload(levels = {}) {
  return Object.fromEntries(
    MODULES.map(({ id }) => [id, permissionLevelToActions(levels[id])])
  );
}

export function buildPermissionLevels(permissions = {}) {
  return Object.fromEntries(
    MODULES.map(({ id }) => [id, actionsToPermissionLevel(permissions[id])])
  );
}
