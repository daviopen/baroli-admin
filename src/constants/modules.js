export const ACTIONS = Object.freeze(['READ', 'CREATE', 'UPDATE', 'DELETE']);

export const MODULES = Object.freeze([
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Usuários' },
  { id: 'permissions', label: 'Permissões' },
  { id: 'audit', label: 'Auditoria' },
  { id: 'owners', label: 'Proprietários' },
  { id: 'tenants', label: 'Inquilinos' },
  { id: 'properties', label: 'Imóveis' },
  { id: 'leases', label: 'Contratos / Locações' },
  { id: 'leaseTermination', label: 'Rescisões' },
  { id: 'inspections', label: 'Vistorias' },
  { id: 'maintenance', label: 'Manutenções / Ocorrências' },
  { id: 'finance', label: 'Financeiro administrativo' },
  { id: 'documents', label: 'Documentos' }
]);

export const MODULE_BY_ID = Object.freeze(
  Object.fromEntries(MODULES.map((module) => [module.id, module]))
);
