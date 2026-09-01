import { MODULES, PERMISSION_LEVELS } from '../../constants/modules.js';

export { PERMISSION_LEVELS };

export const DEFAULT_USER_PERMISSION_LEVELS = Object.freeze(
  Object.fromEntries(MODULES.map(({ id }) => [id, id === 'dashboard' ? 'READ' : 'NONE']))
);

export function normalizePermissionLevel(level) {
  const normalized = String(level || '').trim().toUpperCase();
  return PERMISSION_LEVELS.includes(normalized) ? normalized : 'NONE';
}

export function buildPermissionPayload(levels = {}) {
  return Object.fromEntries(
    MODULES.map(({ id }) => [id, normalizePermissionLevel(levels[id])])
  );
}

export function buildPermissionLevels(permissions = {}) {
  return Object.fromEntries(
    MODULES.map(({ id }) => [id, normalizePermissionLevel(permissions[id])])
  );
}
