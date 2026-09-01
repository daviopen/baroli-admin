import { loadOwnPermissions, loadUserProfile } from '../repositories/session.repository.js';
import { getFirebaseServices } from './firebase.service.js';

let currentSession = null;

export function getCurrentSession() {
  return currentSession;
}

export async function hydrateSession(authUser) {
  const profile = await loadUserProfile(authUser.uid);
  if (!profile) throw new Error('USER_NOT_REGISTERED');
  if (!profile.active) throw new Error('USER_INACTIVE');

  const permissions = profile.role === 'SUPER_ADMIN'
    ? {}
    : await loadOwnPermissions(authUser.uid);

  currentSession = { authUser, profile, permissions };
  return currentSession;
}

export function clearSession() {
  currentSession = null;
}

export async function recordLogin() {
  const { functions, functionsSdk } = await getFirebaseServices();
  return functionsSdk.httpsCallable(functions, 'recordSessionLogin')({});
}

export async function recordLogout() {
  const { functions, functionsSdk } = await getFirebaseServices();
  return functionsSdk.httpsCallable(functions, 'recordSessionLogout')({});
}
