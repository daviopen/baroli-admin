export function renderDashboard(session) {
  return `
    <section class="page-header">
      <div>
        <p class="eyebrow">Visão geral</p>
        <h1>Administração Baroli</h1>
        <p>Base administrativa compartilhada para os módulos internos da imobiliária.</p>
      </div>
    </section>
    <section class="cards">
      <article class="card"><strong>${session.profile.name ?? session.authUser.email}</strong><span>Usuário atual</span></article>
      <article class="card"><strong>${session.profile.role}</strong><span>Perfil</span></article>
      <article class="card"><strong>${session.profile.active ? 'Ativo' : 'Inativo'}</strong><span>Status</span></article>
    </section>
    <section class="panel">
      <h2>Fundação ativa</h2>
      <ul class="check-list">
        <li>Firebase Authentication</li>
        <li>Usuários com RBAC</li>
        <li>Permissões por módulo e ação</li>
        <li>Auditoria append-only no backend</li>
        <li>Firestore com deny-by-default</li>
      </ul>
    </section>`;
}
