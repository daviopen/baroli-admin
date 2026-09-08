import { MODULES } from './constants/modules.js';
import { canAccessModule } from './core/authorization.js';
import { hasFirebaseConfig } from './config/firebase.js';
import { renderAudit } from './features/audit/view.js';
import { friendlyAuthError, sendPasswordReset, signInWithEmail, signInWithGoogle, signOutSafely, watchAuth } from './features/auth/auth.js';
import { renderDashboard } from './features/dashboard/view.js';
import { renderClients, renderProperties, renderUploads } from './features/data-import/view.js';
import { renderLeaseTerminations } from './features/lease-termination/list.js';
import { bindLeaseTerminationPersistence } from './features/lease-termination/persistence.js';
import { renderLeaseTermination } from './features/lease-termination/view.js';
import { renderProfile } from './features/profile/view.js';
import { renderTasks } from './features/tasks/view.js';
import { renderUsers } from './features/users/view.js';

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const content = document.querySelector('#content');
const navigation = document.querySelector('#navigation');
const errorBox = document.querySelector('#login-error');
const setupWarning = document.querySelector('#setup-warning');
const sidebarProfileLink = document.querySelector('#sidebar-profile-link');
const sidebarCollapseButton = document.querySelector('#sidebar-collapse');
const mobileMenuButton = document.querySelector('#mobile-menu-button');
const mobileBackdrop = document.querySelector('#mobile-backdrop');
let session;
let uploadsInitialType = 'clients';

const ICON_PATHS = {
  dashboard: 'M4 13h6V4H4v9zm0 7h6v-4H4v4zm10 0h6v-9h-6v9zm0-16v4h6V4h-6z',
  tasks: 'M5 4h14v16H5V4zm3 4h8M8 12h5M8 16h7',
  uploads: 'M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4',
  users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm7-1a4 4 0 010 8m2-13a4 4 0 010 8',
  audit: 'M9 11l2 2 4-4M5 4h14v16H5V4zm4-2h6v4H9V2z',
  settings: 'M12 15.5A3.5 3.5 0 1012 8a3.5 3.5 0 000 7.5zM19 12a7 7 0 01-.2 1.7l2 1.6-2 3.4-2.5-1a7 7 0 01-2.9 1.7L13 22H9l-.4-2.6a7 7 0 01-2.9-1.7l-2.5 1-2-3.4 2-1.6A7 7 0 013 12a7 7 0 01.2-1.7l-2-1.6 2-3.4 2.5 1a7 7 0 012.9-1.7L9 2h4l.4 2.6a7 7 0 012.9 1.7l2.5-1 2 3.4-2 1.6A7 7 0 0119 12z',
  terminations: 'M6 3h9l4 4v14H6V3zm8 1v4h4M9 12h6M9 16h5',
  'lease-terminations': 'M5 5h14M5 10h14M5 15h9M5 20h7',
  'lease-termination': 'M12 3v18M7 7h7.5a3 3 0 010 6H9.5a3 3 0 000 6H17'
};

function navIcon(id) {
  const path = ICON_PATHS[id] || 'M12 5a7 7 0 100 14 7 7 0 000-14z';
  return `<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${path}"/></svg></span>`;
}

function treeChevron() {
  return '<span class="nav-tree-chevron" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8l4 4 4-4"/></svg></span>';
}

function navLink({ id, label }) {
  return `<a href="#/${id}" data-route="${id}" title="${label}">${navIcon(id)}<span class="nav-label">${label}</span></a>`;
}

function allowedUploadTypes() {
  return ['clients', 'properties'].filter((moduleName) => canAccessModule(session, moduleName));
}

const routes = {
  dashboard: async () => { content.innerHTML = renderDashboard(session); },
  tasks: () => renderTasks(content),
  users: () => renderUsers(content),
  audit: () => renderAudit(content),
  uploads: () => renderUploads(content, { allowedTypes: allowedUploadTypes(), initialType: uploadsInitialType }),
  clients: () => renderClients(content),
  properties: () => renderProperties(content),
  'lease-terminations': () => renderLeaseTerminations(content),
  'lease-termination': async () => {
    await renderLeaseTermination(content);
    await bindLeaseTerminationPersistence(content);
  },
  profile: () => renderProfile(content)
};

