import { loadOwnProfile, updateOwnProfile } from '../repositories/profile.repository.js';
import { getFirebaseServices } from './firebase.service.js';
import { getCurrentSession } from './session.service.js';

function normalizeText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function validateBirthDate(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('Informe uma data de nascimento válida.');
  const date = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(date.getTime()) || date > new Date()) throw new Error('Informe uma data de nascimento válida.');
  return normalized;
}

export function normalizeProfileInput(input = {}) {
  const name = normalizeText(input.name, 120);
  if (name.length < 2) throw new Error('Informe seu nome completo.');
  return {
    name,
    phone: normalizeText(input.phone, 30),
    birthDate: validateBirthDate(input.birthDate),
    photoURL: String(input.photoURL || '').trim().slice(0, 2048)
  };
}

export function authProviderState(authUser = getCurrentSession()?.authUser) {
  const providers = new Set((authUser?.providerData || []).map((item) => item?.providerId).filter(Boolean));
  return {
    hasPassword: providers.has('password'),
    hasGoogle: providers.has('google.com'),
    googlePhotoURL: (authUser?.providerData || []).find((item) => item?.providerId === 'google.com')?.photoURL || ''
  };
}

export async function loadMyProfile() {
  const session = getCurrentSession();
  if (!session?.authUser?.uid) throw new Error('Sessão não encontrada.');
  const profile = await loadOwnProfile(session.authUser.uid);
  if (!profile) throw new Error('Perfil não encontrado.');
  return profile;
}

export async function saveMyProfile(input) {
  const session = getCurrentSession();
  if (!session?.authUser?.uid) throw new Error('Sessão não encontrada.');
  const normalized = normalizeProfileInput(input);
  const changes = await updateOwnProfile(session.authUser.uid, normalized);
  session.profile = { ...session.profile, ...changes };
  return { ...session.profile, ...changes };
}

export async function changeMyPassword(currentPassword, newPassword, confirmation) {
  if (String(newPassword || '') !== String(confirmation || '')) throw new Error('A confirmação da nova senha não confere.');
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(newPassword || ''))) {
    throw new Error('A nova senha deve ter ao menos 8 caracteres, com maiúscula, minúscula e número.');
  }

  const { auth, authSdk } = await getFirebaseServices();
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Conta de acesso não encontrada.');
  if (!authProviderState(user).hasPassword) throw new Error('Esta conta não utiliza senha local.');

  const credential = authSdk.EmailAuthProvider.credential(user.email, String(currentPassword || ''));
  await authSdk.reauthenticateWithCredential(user, credential);
  await authSdk.updatePassword(user, String(newPassword));
}
