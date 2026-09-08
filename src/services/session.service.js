import { loadOwnPermissions, loadUserProfile } from '../repositories/session.repository.js';
import { getFirebaseServices } from './firebase.service.js';

const AUTHORIZATION_CACHE_KEY = 'baroliAuthorizationSession';
const LAST_ACCESS_SESSION_KEY = 'baroliLastAccessSession';
const AUTHORIZATION_CACHE_VERSION = 2;
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

function lastAccessFingerprint(authUser) {
  if (!authUser?.uid) return '';
  const lastSignInTime = authUser.metadata?.lastSignInTime || authUser.metadata?.lastLoginAt || '';
  return `${authUser.uid}:${lastSignInTime}`;
}

function readLastAccessFingerprint() {
  try {
    return globalThis.sessionStorage?.getItem(LAST_ACCESS_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

function writeLastAccessFingerprint(authUser) {
  try {
    const fingerprint = lastAccessFingerprint(authUser);
    if (fingerprint) globalThis.sessionStorage?.setItem(LAST_ACCESS_SESSION_KEY, fingerprint);
  } catch {
    // Falha no storage não deve impedir o acesso ao sistema.
  }
}

function clearLastAccessFingerprint() {
  try {
    globalThis.sessionStorage?.removeItem(LAST_ACCESS_SESSION_KEY);
  } catch {
    // noop
  }
}

export function shouldRecordLastAccess(authUser, profile = currentSession?.profile) {
  if (!authUser?.uid) return false;
  if (!profile?.lastAccessAt) return true;
  const fingerprint = lastAccessFingerprint(authUser);
  if (!fingerprint) return true;
  return readLastAccessFingerprint() !== fingerprint;
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
  clearLastAccessFingerprint();
}

export async function recordLastAccess(authUser = currentSession?.authUser) {
  if (!authUser?.uid) return;
  const { db, firestoreSdk } = await getFirebaseServices();
  const ref = firestoreSdk.doc(db, 'users', authUser.uid);
  await firestoreSdk.updateDoc(ref, { lastAccessAt: firestoreSdk.serverTimestamp() });
  writeLastAccessFingerprint(authUser);
}

export async function recordLogin() {
  return recordLastAccess();
}

export async function recordLogout() {
  // Mantido como contrato da camada de sessão. O IDE Music não depende de backend
  // para logout; auditoria privilegiada poderá ser adicionada quando Functions estiverem ativas.
  return { skipped: true };
}

export { AUTHORIZATION_CACHE_KEY, LAST_ACCESS_SESSION_KEY };