function profileInitials(profile = session?.profile, authUser = session?.authUser) {
  const source = String(profile?.name || authUser?.displayName || authUser?.email || 'U').trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

function profileLabel(profile = session?.profile) {
  if (profile?.profileType) return String(profile.profileType).replaceAll('_', '-');
  if (profile?.role === 'SUPER_ADMIN') return 'ADM-SUPER';
  return profile?.role || 'Conta';
}

function renderShellProfile(profile = session?.profile) {
  if (!session) return;
  const name = profile?.name || session.authUser?.displayName || 'Meu perfil';
  const photoURL = profile?.photoURL || session.authUser?.photoURL || '';
  const fallback = profileInitials(profile);
  document.querySelector('#shell-profile-name').textContent = name;
  document.querySelector('#shell-profile-role').textContent = profileLabel(profile);
  const avatar = document.querySelector('#shell-avatar');
  avatar.innerHTML = photoURL
    ? `<img src="${photoURL.replaceAll('"', '&quot;')}" alt="" referrerpolicy="no-referrer"><span class="sr-only">${fallback}</span>`
    : `<span id="shell-avatar-fallback">${fallback}</span>`;
  const mobileProfile = document.querySelector('#mobile-profile-link');
  mobileProfile.innerHTML = photoURL
    ? `<img src="${photoURL.replaceAll('"', '&quot;')}" alt="" referrerpolicy="no-referrer">`
    : `<span id="mobile-profile-fallback">${fallback}</span>`;
}

function setMobileMenu(open) {
  document.body.classList.toggle('shell-menu-open', open);
  mobileMenuButton?.setAttribute('aria-expanded', String(open));
  mobileMenuButton?.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}

function setSidebarCollapsed(collapsed, persist = true) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  sidebarCollapseButton?.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
  sidebarCollapseButton?.setAttribute('title', collapsed ? 'Expandir menu' : 'Recolher menu');
  if (persist) {
    try { localStorage.setItem('baroli:sidebar-collapsed', collapsed ? '1' : '0'); } catch (_) {}
  }
}

function restoreSidebarState() {
  try { setSidebarCollapsed(localStorage.getItem('baroli:sidebar-collapsed') === '1', false); }
  catch (_) { setSidebarCollapsed(false, false); }
}

function showLogin(message = '') {
  setMobileMenu(false);
  appView.hidden = true;
  loginView.hidden = false;
  errorBox.textContent = message;
}

function showApp(currentSession) {
  session = currentSession;
  loginView.hidden = true;
  appView.hidden = false;
  errorBox.textContent = '';
  restoreSidebarState();
  renderNavigation();
  renderShellProfile();
  navigate(location.hash.replace('#/', '') || 'dashboard');
}

function renderNavigation() {
  const available = MODULES.filter(({ id }) => !['clients', 'properties', 'lease-termination'].includes(id) && routes[id] && canAccessModule(session, id));
  const configIds = new Set(['users', 'audit']);
  const primaryItems = available.filter(({ id }) => !configIds.has(id)).map(({ id, label }) => ({ id, label }));
  const configItems = available.filter(({ id }) => configIds.has(id)).map(({ id, label }) => ({ id, label }));
  if (allowedUploadTypes().length) primaryItems.push({ id: 'uploads', label: 'Uploads' });

  const currentRoute = location.hash.replace('#/', '') || 'dashboard';
  const canUseTerminations = canAccessModule(session, 'lease-termination');
  const terminationOpen = ['lease-terminations', 'lease-termination'].includes(currentRoute) ? ' open' : '';
  const terminationHtml = canUseTerminations
    ? `<details class="nav-tree" data-nav-tree="terminations"${terminationOpen}><summary title="Rescisões">${navIcon('terminations')}<span class="nav-label">Rescisões</span>${treeChevron()}</summary><div class="nav-tree-children">${navLink({ id: 'lease-terminations', label: 'Consultar' })}${navLink({ id: 'lease-termination', label: 'Calcular' })}</div></details>`
    : '';

  const configOpen = configIds.has(currentRoute) ? ' open' : '';
  const configHtml = configItems.length
    ? `<details class="nav-tree" data-nav-tree="settings"${configOpen}><summary title="Configurações">${navIcon('settings')}<span class="nav-label">Configurações</span>${treeChevron()}</summary><div class="nav-tree-children">${configItems.map(navLink).join('')}</div></details>`
    : '';

  navigation.innerHTML = `${primaryItems.map(navLink).join('')}${terminationHtml}${configHtml}`;
}

