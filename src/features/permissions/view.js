import { ACTIONS, MODULES } from '../../constants/modules.js';
import { callAdminFunction, getUserPermissions, listUsers } from '../../repositories/admin.repository.js';

export async function renderPermissions(container) {
  const users = await listUsers();
  container.innerHTML = `
    <section class="page-header"><p class="eyebrow">Segurança</p><h1>Permissões</h1><p>Matriz por usuário, módulo e ação.</p></section>
    <section class="panel">
      <label class="field">Usuário<select id="permission-user">
        <option value="">Selecione...</option>
        ${users.map((user) => `<option value="${user.uid}">${user.name} — ${user.email}</option>`).join('')}
      </select></label>
      <div id="permission-matrix" class="empty-state">Selecione um usuário.</div>
    </section>`;

  const select = container.querySelector('#permission-user');
  const matrix = container.querySelector('#permission-matrix');

  select.addEventListener('change', async () => {
    if (!select.value) { matrix.innerHTML = 'Selecione um usuário.'; return; }
    const permissions = await getUserPermissions(select.value);
    matrix.innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Módulo</th>${ACTIONS.map((a) => `<th>${a}</th>`).join('')}</tr></thead>
      <tbody>${MODULES.map((module) => `<tr><td>${module.label}</td>${ACTIONS.map((action) => `
        <td><input type="checkbox" data-module="${module.id}" data-action="${action}" ${permissions[module.id]?.includes(action) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="actions"><button class="primary" id="save-permissions">Salvar permissões</button></div>`;

    matrix.querySelector('#save-permissions').addEventListener('click', async () => {
      const payload = {};
      MODULES.forEach(({ id }) => { payload[id] = []; });
      matrix.querySelectorAll('input[type="checkbox"]:checked').forEach((checkbox) => {
        payload[checkbox.dataset.module].push(checkbox.dataset.action);
      });
      try {
        await callAdminFunction('adminSetPermissions', { userId: select.value, permissions: payload });
        alert('Permissões atualizadas.');
      } catch (error) {
        alert(error.message ?? 'Não foi possível salvar as permissões.');
      }
    });
  });
}
