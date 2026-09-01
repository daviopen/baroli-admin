import { loadOwnPermissions, loadUserProfile } from '../repositories/session.repository.js';
import { getFirebaseServices } from './firebase.service.js';

const AUTHORIZATION_CACHE_KEY = 'baroliAuthorizationSession';
const AUTHORIZATION_CACHE_VERSION = 1;
let currentSession = null;

function readAuthorizationCache(uid) {
  try {
    if (!globalThis.sessionStorage || !uid) return null;
    const raw = globalThis.sessionStorage.getItem(AUTHORIZATION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || cached.version !== AUTHORIZATION_CACHE_VERSION || cached.uid !== uid) return null;
    if (!cached.profile || cached.profile.active !== true) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeAuthorizationCache(uid, profile, permissions) {
  try {
    if (!globalThis.sessionStorage || !uid || !profile || profile.active !== true) return;
    globalThis.sessionStorage.setItem(AUTHORIZATION_CACHE_KEY, JSON.stringify({
      version: AUTHORIZATION_CACHE_VERSION,
      uid,
      profile,
      permissions
    }));
  } catch {
    // Cache é apenas otimização de UX; indisponibilidade de storage não bloqueia a sessão.
  }
}

function clearAuthorizationCache() {
  try {
    globalThis.sessionStorage?.removeItem(AUTHORIZATION_CACHE_KEY);
  } catch {
    // noop
  }
}

export function getCurrentSession() {
  return currentSession;
}

export async function hydrateSession(authUser) {
  const profile = await loadUserProfile(authUser.uid);
  if (!profile) throw new Error('USER_NOT_REGISTERED');
  if (!profile.active) throw new Error('USER_INACTIVE');

  const cached = readAuthorizationCache(authUser.uid);
  const canReusePermissions = Boolean(
    cached
    && cached.profile?.active === true
    && cached.profile?.role === profile.role
    && cached.permissions
    && typeof cached.permissions === 'object'
  );

  const permissions = profile.role === 'SUPER_ADMIN'
    ? {}
    : canReusePermissions
      ? cached.permissions
      : await loadOwnPermissions(authUser.uid);

  currentSession = { authUser, profile, permissions };
  writeAuthorizationCache(authUser.uid, profile, permissions);
  return { session: currentSession, hydratedFromCache: Boolean(cached) };
}

export function clearSession() {
  currentSession = null;
  clearAuthorizationCache();
}

export async function recordLastAccess(authUser = currentSession?.authUser) {
  if (!authUser?.uid) return;
  const { db, firestoreSdk } = await getFirebaseServices();
  const ref = firestoreSdk.doc(db, 'users', authUser.uid);
  await firestoreSdk.updateDoc(ref, { lastAccessAt: firestoreSdk.serverTimestamp() });
}

export async function recordLogin() {
  return recordLastAccess();
}

export async function recordLogout() {
  // Mantido como contrato da camada de sessão. O IDE Music não depende de backend
  // para logout; auditoria privilegiada poderá ser adicionada quando Functions estiverem ativas.
  return { skipped: true };
}

export { AUTHORIZATION_CACHE_KEY };
