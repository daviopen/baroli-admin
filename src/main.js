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
import { renderUsers } from './features/users/view.js';

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const content = document.querySelector('#content');
const navigation = document.querySelector('#navigation');
const errorBox = document.querySelector('#login-error');
const setupWarning = document.querySelector('#setup-warning');
const sidebarProfileLink = document.querySelector('#sidebar-profile-link');
const mobileMenuButton = document.querySelector('#mobile-menu-button');
const mobileBackdrop = document.querySelector('#mobile-backdrop');
let session;
let uploadsInitialType = 'clients';

function allowedUploadTypes() {
  return ['clients', 'properties'].filter((moduleName) => canAccessModule(session, moduleName));
}

const routes = {
  dashboard: async () => { content.innerHTML = renderDashboard(session); },
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

  const primaryHtml = primaryItems.map(({ id, label }) => `<a href="#/${id}" data-route="${id}">${label}</a>`).join('');
  const currentRoute = location.hash.replace('#/', '') || 'dashboard';
  const canUseTerminations = canAccessModule(session, 'lease-termination');
  const terminationOpen = ['lease-terminations', 'lease-termination'].includes(currentRoute) ? ' open' : '';
  const terminationHtml = canUseTerminations
    ? `<details class="nav-tree" data-nav-tree="terminations"${terminationOpen}><summary><span>Rescisões</span><span class="nav-tree-chevron" aria-hidden="true">⌄</span></summary><div class="nav-tree-children"><a href="#/lease-terminations" data-route="lease-terminations">Consultar</a><a href="#/lease-termination" data-route="lease-termination">Calcular</a></div></details>`
    : '';

  const configOpen = configIds.has(currentRoute) ? ' open' : '';
  const configHtml = configItems.length
    ? `<details class="nav-tree" data-nav-tree="settings"${configOpen}><summary><span>Configurações</span><span class="nav-tree-chevron" aria-hidden="true">⌄</span></summary><div class="nav-tree-children">${configItems.map(({ id, label }) => `<a href="#/${id}" data-route="${id}">${label}</a>`).join('')}</div></details>`
    : '';

  navigation.innerHTML = `${primaryHtml}${terminationHtml}${configHtml}`;
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
  if (settingsTree && ['users', 'audit'].includes(target)) settingsTree.open = true;
  const terminationTree = navigation.querySelector('[data-nav-tree="terminations"]');
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
