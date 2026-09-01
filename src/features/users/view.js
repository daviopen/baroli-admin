import { MODULES } from '../../constants/modules.js';
import { getCurrentSession } from '../../services/session.service.js';
import {
  createManagedUser,
  filterUsers,
  getDefaultUserPermissionLevels,
  getUserManagementCapabilities,
  loadUserPermissionLevels,
  loadUsers,
  requestManagedUserPasswordReset,
  setManagedUserActive,
  updateManagedUser
} from '../../services/user-admin.service.js';

const PERMISSION_LEVEL_LABELS = Object.freeze({
  NONE: 'Sem acesso',
  READ: 'Leitura',
  EDIT: 'Edição'
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formatDate(value) {
  if (!value) return '—';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function initials(user) {
  const source = String(user?.name || user?.email || '?').trim();
  return source.slice(0, 2).toUpperCase();
}

function permissionFields(levels) {
  return MODULES.map(({ id, label }) => {
    const selected = levels[id] || 'NONE';
    return `
      <label class="permission-card">
        <span class="permission-card__label">${escapeHtml(label)}</span>
        <select data-permission-module="${escapeHtml(id)}" aria-label="Permissão para ${escapeHtml(label)}">
          ${Object.entries(PERMISSION_LEVEL_LABELS).map(([value, text]) => `
            <option value="${value}" ${selected === value ? 'selected' : ''}>${text}</option>
          `).join('')}
        </select>
      </label>`;
  }).join('');
}

function readPermissionLevels(dialog) {
  return Object.fromEntries(
    [...dialog.querySelectorAll('[data-permission-module]')].map((select) => [
      select.dataset.permissionModule,
      select.value
    ])
  );
}

export async function renderUsers(container) {
  const session = getCurrentSession();
  const capabilities = getUserManagementCapabilities(session);
  const state = {
    users: [],
    filters: { search: '', status: 'ALL' },
    editingUser: null
  };

  container.innerHTML = `
    <section class="page-header row-between">
      <div>
        <p class="eyebrow">Administração</p>
        <h1>Usuários</h1>
        <p>Gerencie as pessoas com acesso ao sistema, status e permissões por funcionalidade.</p>
      </div>
      ${capabilities.canCreate ? '<button class="primary" id="new-user" type="button">Novo usuário</button>' : ''}
    </section>

    <section class="panel users-toolbar users-toolbar--louvor" aria-label="Filtros de usuários">
      <label class="field users-search">
        Buscar
        <input id="user-search" type="search" placeholder="Nome ou e-mail" autocomplete="off">
      </label>
      <label class="field">
        Status
        <select id="user-status">
          <option value="ALL">Todos</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
      </label>
      <div class="users-count" id="users-count" aria-live="polite"></div>
    </section>

    <section class="panel users-panel">
      <div id="users-loading" class="loading">Carregando usuários...</div>
      <div id="users-empty" class="empty-state" hidden>Nenhum usuário encontrado.</div>
      <div class="table-wrap" id="users-table-wrap" hidden>
        <table class="users-table users-table--louvor">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Status</th>
              <th>Último acesso</th>
              <th><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody id="users-body"></tbody>
        </table>
      </div>
    </section>

    <div class="toast" id="users-toast" role="status" aria-live="polite" hidden></div>

    <dialog class="admin-dialog" id="user-dialog" aria-labelledby="user-dialog-title">
      <form id="user-form">
        <div class="dialog-header">
          <div>
            <p class="eyebrow">Administração</p>
            <h2 id="user-dialog-title">Novo usuário</h2>
            <p id="user-dialog-subtitle">Cadastre a pessoa e defina seus acessos.</p>
          </div>
          <button class="dialog-close" id="user-dialog-close" type="button" aria-label="Fechar">×</button>
        </div>

        <div class="dialog-body">
          <section class="form-section" aria-labelledby="user-data-title">
            <div class="section-heading">
              <h3 id="user-data-title">Dados do usuário</h3>
              <p>O e-mail de login é definido no cadastro e não pode ser alterado depois.</p>
            </div>
            <div class="form-grid">
              <label class="field form-span-2">
                Nome
                <input id="user-name" name="name" maxlength="160" required autocomplete="name">
              </label>
              <label class="field form-span-2">
                E-mail
                <input id="user-email" name="email" type="email" maxlength="320" required autocomplete="email">
              </label>
              <label class="switch-field form-span-2" id="user-active-row" hidden>
                <span>
                  <strong>Acesso ativo</strong>
                  <small>Ao inativar, o histórico é preservado e o login fica bloqueado.</small>
                </span>
                <input id="user-active" type="checkbox" checked>
              </label>
            </div>
          </section>

          ${capabilities.canManagePermissions ? `
            <fieldset class="form-section permissions-fieldset" id="user-permissions-row">
              <legend>Permissões de acesso</legend>
              <p class="muted-text">Defina o acesso deste usuário aos módulos. Edição inclui leitura; Sem acesso remove o módulo do menu e bloqueia a rota.</p>
              <div class="permissions-grid" id="user-permissions"></div>
            </fieldset>
          ` : ''}

          <div class="form-feedback" id="user-form-feedback" role="alert" hidden></div>
        </div>

        <div class="dialog-actions">
          <button class="secondary compact" id="user-cancel" type="button">Cancelar</button>
          <button class="primary" id="user-submit" type="submit">Salvar usuário</button>
        </div>
      </form>
    </dialog>`;

  const dialog = container.querySelector('#user-dialog');
  const body = container.querySelector('#users-body');
  const loading = container.querySelector('#users-loading');
  const empty = container.querySelector('#users-empty');
  const tableWrap = container.querySelector('#users-table-wrap');
  const count = container.querySelector('#users-count');
  const feedback = container.querySelector('#user-form-feedback');
  const submitButton = container.querySelector('#user-submit');
  const permissionsRoot = container.querySelector('#user-permissions');

  function toast(message, type = 'success') {
    const element = container.querySelector('#users-toast');
    element.textContent = message;
    element.dataset.type = type;
    element.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.hidden = true; }, 6000);
  }

  function showFeedback(message) {
    feedback.textContent = message;
    feedback.hidden = false;
  }

  function clearFeedback() {
    feedback.textContent = '';
    feedback.hidden = true;
  }

  function renderRows() {
    const filtered = filterUsers(state.users, state.filters);
    count.textContent = `${filtered.length} usuário${filtered.length === 1 ? '' : 's'}`;
    empty.hidden = filtered.length !== 0;
    tableWrap.hidden = filtered.length === 0;

    body.innerHTML = filtered.map((user) => `
      <tr>
        <td>
          <div class="users-person">
            <span class="users-avatar" aria-hidden="true">${escapeHtml(initials(user))}</span>
            <span>
              <strong>${escapeHtml(user.name || 'Sem nome')}</strong>
              <small>${escapeHtml(user.email || '—')}</small>
            </span>
          </div>
        </td>
        <td><span class="badge ${user.active === true ? 'ok' : 'muted'}">${user.active === true ? 'Ativo' : 'Inativo'}</span></td>
        <td>${escapeHtml(formatDate(user.lastAccessAt))}</td>
        <td class="users-actions-cell">
          ${capabilities.canUpdate ? `
            <div class="users-row-actions">
              <button class="link-button" type="button" data-action="edit" data-user-id="${escapeHtml(user.uid || user.id)}">Editar</button>
              <button class="link-button" type="button" data-action="password" data-user-id="${escapeHtml(user.uid || user.id)}">Redefinir senha</button>
              <button class="link-button ${user.active === true ? 'danger-link' : ''}" type="button" data-action="status" data-user-id="${escapeHtml(user.uid || user.id)}">${user.active === true ? 'Inativar' : 'Reativar'}</button>
            </div>
          ` : '<span class="muted-text">Somente leitura</span>'}
        </td>
      </tr>
    `).join('');
  }

  async function refresh() {
    loading.hidden = false;
    empty.hidden = true;
    tableWrap.hidden = true;
    try {
      state.users = await loadUsers();
      renderRows();
    } catch (error) {
      toast(error?.message || 'Não foi possível carregar os usuários.', 'error');
      empty.textContent = 'Não foi possível carregar os usuários.';
      empty.hidden = false;
    } finally {
      loading.hidden = true;
    }
  }

  function setPermissions(levels) {
    if (!permissionsRoot) return;
    permissionsRoot.innerHTML = permissionFields(levels);
  }

  async function openUserDialog(user = null) {
    state.editingUser = user;
    clearFeedback();
    container.querySelector('#user-dialog-title').textContent = user ? 'Editar usuário' : 'Novo usuário';
    container.querySelector('#user-dialog-subtitle').textContent = user
      ? 'Atualize os dados e acessos deste usuário.'
      : 'Cadastre a pessoa e defina seus acessos.';
    container.querySelector('#user-name').value = user?.name || '';
    const emailInput = container.querySelector('#user-email');
    emailInput.value = user?.email || '';
    emailInput.readOnly = Boolean(user);
    emailInput.setAttribute('aria-readonly', String(Boolean(user)));
    container.querySelector('#user-active-row').hidden = !user;
    container.querySelector('#user-active').checked = user?.active !== false;

    if (capabilities.canManagePermissions) {
      permissionsRoot.innerHTML = '<div class="loading permission-loading">Carregando permissões...</div>';
      try {
        setPermissions(user
          ? await loadUserPermissionLevels(user.uid || user.id)
          : getDefaultUserPermissionLevels());
      } catch (error) {
        setPermissions(getDefaultUserPermissionLevels());
        showFeedback(error?.message || 'Não foi possível carregar as permissões atuais.');
      }
    }

    dialog.showModal();
    container.querySelector('#user-name').focus();
  }

  function findUser(userId) {
    return state.users.find((user) => String(user.uid || user.id) === String(userId));
  }

  container.querySelector('#new-user')?.addEventListener('click', () => openUserDialog());
  container.querySelector('#user-dialog-close').addEventListener('click', () => dialog.close());
  container.querySelector('#user-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  container.querySelector('#user-search').addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    renderRows();
  });
  container.querySelector('#user-status').addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    renderRows();
  });

  body.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const user = findUser(button.dataset.userId);
    if (!user) return;

    try {
      if (button.dataset.action === 'edit') {
        await openUserDialog(user);
        return;
      }
      if (button.dataset.action === 'password') {
        if (!confirm(`Solicitar ao Firebase um e-mail de redefinição de senha para ${user.email}?`)) return;
        button.disabled = true;
        await requestManagedUserPasswordReset(user.email, session);
        toast(`Solicitação aceita para ${user.email}. Confira também Spam e Lixo eletrônico.`);
        return;
      }
      if (button.dataset.action === 'status') {
        const nextActive = user.active !== true;
        if (!confirm(`${nextActive ? 'Reativar' : 'Inativar'} este usuário? O histórico será preservado.`)) return;
        button.disabled = true;
        await setManagedUserActive(user.uid || user.id, nextActive, session);
        toast(nextActive ? 'Usuário reativado.' : 'Usuário inativado sem exclusão de histórico.');
        await refresh();
      }
    } catch (error) {
      toast(error?.message || 'A operação não pôde ser concluída.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  container.querySelector('#user-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFeedback();
    submitButton.disabled = true;
    const originalLabel = submitButton.textContent;
    submitButton.textContent = 'Salvando...';

    const payload = {
      name: container.querySelector('#user-name').value,
      email: container.querySelector('#user-email').value,
      active: state.editingUser ? container.querySelector('#user-active').checked : true,
      permissionLevels: capabilities.canManagePermissions ? readPermissionLevels(dialog) : undefined
    };

    try {
      if (state.editingUser) {
        await updateManagedUser(state.editingUser.uid || state.editingUser.id, payload, session);
        toast('Usuário atualizado com sucesso.');
      } else {
        const result = await createManagedUser(payload, session);
        if (result.passwordResetSent) {
          toast('Usuário criado com sucesso. O Firebase recebeu a solicitação do e-mail para definição de senha.');
        } else {
          toast(`Usuário criado, mas o e-mail de senha não foi confirmado: ${result.passwordResetError}`, 'warning');
        }
      }
      dialog.close();
      await refresh();
    } catch (error) {
      showFeedback(error?.message || 'Não foi possível salvar o usuário.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  });

  await refresh();
}
