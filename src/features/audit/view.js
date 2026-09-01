import { listAuditLogs } from '../../repositories/admin.repository.js';

function formatDate(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

export async function renderAudit(container) {
  const logs = await listAuditLogs();
  container.innerHTML = `
    <section class="page-header"><p class="eyebrow">Governança</p><h1>Auditoria</h1><p>Últimas ações administrativas registradas pelo backend.</p></section>
    <section class="panel table-wrap"><table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th></tr></thead>
      <tbody>${logs.map((log) => `<tr><td>${formatDate(log.createdAt)}</td><td>${log.actorUserName ?? log.actorUserEmail ?? log.actorUserId}</td><td>${log.action}</td><td>${log.entityType} · ${log.entityId}</td></tr>`).join('')}</tbody>
    </table></section>`;
}
