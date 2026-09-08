import { hasPermission } from '../../core/authorization.js';
import { getCurrentSession } from '../../services/session.service.js';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  createTask,
  deleteTask,
  listTasks,
  loadTaskReferences,
  updateTask,
  updateTaskStatus
} from './repository.js';

const STATUS_LABEL = Object.fromEntries(TASK_STATUSES.map((item) => [item.id, item.label]));
const PRIORITY_LABEL = Object.fromEntries(TASK_PRIORITIES.map((item) => [item.id, item.label]));

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function dateValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function formatDate(value) {
  const raw = dateValue(value);
  if (!raw) return 'Sem prazo';
  const [year, month, day] = raw.split('-');
  return `${day}/${month}/${year}`;
}

function isOverdue(task) {
  const due = dateValue(task.dueDate);
  if (!due || task.status === 'DONE') return false;
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return due < current;
}

function optionList(items, selectedId, emptyLabel = 'Não vincular') {
  return `<option value="">${esc(emptyLabel)}</option>${items.map((item) => `<option value="${esc(item.id)}" ${String(item.id) === String(selectedId || '') ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}`;
}

function checklistProgress(task) {
  const items = Array.isArray(task.checklist) ? task.checklist : [];
  if (!items.length) return '';
  const done = items.filter((item) => item.done).length;
  return `${done}/${items.length}`;
}

function taskMeta(task) {
  const bits = [];
  if (task.assignedTo?.label) bits.push(`👤 ${esc(task.assignedTo.label)}`);
  if (task.property?.label) bits.push(`🏠 ${esc(task.property.label)}`);
  if (task.tenant?.label) bits.push(`◎ ${esc(task.tenant.label)}`);
  return bits.map((bit) => `<span>${bit}</span>`).join('');
}

function priorityClass(priority) {
  return priority ? `task-priority task-priority--${priority.toLowerCase()}` : 'task-priority task-priority--none';
}

export async function renderTasks(container) {
  const session = getCurrentSession();
  const canEdit = hasPermission(session, 'tasks', 'UPDATE');
  const state = {
    tasks: [],
    refs: { users: [], properties: [], clients: [], leases: [], terminations: [] },
    view: 'board',
    filters: { search: '', status: 'ALL', assignee: 'ALL', priority: 'ALL', due: 'ALL' },
    editing: null
  };

  container.innerHTML = `
    <section class="page-header tasks-page-header">
      <div><p class="eyebrow">Operação</p><h1>Pendências</h1><p>Organize o trabalho da equipe em quadro Kanban ou lista de checklist.</p></div>
      ${canEdit ? '<button class="primary" id="task-new" type="button">+ Nova pendência</button>' : ''}
    </section>

    <section class="tasks-summary" aria-label="Resumo de pendências">
      <article><span>Em aberto</span><strong id="task-summary-open">0</strong></article>
      <article><span>Em andamento</span><strong id="task-summary-progress">0</strong></article>
      <article><span>Vencidas</span><strong id="task-summary-overdue">0</strong></article>
      <article><span>Concluídas</span><strong id="task-summary-done">0</strong></article>
    </section>

    <section class="panel tasks-toolbar">
      <label class="field tasks-search">Buscar<input id="task-search" type="search" placeholder="Título, imóvel, inquilino..." autocomplete="off"></label>
      <label class="field">Status<select id="task-status-filter"><option value="ALL">Todos</option>${TASK_STATUSES.map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}</select></label>
      <label class="field">Atribuído a<select id="task-assignee-filter"><option value="ALL">Todos</option></select></label>
      <label class="field">Prioridade<select id="task-priority-filter"><option value="ALL">Todas</option>${TASK_PRIORITIES.filter((item) => item.id).map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}</select></label>
      <label class="field">Prazo<select id="task-due-filter"><option value="ALL">Todos</option><option value="OVERDUE">Vencidas</option><option value="TODAY">Hoje</option><option value="7D">Próximos 7 dias</option><option value="NO_DUE">Sem prazo</option></select></label>
      <div class="tasks-view-toggle" role="group" aria-label="Modo de visualização"><button type="button" data-view="board" class="active">▦ Kanban</button><button type="button" data-view="list">☑ Lista</button></div>
    </section>

    <div id="tasks-loading" class="loading">Carregando pendências...</div>
    <section id="tasks-board" class="tasks-board" aria-label="Quadro Kanban"></section>
    <section id="tasks-list" class="panel tasks-list" hidden></section>
    <div id="tasks-empty" class="empty-state" hidden>Nenhuma pendência encontrada com os filtros atuais.</div>
    <div class="toast" id="tasks-toast" role="status" aria-live="polite" hidden></div>

    <dialog class="admin-dialog task-dialog" id="task-dialog" aria-labelledby="task-dialog-title">
      <form id="task-form">
        <div class="dialog-header"><div><p class="eyebrow">Pendência</p><h2 id="task-dialog-title">Nova pendência</h2><p>Defina responsável, prazo e vínculos opcionais com a operação.</p></div><button type="button" class="dialog-close" id="task-close" aria-label="Fechar">×</button></div>
        <div class="dialog-body task-dialog-body">
          <div class="form-grid task-form-grid">
            <label class="field form-span-2">Título<input id="task-title" maxlength="180" required placeholder="Ex.: Solicitar reparo da torneira"></label>
            <label class="field form-span-2">Descrição<textarea id="task-description" rows="3" maxlength="4000" placeholder="Detalhes, contexto e próximo passo"></textarea></label>
            <label class="field">Status<select id="task-status">${TASK_STATUSES.map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}</select></label>
            <label class="field">Prioridade<select id="task-priority">${TASK_PRIORITIES.map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}</select></label>
            <label class="field">Prazo<input id="task-due" type="date"></label>
            <label class="field">Atribuído a<select id="task-assignee"></select></label>
            <label class="field">Imóvel<select id="task-property"></select></label>
            <label class="field">Inquilino / cliente<select id="task-tenant"></select></label>
            <label class="field">Contrato<select id="task-lease"></select></label>
            <label class="field">Rescisão<select id="task-termination"></select></label>
            <label class="field form-span-2">Etiquetas<input id="task-tags" maxlength="220" placeholder="Ex.: manutenção, urgente, vistoria (separadas por vírgula)"></label>
          </div>
          <section class="task-checklist-editor"><div class="task-checklist-head"><div><h3>Checklist</h3><p>Opcional. Quebre a pendência em passos menores.</p></div><button class="secondary compact" id="task-add-check" type="button">+ Item</button></div><div id="task-checklist-items"></div></section>
          <div class="form-feedback" id="task-feedback" hidden></div>
        </div>
        <div class="dialog-actions"><button type="button" class="secondary compact" id="task-cancel">Cancelar</button><button type="button" class="link-button danger-link" id="task-delete" hidden>Excluir</button><button type="submit" class="primary" id="task-save">Salvar pendência</button></div>
      </form>
    </dialog>`;

  const dialog = container.querySelector('#task-dialog');
  const board = container.querySelector('#tasks-board');
  const list = container.querySelector('#tasks-list');
  const empty = container.querySelector('#tasks-empty');
  const loading = container.querySelector('#tasks-loading');

  function toast(message, type = 'success') {
    const el = container.querySelector('#tasks-toast');
    el.textContent = message;
    el.dataset.type = type;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  function matchesDue(task) {
    const filter = state.filters.due;
    if (filter === 'ALL') return true;
    const due = dateValue(task.dueDate);
    if (filter === 'NO_DUE') return !due;
    if (!due) return false;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (filter === 'OVERDUE') return due < today && task.status !== 'DONE';
    if (filter === 'TODAY') return due === today;
    if (filter === '7D') {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      const endRaw = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      return due >= today && due <= endRaw;
    }
    return true;
  }

  function filteredTasks() {
    const q = state.filters.search.trim().toLowerCase();
    return state.tasks.filter((task) => {
      if (state.filters.status !== 'ALL' && task.status !== state.filters.status) return false;
      if (state.filters.assignee !== 'ALL' && String(task.assignedTo?.id || '') !== state.filters.assignee) return false;
      if (state.filters.priority !== 'ALL' && task.priority !== state.filters.priority) return false;
      if (!matchesDue(task)) return false;
      if (!q) return true;
      const haystack = [task.title, task.description, task.assignedTo?.label, task.property?.label, task.tenant?.label, task.lease?.label, ...(task.tags || [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function renderSummary() {
    container.querySelector('#task-summary-open').textContent = state.tasks.filter((task) => task.status !== 'DONE').length;
    container.querySelector('#task-summary-progress').textContent = state.tasks.filter((task) => task.status === 'IN_PROGRESS').length;
    container.querySelector('#task-summary-overdue').textContent = state.tasks.filter(isOverdue).length;
    container.querySelector('#task-summary-done').textContent = state.tasks.filter((task) => task.status === 'DONE').length;
  }

  function cardHtml(task) {
    const checklist = checklistProgress(task);
    return `<article class="task-card ${isOverdue(task) ? 'is-overdue' : ''}" draggable="${canEdit}" data-task-id="${esc(task.id)}">
      <div class="task-card-top"><span class="${priorityClass(task.priority)}">${esc(PRIORITY_LABEL[task.priority] || 'Sem prioridade')}</span><button type="button" class="task-card-open" data-edit="${esc(task.id)}" aria-label="Abrir pendência">•••</button></div>
      <h3>${esc(task.title)}</h3>
      ${task.description ? `<p>${esc(task.description)}</p>` : ''}
      <div class="task-card-meta">${taskMeta(task)}</div>
      <div class="task-card-footer"><span class="task-due ${isOverdue(task) ? 'danger-text' : ''}">📅 ${esc(formatDate(task.dueDate))}</span>${checklist ? `<span>☑ ${checklist}</span>` : ''}</div>
      ${canEdit ? `<div class="task-card-move"><button type="button" data-move="prev" data-task-id="${esc(task.id)}" aria-label="Mover para coluna anterior">‹</button><button type="button" data-move="next" data-task-id="${esc(task.id)}" aria-label="Mover para próxima coluna">›</button></div>` : ''}
    </article>`;
  }

  function renderBoard(tasks) {
    board.innerHTML = TASK_STATUSES.map((status) => {
      const items = tasks.filter((task) => task.status === status.id);
      return `<section class="task-column" data-status="${status.id}"><header><div><span class="task-status-dot task-status-dot--${status.id.toLowerCase()}"></span><strong>${status.label}</strong></div><span>${items.length}</span></header><div class="task-column-body">${items.map(cardHtml).join('') || '<div class="task-column-empty">Sem itens</div>'}</div></section>`;
    }).join('');
  }

  function renderList(tasks) {
    list.innerHTML = tasks.length ? `<div class="task-list-head"><strong>${tasks.length} pendência${tasks.length === 1 ? '' : 's'}</strong></div><div class="task-list-items">${tasks.map((task) => `<article class="task-list-row" data-task-id="${esc(task.id)}"><button type="button" class="task-list-check ${task.status === 'DONE' ? 'is-done' : ''}" data-toggle-done="${esc(task.id)}" ${canEdit ? '' : 'disabled'} aria-label="${task.status === 'DONE' ? 'Reabrir' : 'Concluir'}">${task.status === 'DONE' ? '✓' : ''}</button><div class="task-list-main"><button type="button" class="task-list-title" data-edit="${esc(task.id)}">${esc(task.title)}</button><div>${taskMeta(task)}</div></div><span class="${priorityClass(task.priority)}">${esc(PRIORITY_LABEL[task.priority] || 'Sem prioridade')}</span><span>${esc(STATUS_LABEL[task.status] || task.status)}</span><span class="${isOverdue(task) ? 'danger-text' : ''}">${esc(formatDate(task.dueDate))}</span></article>`).join('')}</div>` : '';
  }

  function render() {
    const tasks = filteredTasks();
    renderSummary();
    empty.hidden = tasks.length !== 0;
    board.hidden = state.view !== 'board' || tasks.length === 0;
    list.hidden = state.view !== 'list' || tasks.length === 0;
    renderBoard(tasks);
    renderList(tasks);
  }

  function refFromSelect(id, items) {
    const value = container.querySelector(id).value;
    return value ? items.find((item) => String(item.id) === value) || null : null;
  }

  function renderChecklistEditor(items = []) {
    const root = container.querySelector('#task-checklist-items');
    root.innerHTML = items.map((item, index) => `<div class="task-check-row" data-check-id="${esc(item.id || `item-${index + 1}`)}"><input type="checkbox" ${item.done ? 'checked' : ''} aria-label="Concluído"><input type="text" maxlength="220" value="${esc(item.text)}" placeholder="Descreva o item"><button type="button" aria-label="Remover item" data-remove-check>×</button></div>`).join('');
  }

  function openEditor(task = null) {
    state.editing = task;
    container.querySelector('#task-dialog-title').textContent = task ? 'Editar pendência' : 'Nova pendência';
    container.querySelector('#task-title').value = task?.title || '';
    container.querySelector('#task-description').value = task?.description || '';
    container.querySelector('#task-status').value = task?.status || 'TODO';
    container.querySelector('#task-priority').value = task?.priority || '';
    container.querySelector('#task-due').value = dateValue(task?.dueDate);
    container.querySelector('#task-assignee').innerHTML = optionList(state.refs.users, task?.assignedTo?.id, 'Não atribuído');
    container.querySelector('#task-property').innerHTML = optionList(state.refs.properties, task?.property?.id);
    container.querySelector('#task-tenant').innerHTML = optionList(state.refs.clients, task?.tenant?.id);
    container.querySelector('#task-lease').innerHTML = optionList(state.refs.leases, task?.lease?.id);
    container.querySelector('#task-termination').innerHTML = optionList(state.refs.terminations, task?.termination?.id);
    container.querySelector('#task-tags').value = (task?.tags || []).join(', ');
    container.querySelector('#task-delete').hidden = !task || !canEdit;
    renderChecklistEditor(task?.checklist || []);
    container.querySelector('#task-feedback').hidden = true;
    dialog.showModal();
    container.querySelector('#task-title').focus();
  }

  function collectChecklist() {
    return [...container.querySelectorAll('.task-check-row')].map((row, index) => ({ id: row.dataset.checkId || `item-${index + 1}`, done: row.querySelector('input[type="checkbox"]').checked, text: row.querySelector('input[type="text"]').value }));
  }

  async function refresh() {
    loading.hidden = false;
    try {
      [state.tasks, state.refs] = await Promise.all([listTasks(), loadTaskReferences()]);
      const assigneeFilter = container.querySelector('#task-assignee-filter');
      assigneeFilter.innerHTML = `<option value="ALL">Todos</option><option value="">Não atribuído</option>${state.refs.users.map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('')}`;
      assigneeFilter.value = state.filters.assignee;
      render();
    } catch (error) {
      toast(error?.message || 'Não foi possível carregar as pendências.', 'error');
    } finally {
      loading.hidden = true;
    }
  }

  container.querySelector('#task-new')?.addEventListener('click', () => openEditor());
  container.querySelector('#task-close').addEventListener('click', () => dialog.close());
  container.querySelector('#task-cancel').addEventListener('click', () => dialog.close());
  container.querySelector('#task-add-check').addEventListener('click', () => {
    const root = container.querySelector('#task-checklist-items');
    root.insertAdjacentHTML('beforeend', `<div class="task-check-row" data-check-id="item-${Date.now()}"><input type="checkbox" aria-label="Concluído"><input type="text" maxlength="220" placeholder="Descreva o item"><button type="button" aria-label="Remover item" data-remove-check>×</button></div>`);
    root.lastElementChild.querySelector('input[type="text"]').focus();
  });
  container.querySelector('#task-checklist-items').addEventListener('click', (event) => event.target.closest('[data-remove-check]')?.closest('.task-check-row')?.remove());

  container.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    container.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
    render();
  }));

  [['#task-search', 'search', 'input'], ['#task-status-filter', 'status', 'change'], ['#task-assignee-filter', 'assignee', 'change'], ['#task-priority-filter', 'priority', 'change'], ['#task-due-filter', 'due', 'change']].forEach(([selector, key, eventName]) => {
    container.querySelector(selector).addEventListener(eventName, (event) => { state.filters[key] = event.target.value; render(); });
  });

  async function moveTask(taskId, direction) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const index = TASK_STATUSES.findIndex((item) => item.id === task.status);
    const next = TASK_STATUSES[Math.max(0, Math.min(TASK_STATUSES.length - 1, index + direction))];
    if (!next || next.id === task.status) return;
    await updateTaskStatus(task.id, next.id, session);
    task.status = next.id;
    render();
  }

  container.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit]');
    if (edit) { openEditor(state.tasks.find((task) => task.id === edit.dataset.edit)); return; }
    const move = event.target.closest('[data-move]');
    if (move && canEdit) {
      try { await moveTask(move.dataset.taskId, move.dataset.move === 'next' ? 1 : -1); } catch (error) { toast(error?.message || 'Não foi possível mover a pendência.', 'error'); }
      return;
    }
    const toggleDone = event.target.closest('[data-toggle-done]');
    if (toggleDone && canEdit) {
      const task = state.tasks.find((item) => item.id === toggleDone.dataset.toggleDone);
      try { await updateTaskStatus(task.id, task.status === 'DONE' ? 'TODO' : 'DONE', session); await refresh(); } catch (error) { toast(error?.message || 'Não foi possível atualizar a pendência.', 'error'); }
    }
  });

  board.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.task-card');
    if (!card || !canEdit) return;
    event.dataTransfer.setData('text/plain', card.dataset.taskId);
    event.dataTransfer.effectAllowed = 'move';
  });
  board.addEventListener('dragover', (event) => { if (canEdit && event.target.closest('.task-column')) event.preventDefault(); });
  board.addEventListener('drop', async (event) => {
    const column = event.target.closest('.task-column');
    const taskId = event.dataTransfer.getData('text/plain');
    if (!column || !taskId || !canEdit) return;
    event.preventDefault();
    try { await updateTaskStatus(taskId, column.dataset.status, session); await refresh(); } catch (error) { toast(error?.message || 'Não foi possível mover a pendência.', 'error'); }
  });

  container.querySelector('#task-delete').addEventListener('click', async () => {
    if (!state.editing || !confirm('Excluir esta pendência? Esta ação não poderá ser desfeita.')) return;
    try { await deleteTask(state.editing.id, session); dialog.close(); toast('Pendência excluída.'); await refresh(); } catch (error) { toast(error?.message || 'Não foi possível excluir.', 'error'); }
  });

  container.querySelector('#task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = container.querySelector('#task-feedback');
    const save = container.querySelector('#task-save');
    save.disabled = true;
    feedback.hidden = true;
    const payload = {
      title: container.querySelector('#task-title').value,
      description: container.querySelector('#task-description').value,
      status: container.querySelector('#task-status').value,
      priority: container.querySelector('#task-priority').value,
      dueDate: container.querySelector('#task-due').value,
      assignedTo: refFromSelect('#task-assignee', state.refs.users),
      property: refFromSelect('#task-property', state.refs.properties),
      tenant: refFromSelect('#task-tenant', state.refs.clients),
      lease: refFromSelect('#task-lease', state.refs.leases),
      termination: refFromSelect('#task-termination', state.refs.terminations),
      tags: container.querySelector('#task-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
      checklist: collectChecklist()
    };
    try {
      if (state.editing) await updateTask(state.editing.id, payload, session);
      else await createTask(payload, session);
      dialog.close();
      toast(state.editing ? 'Pendência atualizada.' : 'Pendência criada.');
      await refresh();
    } catch (error) {
      feedback.textContent = error?.message || 'Não foi possível salvar a pendência.';
      feedback.hidden = false;
    } finally { save.disabled = false; }
  });

  await refresh();
}
