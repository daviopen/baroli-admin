import { cachedRead, invalidateReadCache } from '../core/read-cache.js';
import { getFirebaseServices } from '../services/firebase.service.js';

const EDITABLE_PROFILE_FIELDS = Object.freeze(['name', 'phone', 'birthDate', 'photoURL']);
const PROFILE_TTL_MS = 60_000;

function sanitizeProfileUpdate(input = {}) {
  return Object.fromEntries(
    EDITABLE_PROFILE_FIELDS
      .filter((key) => Object.prototype.hasOwnProperty.call(input, key))
      .map((key) => [key, typeof input[key] === 'string' ? input[key].trim() : input[key]])
  );
}

export async function loadOwnProfile(uid, { force = false } = {}) {
  if (!uid) throw new Error('Usuário não identificado.');
  const { db, firestoreSdk } = await getFirebaseServices();
  return cachedRead(`profile:${uid}`, async () => {
    const ref = firestoreSdk.doc(db, 'users', uid);
    const snapshot = await firestoreSdk.getDoc(ref);
    return snapshot.exists() ? { uid, ...snapshot.data() } : null;
  }, { ttlMs: PROFILE_TTL_MS, force });
}

export async function updateOwnProfile(uid, input) {
  if (!uid) throw new Error('Usuário não identificado.');
  const changes = sanitizeProfileUpdate(input);
  if (!Object.keys(changes).length) return changes;

  const { db, firestoreSdk } = await getFirebaseServices();
  const ref = firestoreSdk.doc(db, 'users', uid);
  await firestoreSdk.updateDoc(ref, {
    ...changes,
    updatedAt: firestoreSdk.serverTimestamp()
  });
  invalidateReadCache(`profile:${uid}`, `session:${uid}:profile`, 'users:list');
  return changes;
}

export { EDITABLE_PROFILE_FIELDS, sanitizeProfileUpdate };
