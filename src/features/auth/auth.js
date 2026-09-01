import { getFirebaseServices } from '../../services/firebase.service.js';
import { clearSession, hydrateSession, recordLogin, recordLogout } from '../../services/session.service.js';

const EMBEDDED_BROWSER_PATTERN = /(FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Twitter|LinkedInApp|Snapchat|; wv\)|\bwv\b)/i;
const MOBILE_USER_AGENT_PATTERN = /(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile)/i;
const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported'
]);

async function useLocalPersistence(auth, authSdk) {
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
}

function navigatorUserAgent(navigatorLike) {
  return String(navigatorLike?.userAgent ?? '');
}

function isIpadOs(navigatorLike) {
  return Boolean(
    navigatorLike
    && navigatorLike.platform === 'MacIntel'
    && Number(navigatorLike.maxTouchPoints || 0) > 1
  );
}

export function isMobileBrowser(navigatorLike = globalThis.navigator) {
  if (!navigatorLike) return false;
  if (navigatorLike.userAgentData && typeof navigatorLike.userAgentData.mobile === 'boolean') {
    return navigatorLike.userAgentData.mobile || isIpadOs(navigatorLike);
  }
  return MOBILE_USER_AGENT_PATTERN.test(navigatorUserAgent(navigatorLike)) || isIpadOs(navigatorLike);
}

export function isEmbeddedBrowser(navigatorLike = globalThis.navigator) {
  return EMBEDDED_BROWSER_PATTERN.test(navigatorUserAgent(navigatorLike));
}

export function googleAuthStrategy(navigatorLike = globalThis.navigator) {
  if (isEmbeddedBrowser(navigatorLike)) return 'external-browser';
  return isMobileBrowser(navigatorLike) ? 'redirect' : 'popup';
}

export function isPopupFallbackError(error) {
  return POPUP_FALLBACK_CODES.has(String(error?.code ?? '').trim().toLowerCase());
}

export function friendlyAuthError(error) {
  const messages = {
    'auth/account-exists-with-different-credential': 'Este e-mail já está vinculado a outra forma de acesso.',
    'auth/app-not-authorized': 'Este aplicativo não está autorizado a usar o Firebase Authentication.',
    'auth/cancelled-popup-request': 'A tentativa anterior de login foi substituída. Tente novamente.',
    'auth/embedded-browser': 'Este navegador interno pode bloquear o acesso com Google. Abra o sistema no Chrome ou Safari e tente novamente.',
    'auth/internal-error': 'O Firebase Authentication retornou uma falha interna. Tente novamente em instantes.',
    'auth/invalid-api-key': 'A configuração de autenticação da aplicação está inválida.',
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/invalid-login-credentials': 'E-mail ou senha inválidos.',
    'auth/invalid-email': 'Informe um endereço de e-mail válido.',
    'auth/missing-password': 'Informe sua senha.',
    'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet.',
    'auth/operation-not-allowed': 'Este método de acesso ainda não foi habilitado no Firebase.',
    'auth/operation-not-supported-in-this-environment': 'Este navegador não suporta o fluxo de login atual. Tente abrir no Chrome ou Safari.',
    'auth/popup-blocked': 'O navegador bloqueou a janela de login. Tentaremos continuar pelo redirecionamento.',
    'auth/popup-closed-by-user': 'O login foi cancelado.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    'auth/unauthorized-domain': 'Este endereço ainda não foi autorizado no Firebase Authentication.',
    'auth/user-disabled': 'Esta conta está desativada.',
    'auth/user-not-found': 'E-mail ou senha inválidos.',
    'auth/web-storage-unsupported': 'O navegador bloqueou o armazenamento necessário para a autenticação. Tente abrir no Chrome ou Safari.',
    'auth/wrong-password': 'E-mail ou senha inválidos.'
  };
  return messages[error?.code] || 'Não foi possível concluir a autenticação. Tente novamente.';
}

function createGoogleProvider(authSdk) {
  const provider = new authSdk.GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

async function redirectWithGoogle(auth, authSdk, provider) {
  await authSdk.signInWithRedirect(auth, provider);
  return null;
}

export async function signInWithGoogle() {
  const { auth, authSdk } = await getFirebaseServices();
  await useLocalPersistence(auth, authSdk);
  const provider = createGoogleProvider(authSdk);
  const strategy = googleAuthStrategy(globalThis.navigator);

  if (strategy === 'external-browser') {
    const error = new Error('EMBEDDED_BROWSER');
    error.code = 'auth/embedded-browser';
    throw error;
  }

  if (strategy === 'redirect') {
    return redirectWithGoogle(auth, authSdk, provider);
  }

  try {
    return await authSdk.signInWithPopup(auth, provider);
  } catch (error) {
    if (!isPopupFallbackError(error)) throw error;
    console.info(`[Auth] popup indisponível (${error.code}); continuando com redirect.`);
    return redirectWithGoogle(auth, authSdk, provider);
  }
}

export async function signInWithEmail(email, password) {
  const { auth, authSdk } = await getFirebaseServices();
  await useLocalPersistence(auth, authSdk);
  return authSdk.signInWithEmailAndPassword(auth, String(email || '').trim(), password);
}

export async function sendPasswordReset(email) {
  const { auth, authSdk } = await getFirebaseServices();
  auth.languageCode = 'pt-BR';
  return authSdk.sendPasswordResetEmail(auth, String(email || '').trim());
}

export async function signOutSafely() {
  const { auth, authSdk } = await getFirebaseServices();
  try {
    await recordLogout();
  } catch {
    // Logout não deve ser bloqueado por falha de auditoria/rede.
  } finally {
    clearSession();
    await authSdk.signOut(auth);
  }
}

export async function watchAuth(onReady, onSignedOut, onBlocked, onAuthError = () => {}) {
  const { auth, authSdk } = await getFirebaseServices();
  auth.useDeviceLanguage();

  // Mesmo contrato do louvor-ide: o retorno de redirect é consumido no bootstrap
  // e o estado final continua sendo decidido pelo observador de autenticação.
  void authSdk.getRedirectResult(auth).catch((error) => {
    console.warn(`[Auth] retorno de autenticação: ${error?.code || 'auth/unknown'}`);
    onAuthError(error);
  });

  return authSdk.onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearSession();
      onSignedOut();
      return;
    }

    let hydrated;
    try {
      hydrated = await hydrateSession(user);
    } catch (error) {
      clearSession();
      await authSdk.signOut(auth).catch(() => null);
      onBlocked(error);
      return;
    }

    // Assim como no louvor-ide, último acesso é best-effort e não participa
    // da decisão de autenticação/autorização. Evita escrita repetida quando a
    // sessão já foi hidratada nesta aba.
    if (!hydrated.hydratedFromCache) {
      void recordLogin().catch((error) => {
        console.warn('Não foi possível registrar o último acesso do usuário.', error);
      });
    }

    onReady(hydrated.session);
  });
}