async function navigate(route) {
  let requested = route === 'permissions' ? 'users' : route;
  if (requested === 'leaseTermination') {
    requested = 'lease-termination';
    history.replaceState(null, '', '#/lease-termination');
  }
  if (requested === 'clients' || requested === 'properties') {
    uploadsInitialType = requested;
    requested = 'uploads';
    history.replaceState(null, '', '#/uploads');
  }

  const target = routes[requested] ? requested : 'dashboard';
  if (route === 'permissions') history.replaceState(null, '', '#/users');
  const selfServiceRoute = target === 'profile';
  const uploadsRoute = target === 'uploads';
  const terminationRoute = ['lease-terminations', 'lease-termination'].includes(target);
  const authorized = uploadsRoute
    ? allowedUploadTypes().length > 0
    : terminationRoute
      ? canAccessModule(session, 'lease-termination')
      : canAccessModule(session, target);

  if (!selfServiceRoute && !authorized) {
    content.innerHTML = '<section class="panel"><h1>Acesso não autorizado</h1><p>Você não possui permissão para este módulo.</p></section>';
    return;
  }

  navigation.querySelectorAll('a').forEach((link) => link.classList.toggle('active', link.dataset.route === target));
  const settingsTree = navigation.querySelector('[data-nav-tree="settings"]');
  settingsTree?.classList.toggle('active', ['users', 'audit'].includes(target));
  if (settingsTree && ['users', 'audit'].includes(target)) settingsTree.open = true;
  const terminationTree = navigation.querySelector('[data-nav-tree="terminations"]');
  terminationTree?.classList.toggle('active', terminationRoute);
  if (terminationTree && terminationRoute) terminationTree.open = true;
  sidebarProfileLink?.classList.toggle('active', selfServiceRoute);
  setMobileMenu(false);
  content.innerHTML = '<div class="loading">Carregando...</div>';
  try {
    await routes[target]();
  } catch (error) {
    content.innerHTML = `<section class="panel"><h1>Não foi possível carregar</h1><p>${error.message ?? 'Erro inesperado.'}</p></section>`;
  }
}

function reportAuthFailure(context, error) {
  console.warn(`[Auth] ${context}: ${error?.code || 'auth/unknown'}`);
  showLogin(friendlyAuthError(error));
}

window.addEventListener('hashchange', () => session && navigate(location.hash.replace('#/', '')));
window.addEventListener('baroli:profile-updated', (event) => {
  if (!session) return;
  session.profile = { ...session.profile, ...(event.detail || {}) };
  renderShellProfile(session.profile);
});

sidebarCollapseButton?.addEventListener('click', () => setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));
mobileMenuButton?.addEventListener('click', () => setMobileMenu(!document.body.classList.contains('shell-menu-open')));
mobileBackdrop?.addEventListener('click', () => setMobileMenu(false));
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMobileMenu(false); });

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  try {
    await signInWithEmail(document.querySelector('#email').value, document.querySelector('#password').value);
  } catch (error) {
    reportAuthFailure('login e-mail/senha', error);
  }
});

document.querySelector('#google-login').addEventListener('click', async () => {
  errorBox.textContent = '';
  try {
    await signInWithGoogle();
  } catch (error) {
    reportAuthFailure('login Google', error);
  }
});

document.querySelector('#forgot-password').addEventListener('click', async () => {
  const email = document.querySelector('#email').value || prompt('Informe seu e-mail:');
  if (!email) return;
  try {
    await sendPasswordReset(email);
    alert('Se a conta existir, as instruções de recuperação serão enviadas.');
  } catch (error) {
    reportAuthFailure('recuperação de senha', error);
  }
});

document.querySelector('#logout').addEventListener('click', signOutSafely);

if (!hasFirebaseConfig()) {
  setupWarning.hidden = false;
  setupWarning.textContent = 'Firebase não configurado. Preencha as variáveis FIREBASE_* e execute npm run build.';
  showLogin('Ambiente ainda não configurado.');
} else {
  watchAuth(
    showApp,
    () => showLogin(),
    (error) => showLogin(error.message === 'USER_INACTIVE' ? 'Seu acesso está inativo.' : 'Sua conta ainda não está autorizada neste sistema.'),
    (error) => reportAuthFailure('retorno de autenticação', error)
  ).catch((error) => reportAuthFailure('inicialização', error));
}
