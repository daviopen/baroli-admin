import { getFirebaseServices } from '../../services/firebase.service.js';
import { clearSession, hydrateSession, recordLogin, recordLogout } from '../../services/session.service.js';

export async function signInWithGoogle() {
  const { auth, authSdk } = await getFirebaseServices();
  const provider = new authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return authSdk.signInWithRedirect(auth, provider);
}

export async function signInWithEmail(email, password) {
  const { auth, authSdk } = await getFirebaseServices();
  return authSdk.signInWithEmailAndPassword(auth, email, password);
}

export async function sendPasswordReset(email) {
  const { auth, authSdk } = await getFirebaseServices();
  return authSdk.sendPasswordResetEmail(auth, email);
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
  return authSdk.onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearSession();
      onSignedOut();
      return;
    }

    let session;
    try {
      session = await hydrateSession(user);
    } catch (error) {
      clearSession();
      await authSdk.signOut(auth);
      onBlocked(error);
      return;
    }

    try {
      await recordLogin();
    } catch (error) {
      // Auditoria de sessão é best-effort: indisponibilidade temporária das
      // Cloud Functions ou da rede não pode invalidar uma autenticação válida.
      console.warn('Não foi possível registrar a auditoria de login.', error);
    }

    onReady(session);
  });
}
