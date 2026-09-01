import { MODULES } from './constants/modules.js';
import { canAccessModule } from './core/authorization.js';
import { hasFirebaseConfig } from './config/firebase.js';
import { renderAudit } from './features/audit/view.js';
import { friendlyAuthError, sendPasswordReset, signInWithEmail, signInWithGoogle, signOutSafely, watchAuth } from './features/auth/auth.js';
import { renderDashboard } from './features/dashboard/view.js';
import { renderLeaseTermination } from './features/lease-termination/view.js';
import { renderPermissions } from './features/permissions/view.js';
import { renderUsers } from './features/users/view.js';

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const content = document.querySelector('#content');
const navigation = document.querySelector('#navigation');
const errorBox = document.querySelector('#login-error');
const setupWarning = document.querySelector('#setup-warning');
let session;

const routes = {
  dashboard: async () => { content.innerHTML = renderDashboard(session); },
  users: () => renderUsers(content),
  permissions: () => renderPermissions(content),
  audit: () => renderAudit(content),
  leaseTermination: () => renderLeaseTermination(content)
};

function showLogin(message = '') {
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
  navigate(location.hash.replace('#/', '') || 'dashboard');
}

function renderNavigation() {
  const available = MODULES.filter(({ id }) => routes[id] && canAccessModule(session, id));
  navigation.innerHTML = available.map(({ id, label }) => `<a href="#/${id}" data-route="${id}">${label}</a>`).join('');
}

async function navigate(route) {
  const target = routes[route] ? route : 'dashboard';
  if (!canAccessModule(session, target)) {
    content.innerHTML = '<section class="panel"><h1>Acesso não autorizado</h1><p>Você não possui permissão para este módulo.</p></section>';
    return;
  }
  navigation.querySelectorAll('a').forEach((link) => link.classList.toggle('active', link.dataset.route === target));
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
