import { MODULES } from '../../constants/modules.js';
import { isSuperAdmin } from '../../core/authorization.js';
import { getCurrentSession } from '../../services/session.service.js';
import {
  loadUserPermissionLevels,
  loadUsers,
  saveUserPermissionLevels
} from '../../services/user-admin.service.js';

const LEVEL_LABELS = Object.freeze({
  NONE: 'Sem acesso',
  READ: 'Leitura',
  EDIT: 'Edição'
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function renderMatrix(levels, editable) {
  return `
    <div class="permission-level-table">
      ${MODULES.map(({ id, label }) => `
        <label class="permission-row">
          <span>
            <strong>${escapeHtml(label)}</strong>
            <small>${id}</small>
          </span>
          <select data-permission-module="${escapeHtml(id)}" ${editable ? '' : 'disabled'}>
            ${Object.entries(LEVEL_LABELS).map(([value, text]) => `
              <option value="${value}" ${levels[id] === value ? 'selected' : ''}>${text}</option>
            `).join('')}
          </select>
        </label>
      `).join('')}
    </div>`;
}

function readLevels(root) {
  return Object.fromEntries(
    [...root.querySelectorAll('[data-permission-module]')].map((select) => [
      select.dataset.permissionModule,
      select.value
    ])
  );
}

export async function renderPermissions(container) {
  const session = getCurrentSession();
  const editable = isSuperAdmin(session?.profile);
  const users = await loadUsers();

  container.innerHTML = `
    <section class="page-header">
      <p class="eyebrow">Segurança</p>
      <h1>Permissões</h1>
      <p>Controle o acesso por usuário e funcionalidade usando o mesmo modelo do Louvor IDE.</p>
    </section>

    <section class="panel permissions-admin-panel">
      <div class="permissions-selector row-between">
        <label class="field">
          Usuário
          <select id="permission-user">
            <option value="">Selecione um usuário...</option>
            ${users.map((user) => `
              <option value="${escapeHtml(user.uid || user.id)}">${escapeHtml(user.name)} — ${escapeHtml(user.email)}</option>
            `).join('')}
          </select>
        </label>
        <div class="permission-legend" aria-label="Níveis de permissão">
          <span><strong>Sem acesso</strong> oculta e bloqueia o módulo</span>
          <span><strong>Leitura</strong> permite consultar</span>
          <span><strong>Edição</strong> permite consultar, criar, alterar e excluir</span>
        </div>
      </div>

      ${editable ? '' : '<div class="info-banner">Você pode consultar esta matriz, mas somente SUPER_ADMIN pode alterá-la.</div>'}
      <div id="permission-matrix" class="empty-state">Selecione um usuário para visualizar as permissões.</div>
    </section>

    <div class="toast" id="permissions-toast" role="status" aria-live="polite" hidden></div>`;

  const select = container.querySelector('#permission-user');
  const matrix = container.querySelector('#permission-matrix');
  const toastElement = container.querySelector('#permissions-toast');

  function toast(message, type = 'success') {
    toastElement.textContent = message;
    toastElement.dataset.type = type;
    toastElement.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastElement.hidden = true; }, 6000);
  }

  select.addEventListener('change', async () => {
    if (!select.value) {
      matrix.className = 'empty-state';
      matrix.innerHTML = 'Selecione um usuário para visualizar as permissões.';
      return;
    }

    matrix.className = 'loading';
    matrix.textContent = 'Carregando permissões...';
    try {
      const levels = await loadUserPermissionLevels(select.value);
      matrix.className = '';
      matrix.innerHTML = `
        ${renderMatrix(levels, editable)}
        ${editable ? '<div class="actions"><button class="primary" id="save-permissions" type="button">Salvar permissões</button></div>' : ''}`;

      matrix.querySelector('#save-permissions')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        const originalLabel = button.textContent;
        button.textContent = 'Salvando...';
        try {
          await saveUserPermissionLevels(select.value, readLevels(matrix), session);
          toast('Permissões atualizadas com sucesso.');
        } catch (error) {
          toast(error?.message || 'Não foi possível salvar as permissões.', 'error');
        } finally {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      });
    } catch (error) {
      matrix.className = 'empty-state';
      matrix.textContent = error?.message || 'Não foi possível carregar as permissões.';
    }
  });
}
