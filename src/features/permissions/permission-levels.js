import { MODULES, PERMISSION_LEVELS } from '../../constants/modules.js';

export { PERMISSION_LEVELS };

export const USER_PROFILES = Object.freeze({
  ADM_SUPER: Object.freeze({
    id: 'ADM_SUPER',
    label: 'ADM-SUPER',
    description: 'Acesso total ao sistema, usuários, auditoria e configurações administrativas.',
    systemRole: 'SUPER_ADMIN'
  }),
  GESTAO: Object.freeze({
    id: 'GESTAO',
    label: 'GESTÃO',
    description: 'Visão ampla da operação, contratos, financeiro, imóveis e acompanhamento da equipe.',
    systemRole: 'USER'
  }),
  ADMINISTRATIVO: Object.freeze({
    id: 'ADMINISTRATIVO',
    label: 'ADMINISTRATIVO',
    description: 'Rotina administrativa, contratos, documentos, vistorias, ocorrências e financeiro.',
    systemRole: 'USER'
  }),
  CORRETOR: Object.freeze({
    id: 'CORRETOR',
    label: 'CORRETOR',
    description: 'Acesso operacional a imóveis, proprietários, inquilinos e contratos, sem administração do sistema.',
    systemRole: 'USER'
  })
});

const PROFILE_PERMISSION_PRESETS = Object.freeze({
  ADM_SUPER: Object.freeze(
    Object.fromEntries(MODULES.map(({ id }) => [id, 'EDIT']))
  ),
  GESTAO: Object.freeze({
    dashboard: 'READ', users: 'READ', audit: 'READ', owners: 'EDIT', tenants: 'EDIT', properties: 'EDIT',
    leases: 'EDIT', inspections: 'EDIT', maintenance: 'EDIT', finance: 'EDIT', documents: 'EDIT'
  }),
  ADMINISTRATIVO: Object.freeze({
    dashboard: 'READ', users: 'NONE', audit: 'NONE', owners: 'READ', tenants: 'EDIT', properties: 'READ',
    leases: 'EDIT', inspections: 'EDIT', maintenance: 'EDIT', finance: 'EDIT', documents: 'EDIT'
  }),
  CORRETOR: Object.freeze({
    dashboard: 'READ', users: 'NONE', audit: 'NONE', owners: 'READ', tenants: 'READ', properties: 'EDIT',
    leases: 'READ', inspections: 'READ', maintenance: 'READ', finance: 'NONE', documents: 'READ'
  })
});

export const DEFAULT_USER_PERMISSION_LEVELS = Object.freeze(
  Object.fromEntries(MODULES.map(({ id }) => [id, id === 'dashboard' ? 'READ' : 'NONE']))
);

export function normalizeUserProfile(profile) {
  const normalized = String(profile || '').trim().toUpperCase().replaceAll('-', '_');
  return USER_PROFILES[normalized]?.id || 'CORRETOR';
}

export function getUserProfileDefinition(profile) {
  return USER_PROFILES[normalizeUserProfile(profile)];
}

export function getProfilePermissionLevels(profile) {
  const normalized = normalizeUserProfile(profile);
  const preset = PROFILE_PERMISSION_PRESETS[normalized] || DEFAULT_USER_PERMISSION_LEVELS;
  return buildPermissionLevels(preset);
}

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
