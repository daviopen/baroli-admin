import { getFirebaseServices } from '../../services/firebase.service.js';
import { clearSession, hydrateSession, recordLogin, recordLogout } from '../../services/session.service.js';

async function useLocalPersistence(auth, authSdk) {
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
}

export async function signInWithGoogle() {
  const { auth, authSdk } = await getFirebaseServices();
  await useLocalPersistence(auth, authSdk);
  const provider = new authSdk.GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });
  return authSdk.signInWithPopup(auth, provider);
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

export async function watchAuth(onReady, onSignedOut, onBlocked) {
  const { auth, authSdk } = await getFirebaseServices();
  auth.useDeviceLanguage();

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
