import { MODULES } from '../../constants/modules.js';
import { isSuperAdmin } from '../../core/authorization.js';
import { getCurrentSession } from '../../services/session.service.js';
import {
  loadUserPermissionLevels,
  loadUsers,
  saveUserAccess
} from '../../services/user-admin.service.js';

const LEVELS = Object.freeze([
  ['NONE', 'Sem acesso'],
  ['READ', 'Leitura'],
  ['EDIT', 'Edição']
]);

const ROLES = Object.freeze([
  ['USER', 'Usuário'],
  ['ADMIN', 'Administrador']
]);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function normalizeLevel(value) {
  const level = String(value || '').toUpperCase();
  return LEVELS.some(([candidate]) => candidate === level) ? level : 'NONE';
}

function normalizeRole(value) {
  const role = String(value || 'USER').toUpperCase();
  return ['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role) ? role : 'USER';
}

function userOption(user) {
  const suffix = user.active === false ? ' · Inativo' : '';
  const role = normalizeRole(user.role);
  const roleLabel = role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'ADMIN' ? 'Admin' : 'Usuário';
  return `<option value="${escapeHtml(user.uid || user.id)}">${escapeHtml(user.name || user.email || 'Sem nome')} · ${escapeHtml(user.email || '')} · ${roleLabel}${suffix}</option>`;
}

function renderEditor(root, user, permissions, editable) {
  if (!user) {
    root.innerHTML = `
      <div class="permissions-empty-card">
        <div class="permissions-empty-icon" aria-hidden="true">🛡️</div>
        <h3>Selecione um usuário</h3>
        <p>O perfil e as permissões da pessoa escolhida aparecerão aqui.</p>
      </div>`;
    return;
  }

  const userId = user.uid || user.id;
  const role = normalizeRole(user.role);
  const lockedSuperAdmin = role === 'SUPER_ADMIN';
  const roleControl = lockedSuperAdmin
    ? '<select id="permission-role" data-original-role="SUPER_ADMIN" disabled><option value="SUPER_ADMIN" selected>Super Admin</option></select>'
    : `<select id="permission-role" data-original-role="${role}" ${editable ? '' : 'disabled'}>${ROLES.map(([value, label]) => `<option value="${value}" ${role === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;

  root.innerHTML = `
    <article class="permissions-user-card" data-user-id="${escapeHtml(userId)}" data-user-name="${escapeHtml(user.name || user.email || 'Usuário')}">
      <header class="permissions-user-header">
        <div class="users-person">
          <span class="users-avatar" aria-hidden="true">${escapeHtml((user.name || user.email || '?').trim().slice(0, 2).toUpperCase())}</span>
          <span>
            <strong>${escapeHtml(user.name || 'Sem nome')}</strong>
            <small>${escapeHtml(user.email || '')}</small>
          </span>
        </div>
        ${user.active === false ? '<span class="badge muted">Inativo</span>' : ''}
      </header>

      <div class="permissions-section-heading">
        <strong>Perfil administrativo</strong>
        <span>O perfil define o alcance da ação; as permissões abaixo definem em quais módulos ela pode acontecer.</span>
      </div>
      <div class="permissions-access-grid permissions-access-grid--role">
        <label class="permission-card">
          <span class="permission-card__label">Perfil</span>
          ${roleControl}
          <small>${lockedSuperAdmin ? 'O perfil Super Admin é protegido.' : 'Administrador pode atuar nos módulos em que também possuir Edição.'}</small>
        </label>
      </div>

      <div class="permissions-section-heading">
        <strong>Acessos aos módulos</strong>
        <span>Edição inclui leitura, mas não transforma um Usuário em Administrador.</span>
      </div>
      <div class="permissions-access-grid">
        ${MODULES.map(({ id, label }) => {
          const current = normalizeLevel(permissions[id]);
          return `
            <label class="permission-card">
              <span class="permission-card__label">${escapeHtml(label)}</span>
              <select data-permission-module="${escapeHtml(id)}" data-original="${current}" ${editable ? '' : 'disabled'}>
                ${LEVELS.map(([level, text]) => `<option value="${level}" ${current === level ? 'selected' : ''}>${text}</option>`).join('')}
              </select>
            </label>`;
        }).join('')}
      </div>

      ${editable ? `
        <footer class="permissions-user-footer">
          <span>As alterações só serão aplicadas depois da revisão.</span>
          <button id="permissions-save" class="primary" type="button">Revisar alterações</button>
        </footer>` : ''}
    </article>`;
}

function collectChanges(root) {
  const card = root.querySelector('[data-user-id]');
  if (!card) return [];
  const changes = [];
  const roleSelect = card.querySelector('#permission-role');
  if (roleSelect && !roleSelect.disabled) {
    const before = normalizeRole(roleSelect.dataset.originalRole);
    const after = normalizeRole(roleSelect.value);
    if (before !== after) changes.push({ type: 'ROLE', before, after });
  }
  card.querySelectorAll('[data-permission-module]').forEach((select) => {
    const before = normalizeLevel(select.dataset.original);
    const after = normalizeLevel(select.value);
    if (before !== after) changes.push({ type: 'PERMISSION', module: select.dataset.permissionModule, before, after });
  });
  return changes;
}

function renderDiff(changes) {
  if (!changes.length) return '<p>Nenhuma alteração pendente.</p>';
  const moduleLabels = Object.fromEntries(MODULES.map(({ id, label }) => [id, label]));
  const levelLabels = Object.fromEntries(LEVELS);
  const roleLabels = { USER: 'Usuário', ADMIN: 'Administrador', SUPER_ADMIN: 'Super Admin' };
  return `<ul class="permissions-diff">${changes.map((change) => change.type === 'ROLE'
    ? `<li><strong>Perfil</strong>: ${escapeHtml(roleLabels[change.before])} → <strong>${escapeHtml(roleLabels[change.after])}</strong></li>`
    : `<li><strong>${escapeHtml(moduleLabels[change.module])}</strong>: ${escapeHtml(levelLabels[change.before])} → <strong>${escapeHtml(levelLabels[change.after])}</strong></li>`).join('')}</ul>`;
}

function currentUserIdFromUrl() {
  return new URLSearchParams(location.search).get('userId') || '';
}

function writeUserIdToUrl(userId) {
  const url = new URL(location.href);
  if (userId) url.searchParams.set('userId', userId);
  else url.searchParams.delete('userId');
  history.replaceState({}, '', url);
}

export async function renderPermissions(container) {
  const session = getCurrentSession();
  const editable = isSuperAdmin(session?.profile);
  const users = await loadUsers();
  let selectedUser = null;

  container.innerHTML = `
    <section class="page-header">
      <p class="eyebrow">Segurança</p>
      <h1>Permissões</h1>
      <p>Defina o perfil administrativo e o nível de acesso da pessoa em cada módulo.</p>
    </section>

    <section class="panel permissions-admin-panel">
      ${editable ? '' : '<div class="info-banner">Você está em modo somente leitura. Apenas SUPER_ADMIN pode alterar perfis e permissões.</div>'}
      <label class="field permissions-user-picker">
        Usuário
        <select id="permission-user">
          <option value="">Selecione um usuário</option>
          ${users.map(userOption).join('')}
        </select>
      </label>
      <div id="permission-editor"></div>
      <div id="permissions-status" class="permissions-status" role="status" aria-live="polite"></div>
    </section>

    <dialog id="permissions-review" class="admin-dialog permissions-review-dialog">
      <form method="dialog">
        <div class="dialog-header">
          <div>
            <p class="eyebrow">Segurança</p>
            <h2>Confirmar alterações administrativas</h2>
            <p>Revise as mudanças antes de salvar. Perfil e permissões possuem responsabilidades diferentes.</p>
          </div>
        </div>
        <div class="dialog-body"><div id="permissions-diff"></div></div>
        <div class="dialog-actions">
          <button value="cancel" class="secondary compact">Cancelar</button>
          <button id="permissions-confirm" value="default" class="primary">Confirmar e salvar</button>
        </div>
      </form>
    </dialog>`;

  const select = container.querySelector('#permission-user');
  const editor = container.querySelector('#permission-editor');
  const status = container.querySelector('#permissions-status');
  const review = container.querySelector('#permissions-review');
  const confirmButton = container.querySelector('#permissions-confirm');

  async function showUser(userId) {
    selectedUser = users.find((user) => String(user.uid || user.id) === String(userId)) || null;
    if (!selectedUser) {
      status.textContent = '';
      renderEditor(editor, null, {}, editable);
      return;
    }
    status.textContent = 'Carregando permissões…';
    try {
      const permissions = await loadUserPermissionLevels(userId);
      status.textContent = '';
      renderEditor(editor, selectedUser, permissions, editable);
      editor.querySelector('#permissions-save')?.addEventListener('click', () => {
        const changes = collectChanges(editor);
        container.querySelector('#permissions-diff').innerHTML = renderDiff(changes);
        confirmButton.disabled = !changes.length;
        review.showModal();
      });
    } catch (error) {
      status.textContent = error?.message || 'Não foi possível carregar as permissões.';
      renderEditor(editor, selectedUser, {}, editable);
    }
  }

  select.addEventListener('change', (event) => {
    writeUserIdToUrl(event.target.value);
    void showUser(event.target.value);
  });

  review.addEventListener('close', async () => {
    if (review.returnValue !== 'default' || !selectedUser) return;
    const changes = collectChanges(editor);
    if (!changes.length) return;
    const card = editor.querySelector('[data-user-id]');
    const roleSelect = card.querySelector('#permission-role');
    const levels = Object.fromEntries([...card.querySelectorAll('[data-permission-module]')].map((permissionSelect) => [
      permissionSelect.dataset.permissionModule,
      normalizeLevel(permissionSelect.value)
    ]));
    const role = normalizeRole(roleSelect?.value || selectedUser.role);

    status.textContent = 'Salvando alterações…';
    try {
      await saveUserAccess(card.dataset.userId, role, levels, session);
      selectedUser.role = role;
      if (roleSelect && !roleSelect.disabled) roleSelect.dataset.originalRole = role;
      card.querySelectorAll('[data-permission-module]').forEach((permissionSelect) => {
        permissionSelect.dataset.original = normalizeLevel(permissionSelect.value);
      });
      status.textContent = 'Perfil e permissões atualizados com sucesso.';
    } catch (error) {
      status.textContent = error?.message || 'Não foi possível salvar as alterações.';
    }
  });

  const requestedId = currentUserIdFromUrl();
  if (requestedId && users.some((user) => String(user.uid || user.id) === requestedId)) {
    select.value = requestedId;
    await showUser(requestedId);
  } else {
    renderEditor(editor, null, {}, editable);
  }
}
