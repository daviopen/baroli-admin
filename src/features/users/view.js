import { USER_PROFILES, getUserProfileDefinition, normalizeUserProfile } from '../permissions/permission-levels.js';
import { getCurrentSession } from '../../services/session.service.js';
import {
  createManagedUser,
  filterUsers,
  getPermissionLevelsForProfile,
  getUserManagementCapabilities,
  loadUsers,
  requestManagedUserPasswordReset,
  setManagedUserActive,
  updateManagedUser
} from '../../services/user-admin.service.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formatDate(value) {
  if (!value) return 'Nunca acessou';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function initials(user) {
  const source = String(user?.name || user?.email || '?').trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function userProfileId(user) {
  return normalizeUserProfile(user?.profileType || (user?.role === 'SUPER_ADMIN' ? 'ADM_SUPER' : 'CORRETOR'));
}

function profileOptions(selectedProfile) {
  return Object.values(USER_PROFILES).map((profile) => `
    <label class="profile-option ${selectedProfile === profile.id ? 'is-selected' : ''}" data-profile-card="${profile.id}">
      <input type="radio" name="profileType" value="${profile.id}" ${selectedProfile === profile.id ? 'checked' : ''}>
      <span class="profile-option__content">
        <span class="profile-option__topline">
          <strong>${escapeHtml(profile.label)}</strong>
          <span class="profile-check" aria-hidden="true">✓</span>
        </span>
        <small>${escapeHtml(profile.description)}</small>
      </span>
    </label>
  `).join('');
}

export async function renderUsers(container) {
  const session = getCurrentSession();
  const capabilities = getUserManagementCapabilities(session);
  const state = {
    users: [],
    filters: { search: '', status: 'ALL', profile: 'ALL' },
    editingUser: null
  };

  container.innerHTML = `
    <section class="page-header users-page-header">
      <div>
        <p class="eyebrow">Administração</p>
        <h1>Usuários e acessos</h1>
        <p>Cadastre a equipe e defina o perfil de trabalho de cada usuário.</p>
      </div>
      ${capabilities.canCreate ? '<button class="primary users-new-button" id="new-user" type="button">+ Novo usuário</button>' : ''}
    </section>

    <section class="users-summary" aria-label="Resumo de usuários">
      <article class="users-summary-card"><span>Total</span><strong id="summary-total">0</strong><small>usuários cadastrados</small></article>
      <article class="users-summary-card"><span>Ativos</span><strong id="summary-active">0</strong><small>com acesso liberado</small></article>
      <article class="users-summary-card"><span>Perfis</span><strong>4</strong><small>modelos de acesso</small></article>
    </section>

    <section class="panel users-toolbar users-toolbar--louvor" aria-label="Filtros de usuários">
      <label class="field users-search">Buscar<input id="user-search" type="search" placeholder="Nome ou e-mail" autocomplete="off"></label>
      <label class="field">Perfil<select id="user-profile-filter"><option value="ALL">Todos</option>${Object.values(USER_PROFILES).map((profile) => `<option value="${profile.id}">${escapeHtml(profile.label)}</option>`).join('')}</select></label>
      <label class="field">Status<select id="user-status"><option value="ALL">Todos</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option></select></label>
      <div class="users-count" id="users-count" aria-live="polite"></div>
    </section>

    <section class="panel users-panel">
      <div id="users-loading" class="loading">Carregando usuários...</div>
      <div id="users-empty" class="empty-state" hidden>Nenhum usuário encontrado.</div>
      <div class="table-wrap" id="users-table-wrap" hidden>
        <table class="users-table users-table--louvor">
          <thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th><span class="sr-only">Ações</span></th></tr></thead>
          <tbody id="users-body"></tbody>
        </table>
      </div>
    </section>

    <div class="toast" id="users-toast" role="status" aria-live="polite" hidden></div>

    <dialog class="admin-dialog user-editor-dialog" id="user-dialog" aria-labelledby="user-dialog-title">
      <form id="user-form">
        <div class="dialog-header user-editor-header">
          <div>
            <p class="eyebrow">Equipe Baroli</p>
            <h2 id="user-dialog-title">Novo usuário</h2>
            <p id="user-dialog-subtitle">Dados pessoais e perfil de acesso em um único cadastro.</p>
          </div>
          <button class="dialog-close" id="user-dialog-close" type="button" aria-label="Fechar">×</button>
        </div>

        <div class="dialog-body user-editor-body">
          <section class="user-editor-section" aria-labelledby="user-data-title">
            <div class="section-heading">
              <span class="section-step">1</span>
              <div><h3 id="user-data-title">Dados pessoais</h3><p>Informações principais da pessoa que terá acesso ao sistema.</p></div>
            </div>
            <div class="form-grid user-personal-grid">
              <label class="field form-span-2">Nome completo<input id="user-name" name="name" maxlength="160" required autocomplete="name" placeholder="Ex.: Marina Oliveira"></label>
              <label class="field form-span-2">E-mail de acesso<input id="user-email" name="email" type="email" maxlength="320" required autocomplete="email" placeholder="nome@baroliimoveis.com.br"><small>O e-mail de login não pode ser alterado após o cadastro.</small></label>
              <label class="switch-field form-span-2 user-access-switch" id="user-active-row" hidden>
                <span><strong>Acesso ao sistema</strong><small>Desative para bloquear o login sem apagar histórico ou dados.</small></span>
                <input id="user-active" type="checkbox" checked>
              </label>
            </div>
          </section>

          ${capabilities.canManagePermissions ? `
          <section class="user-editor-section" aria-labelledby="user-profile-title">
            <div class="section-heading">
              <span class="section-step">2</span>
              <div><h3 id="user-profile-title">Perfil de acesso</h3><p>Escolha o perfil que melhor representa a função da pessoa na Baroli. Os acessos são definidos automaticamente pelo perfil.</p></div>
            </div>
            <div class="profile-options" id="user-profile-options"></div>
          </section>` : `
          <section class="user-editor-section"><div class="section-heading"><span class="section-step">2</span><div><h3>Perfil de acesso</h3><p>Somente ADM-SUPER pode alterar o perfil de acesso.</p></div></div></section>`}

          <div class="form-feedback" id="user-form-feedback" role="alert" hidden></div>
        </div>

        <div class="dialog-actions user-editor-actions">
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
  const profileRoot = container.querySelector('#user-profile-options');

  function toast(message, type = 'success') {
    const element = container.querySelector('#users-toast');
    element.textContent = message;
    element.dataset.type = type;
    element.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.hidden = true; }, 6000);
  }

  function showFeedback(message) { feedback.textContent = message; feedback.hidden = false; }
  function clearFeedback() { feedback.textContent = ''; feedback.hidden = true; }

  function updateSummary() {
    container.querySelector('#summary-total').textContent = state.users.length;
    container.querySelector('#summary-active').textContent = state.users.filter((user) => user.active === true).length;
  }

  function renderRows() {
    const filtered = filterUsers(state.users, state.filters);
    count.textContent = `${filtered.length} usuário${filtered.length === 1 ? '' : 's'}`;
    empty.hidden = filtered.length !== 0;
    tableWrap.hidden = filtered.length === 0;

    body.innerHTML = filtered.map((user) => {
      const profile = getUserProfileDefinition(userProfileId(user));
      return `
      <tr>
        <td><div class="users-person"><span class="users-avatar" aria-hidden="true">${escapeHtml(initials(user))}</span><span><strong>${escapeHtml(user.name || 'Sem nome')}</strong><small>${escapeHtml(user.email || '—')}</small></span></div></td>
        <td><span class="profile-badge profile-badge--${profile.id.toLowerCase()}">${escapeHtml(profile.label)}</span></td>
        <td><span class="badge ${user.active === true ? 'ok' : 'muted'}">${user.active === true ? 'Ativo' : 'Inativo'}</span></td>
        <td>${escapeHtml(formatDate(user.lastAccessAt))}</td>
        <td class="users-actions-cell">${capabilities.canUpdate ? `<div class="users-row-actions"><button class="link-button" type="button" data-action="edit" data-user-id="${escapeHtml(user.uid || user.id)}">Editar</button><button class="link-button" type="button" data-action="password" data-user-id="${escapeHtml(user.uid || user.id)}">Redefinir senha</button><button class="link-button ${user.active === true ? 'danger-link' : ''}" type="button" data-action="status" data-user-id="${escapeHtml(user.uid || user.id)}">${user.active === true ? 'Inativar' : 'Reativar'}</button></div>` : '<span class="muted-text">Somente leitura</span>'}</td>
      </tr>`;
    }).join('');
  }

  async function refresh() {
    loading.hidden = false;
    empty.hidden = true;
    tableWrap.hidden = true;
    try {
      state.users = await loadUsers();
      updateSummary();
      renderRows();
    } catch (error) {
      toast(error?.message || 'Não foi possível carregar os usuários.', 'error');
      empty.textContent = 'Não foi possível carregar os usuários.';
      empty.hidden = false;
    } finally {
      loading.hidden = true;
    }
  }

  function selectedProfile() {
    return profileRoot?.querySelector('input[name="profileType"]:checked')?.value || 'CORRETOR';
  }

  function setProfileCards(profileId) {
    if (!profileRoot) return;
    profileRoot.innerHTML = profileOptions(profileId);
  }

  function openUserDialog(user = null) {
    state.editingUser = user;
    clearFeedback();
    container.querySelector('#user-dialog-title').textContent = user ? 'Editar usuário' : 'Novo usuário';
    container.querySelector('#user-dialog-subtitle').textContent = user ? 'Atualize os dados pessoais e o perfil de acesso.' : 'Cadastre a pessoa e defina seu perfil de acesso à Baroli.';
    container.querySelector('#user-name').value = user?.name || '';
    const emailInput = container.querySelector('#user-email');
    emailInput.value = user?.email || '';
    emailInput.readOnly = Boolean(user);
    emailInput.setAttribute('aria-readonly', String(Boolean(user)));
    container.querySelector('#user-active-row').hidden = !user;
    container.querySelector('#user-active').checked = user?.active !== false;

    if (capabilities.canManagePermissions) {
      setProfileCards(user ? userProfileId(user) : 'CORRETOR');
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
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

  container.querySelector('#user-search').addEventListener('input', (event) => { state.filters.search = event.target.value; renderRows(); });
  container.querySelector('#user-status').addEventListener('change', (event) => { state.filters.status = event.target.value; renderRows(); });
  container.querySelector('#user-profile-filter').addEventListener('change', (event) => { state.filters.profile = event.target.value; renderRows(); });

  profileRoot?.addEventListener('change', (event) => {
    const input = event.target.closest('input[name="profileType"]');
    if (!input) return;
    profileRoot.querySelectorAll('[data-profile-card]').forEach((card) => {
      card.classList.toggle('is-selected', card.dataset.profileCard === input.value);
    });
  });

  body.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const user = findUser(button.dataset.userId);
    if (!user) return;

    try {
      if (button.dataset.action === 'edit') {
        openUserDialog(user);
        return;
      }
      if (button.dataset.action === 'password') {
        if (!confirm(`Enviar e-mail de redefinição de senha para ${user.email}?`)) return;
        button.disabled = true;
        await requestManagedUserPasswordReset(user.email, session);
        toast(`E-mail de redefinição solicitado para ${user.email}.`);
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

    const profileType = capabilities.canManagePermissions ? selectedProfile() : undefined;
    const payload = {
      name: container.querySelector('#user-name').value,
      email: container.querySelector('#user-email').value,
      active: state.editingUser ? container.querySelector('#user-active').checked : true,
      profileType,
      permissionLevels: profileType ? getPermissionLevelsForProfile(profileType) : undefined
    };

    try {
      if (state.editingUser) {
        await updateManagedUser(state.editingUser.uid || state.editingUser.id, payload, session);
        toast('Usuário atualizado com sucesso.');
      } else {
        const result = await createManagedUser(payload, session);
        toast(
          result.passwordResetSent
            ? 'Usuário criado. O e-mail para definição de senha foi solicitado.'
            : `Usuário criado, mas o e-mail de senha não foi confirmado: ${result.passwordResetError}`,
          result.passwordResetSent ? 'success' : 'warning'
        );
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
