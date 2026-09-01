import { hasPermission } from '../../core/authorization.js';
import { listUsers, callAdminFunction } from '../../repositories/admin.repository.js';
import { getCurrentSession } from '../../services/session.service.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

export async function renderUsers(container) {
  const session = getCurrentSession();
  const users = await listUsers();
  const canCreate = hasPermission(session, 'users', 'CREATE');
  const canUpdate = hasPermission(session, 'users', 'UPDATE');

  container.innerHTML = `
    <section class="page-header row-between">
      <div><p class="eyebrow">Administração</p><h1>Usuários</h1><p>Contas, perfis e status de acesso.</p></div>
      ${canCreate ? '<button class="primary" id="new-user">Novo usuário</button>' : ''}
    </section>
    <section class="panel table-wrap">
      <table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
      <tbody>${users.map((user) => `
        <tr>
          <td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role)}</td>
          <td><span class="badge ${user.active ? 'ok' : 'muted'}">${user.active ? 'Ativo' : 'Inativo'}</span></td>
          <td>${canUpdate ? `<button class="link-button edit-user" data-id="${user.uid}">Editar</button>` : ''}</td>
        </tr>`).join('')}</tbody></table>
    </section>`;

  container.querySelector('#new-user')?.addEventListener('click', async () => {
    const name = prompt('Nome do usuário:');
    if (!name) return;
    const email = prompt('E-mail:');
    if (!email) return;
    const temporaryPassword = prompt('Senha temporária (mínimo 12 caracteres):');
    if (!temporaryPassword) return;
    try {
      await callAdminFunction('adminCreateUser', { name, email, temporaryPassword, role: 'USER' });
      await renderUsers(container);
    } catch (error) {
      alert(error.message ?? 'Não foi possível criar o usuário.');
    }
  });

  container.querySelectorAll('.edit-user').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = users.find((item) => item.uid === button.dataset.id);
      const active = confirm(`${user.active ? 'Desativar' : 'Ativar'} ${user.name}?`)
        ? !user.active
        : user.active;
      if (active === user.active) return;
      try {
        await callAdminFunction('adminUpdateUser', { userId: user.uid, active });
        await renderUsers(container);
      } catch (error) {
        alert(error.message ?? 'Não foi possível atualizar o usuário.');
      }
    });
  });
}
