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

const ROLE_LABELS = Object.freeze({
  USER: 'Usuário',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super administrador'
});

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
  if (!value) return 'Nunca';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function initials(user) {
  const source = String(user?.name || user?.email || '?').trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

function permissionFields(levels, disabled = false) {
  return MODULES.map(({ id, label }) => {
    const selected = levels[id] || 'NONE';
    return `
      <label class="permission-card">
        <span class="permission-card__label">${escapeHtml(label)}</span>
        <select data-permission-module="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>
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
    filters: { search: '', status: 'ALL', role: 'ALL' },
    editingUser: null
  };

  container.innerHTML = `
    <section class="page-header row-between">
      <div>
        <p class="eyebrow">Administração</p>
        <h1>Usuários</h1>
        <p>Cadastre usuários, controle o acesso e acompanhe o último acesso ao sistema.</p>
      </div>
      ${capabilities.canCreate ? '<button class="primary" id="new-user" type="button">Novo usuário</button>' : ''}
    </section>

    <section class="panel users-toolbar" aria-label="Filtros de usuários">
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
      <label class="field">
        Perfil
        <select id="user-role">
          <option value="ALL">Todos</option>
          <option value="USER">Usuário</option>
          <option value="ADMIN">Administrador</option>
          <option value="SUPER_ADMIN">Super administrador</option>
        </select>
      </label>
      <div class="users-count" id="users-count" aria-live="polite"></div>
    </section>

    <section class="panel users-panel">
      <div id="users-loading" class="loading">Carregando usuários...</div>
      <div id="users-empty" class="empty-state" hidden>Nenhum usuário encontrado com os filtros selecionados.</div>
      <div class="table-wrap" id="users-table-wrap" hidden>
        <table class="users-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
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
            <p id="user-dialog-subtitle">Informe os dados e defina o nível de acesso inicial.</p>
          </div>
          <button class="dialog-close" id="user-dialog-close" type="button" aria-label="Fechar">×</button>
        </div>

        <div class="dialog-body">
          <section class="form-section" aria-labelledby="user-data-title">
            <div class="section-heading">
              <div>
                <h3 id="user-data-title">Dados do usuário</h3>
                <p>O e-mail será usado para autenticação e não poderá ser alterado depois do cadastro.</p>
              </div>
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
              <label class="field">
                Perfil
                <select id="user-profile" name="role">
                  <option value="USER">Usuário</option>
                  <option value="ADMIN">Administrador</option>
                  ${capabilities.canManagePermissions ? '<option value="SUPER_ADMIN">Super administrador</option>' : ''}
                </select>
              </label>
              <label class="switch-field" id="user-active-row" hidden>
                <span>
                  <strong>Acesso ativo</strong>
                  <small>Ao inativar, o histórico é preservado e o login fica bloqueado.</small>
                </span>
                <input id="user-active" type="checkbox" checked>
              </label>
            </div>
          </section>

          ${capabilities.canManagePermissions ? `
            <section class="form-section" aria-labelledby="user-permissions-title">
              <div class="section-heading row-between">
                <div>
                  <h3 id="user-permissions-title">Permissões por funcionalidade</h3>
                  <p>Mesmo modelo do Louvor IDE: Sem acesso, Leitura ou Edição. Edição inclui criar, alterar e excluir.</p>
                </div>
                <button class="link-button" id="permissions-readonly" type="button">Somente leitura</button>
              </div>
              <div class="permissions-grid" id="user-permissions"></div>
            </section>
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
    count.textContent = `${filtered.length} de ${state.users.length} usuário${state.users.length === 1 ? '' : 's'}`;
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
        <td><span class="badge">${escapeHtml(ROLE_LABELS[user.role] || user.role || 'Usuário')}</span></td>
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
      ? 'Atualize os dados, status e permissões deste usuário.'
      : 'Cadastre a conta e defina o acesso inicial por funcionalidade.';
    container.querySelector('#user-name').value = user?.name || '';
    const emailInput = container.querySelector('#user-email');
    emailInput.value = user?.email || '';
    emailInput.readOnly = Boolean(user);
    emailInput.setAttribute('aria-readonly', String(Boolean(user)));
    container.querySelector('#user-profile').value = user?.role || 'USER';
    const activeRow = container.querySelector('#user-active-row');
    activeRow.hidden = !user;
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

  container.querySelector('#permissions-readonly')?.addEventListener('click', () => {
    const selects = [...permissionsRoot.querySelectorAll('select')];
    const makeReadOnly = selects.some((select) => !select.disabled);
    selects.forEach((select) => { select.disabled = makeReadOnly; });
    container.querySelector('#permissions-readonly').textContent = makeReadOnly ? 'Editar permissões' : 'Somente leitura';
  });

  container.querySelector('#user-search').addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    renderRows();
  });
  container.querySelector('#user-status').addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    renderRows();
  });
  container.querySelector('#user-role').addEventListener('change', (event) => {
    state.filters.role = event.target.value;
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
        if (!confirm(`Enviar um e-mail de redefinição de senha para ${user.email}?`)) return;
        button.disabled = true;
        await requestManagedUserPasswordReset(user.email, session);
        toast(`E-mail de redefinição solicitado para ${user.email}.`);
        return;
      }
      if (button.dataset.action === 'status') {
        const nextActive = user.active !== true;
        if (!confirm(`${nextActive ? 'Reativar' : 'Inativar'} ${user.name}?`)) return;
        button.disabled = true;
        await setManagedUserActive(user.uid || user.id, nextActive, session);
        toast(nextActive ? 'Usuário reativado.' : 'Usuário inativado. O histórico foi preservado.');
        await refresh();
      }
    } catch (error) {
      toast(error?.message || 'Não foi possível concluir a operação.', 'error');
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
      role: container.querySelector('#user-profile').value,
      active: state.editingUser ? container.querySelector('#user-active').checked : true,
      permissionLevels: capabilities.canManagePermissions ? readPermissionLevels(dialog) : undefined
    };

    try {
      if (state.editingUser) {
        await updateManagedUser(state.editingUser.uid || state.editingUser.id, payload, session);
        toast('Usuário e permissões atualizados com sucesso.');
      } else {
        const result = await createManagedUser(payload, session);
        if (result.passwordResetSent) {
          toast('Usuário criado. O e-mail para definição de senha foi solicitado ao Firebase.');
        } else {
          toast(`Usuário criado, mas o e-mail de senha não foi enviado: ${result.passwordResetError}`, 'warning');
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
