import { deleteLeaseTermination, listLeaseTerminations, updateLeaseTerminationStatus } from '../../services/lease-termination-records.service.js';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS = Object.freeze({
  CALCULADA: 'Calculada',
  EM_CONFERENCIA: 'Em conferência',
  PENDENTE: 'Pendente',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada'
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '\"': '&quot;' }[char]));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

function resultLabel(value) {
  if (value === 'TENANT_PAYS') return 'Cobrar inquilino';
  if (value === 'TENANT_RECEIVES') return 'Ressarcir inquilino';
  return 'Sem saldo';
}

function statusOptions(selected) {
  return Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function row(record) {
  return `
    <tr data-record-id="${record.id}">
      <td><strong>${escapeHtml(record.contractNumber || 'Sem nº')}</strong><small>${escapeHtml(record.propertyReference || '')}</small></td>
      <td><strong>${escapeHtml(record.propertyLabel || 'Imóvel não identificado')}</strong><small>${escapeHtml(record.tenantName || '—')}</small></td>
      <td>${formatDate(record.terminationDate)}</td>
      <td><span class="termination-result ${record.result === 'TENANT_RECEIVES' ? 'is-credit' : ''}">${escapeHtml(resultLabel(record.result))}</span></td>
      <td><strong>${money.format(Number(record.finalBalance || 0))}</strong></td>
      <td>
        <select class="row-status" data-status-id="${record.id}" aria-label="Status da rescisão ${escapeHtml(record.contractNumber || '')}">
          ${statusOptions(record.status || 'CALCULADA')}
        </select>
      </td>
      <td class="row-actions">
        <button type="button" class="table-action" data-edit-id="${record.id}">Editar</button>
        <button type="button" class="table-action danger" data-delete-id="${record.id}">Excluir</button>
      </td>
    </tr>
  `;
}

function matches(record, filters) {
  const query = filters.query.toLowerCase();
  const haystack = [record.contractNumber, record.propertyReference, record.propertyLabel, record.tenantName, record.landlordName].join(' ').toLowerCase();
  if (query && !haystack.includes(query)) return false;
  if (filters.status && record.status !== filters.status) return false;
  if (filters.result && record.result !== filters.result) return false;
  if (filters.start && String(record.terminationDate || '') < filters.start) return false;
  if (filters.end && String(record.terminationDate || '') > filters.end) return false;
  return true;
}

export async function renderLeaseTerminations(root) {
  root.innerHTML = `
    <section class="page-header termination-list-header">
      <div>
        <p class="eyebrow">Financeiro</p>
        <h1>Rescisões</h1>
        <p>Consulte, filtre e acompanhe os cálculos de rescisão já salvos.</p>
      </div>
      <a class="primary termination-new-link" href="#/lease-termination">Calcular nova rescisão</a>
    </section>

    <section class="panel termination-filter-panel">
      <div class="termination-filter-row">
        <label class="field termination-search">Buscar<input type="search" data-filter="query" placeholder="Contrato, imóvel, referência ou inquilino"></label>
        <label class="field">Status<select data-filter="status"><option value="">Todos</option>${Object.entries(STATUS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label class="field">Resultado<select data-filter="result"><option value="">Todos</option><option value="TENANT_PAYS">Cobrar inquilino</option><option value="TENANT_RECEIVES">Ressarcir inquilino</option><option value="SETTLED">Sem saldo</option></select></label>
        <label class="field">De<input type="date" data-filter="start"></label>
        <label class="field">Até<input type="date" data-filter="end"></label>
        <button class="secondary compact termination-clear-filters" type="button">Limpar filtros</button>
      </div>
    </section>

    <section class="panel termination-list-panel">
      <div class="termination-list-meta"><strong data-count>0 rescisões</strong><span>Atualize o status diretamente na linha.</span></div>
      <div class="table-scroll">
        <table class="termination-table">
          <thead><tr><th>Contrato</th><th>Imóvel / inquilino</th><th>Rescisão</th><th>Resultado</th><th>Saldo</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="termination-empty" hidden>Nenhuma rescisão encontrada com os filtros selecionados.</div>
      <p class="error-text" data-list-error aria-live="polite"></p>
    </section>
  `;

  const tbody = root.querySelector('tbody');
  const empty = root.querySelector('.termination-empty');
  const count = root.querySelector('[data-count]');
  const error = root.querySelector('[data-list-error]');
  let records = [];

  function currentFilters() {
    return Object.fromEntries([...root.querySelectorAll('[data-filter]')].map((field) => [field.dataset.filter, field.value.trim()]));
  }

  function renderRows() {
    const visible = records.filter((record) => matches(record, currentFilters()));
    tbody.innerHTML = visible.map(row).join('');
    empty.hidden = visible.length > 0;
    count.textContent = `${visible.length} ${visible.length === 1 ? 'rescisão' : 'rescisões'}`;
  }

  try {
    records = await listLeaseTerminations();
    renderRows();
  } catch (cause) {
    error.textContent = cause.message || 'Não foi possível carregar as rescisões.';
  }

  root.querySelectorAll('[data-filter]').forEach((field) => field.addEventListener(field.type === 'search' ? 'input' : 'change', renderRows));
  root.querySelector('.termination-clear-filters').addEventListener('click', () => {
    root.querySelectorAll('[data-filter]').forEach((field) => { field.value = ''; });
    renderRows();
  });

  tbody.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-id]');
    if (edit) {
      sessionStorage.setItem('baroli:termination-edit-id', edit.dataset.editId);
      location.hash = '#/lease-termination';
      return;
    }

    const remove = event.target.closest('[data-delete-id]');
    if (!remove) return;
    const record = records.find((item) => item.id === remove.dataset.deleteId);
    if (!record) return;
    const confirmed = confirm(`Excluir a rescisão do contrato ${record.contractNumber || 'selecionado'}? O registro deixará de aparecer na consulta.`);
    if (!confirmed) return;
    remove.disabled = true;
    try {
      await deleteLeaseTermination(record.id);
      records = records.filter((item) => item.id !== record.id);
      renderRows();
    } catch (cause) {
      error.textContent = cause.message || 'Não foi possível excluir a rescisão.';
      remove.disabled = false;
    }
  });

  tbody.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-status-id]');
    if (!select) return;
    const record = records.find((item) => item.id === select.dataset.statusId);
    if (!record) return;
    const previous = record.status;
    select.disabled = true;
    try {
      await updateLeaseTerminationStatus(record.id, select.value);
      record.status = select.value;
    } catch (cause) {
      select.value = previous || 'CALCULADA';
      error.textContent = cause.message || 'Não foi possível alterar o status.';
    } finally {
      select.disabled = false;
    }
  });
}
