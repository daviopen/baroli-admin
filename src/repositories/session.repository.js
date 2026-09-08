import { MODULES } from '../constants/modules.js';
import { cachedRead } from '../core/read-cache.js';
import { getFirebaseServices } from '../services/firebase.service.js';

const SESSION_READ_TTL_MS = 60_000;

export async function loadUserProfile(uid, { force = false } = {}) {
  const { db, firestoreSdk } = await getFirebaseServices();
  return cachedRead(`session:${uid}:profile`, async () => {
    const ref = firestoreSdk.doc(db, 'users', uid);
    const snap = await firestoreSdk.getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }, { ttlMs: SESSION_READ_TTL_MS, force });
}

export async function loadOwnPermissions(uid, { force = false } = {}) {
  const { db, firestoreSdk } = await getFirebaseServices();
  return cachedRead(`session:${uid}:permissions`, async () => {
    const base = Object.fromEntries(MODULES.map(({ id }) => [id, 'NONE']));
    const q = firestoreSdk.query(
      firestoreSdk.collection(db, 'permissions'),
      firestoreSdk.where('userId', '==', uid)
    );
    const snap = await firestoreSdk.getDocs(q);
    for (const item of snap.docs) {
      const data = item.data();
      const moduleId = String(data.module || '');
      if (!Object.prototype.hasOwnProperty.call(base, moduleId)) continue;
      const level = String(data.level || '').toUpperCase();
      base[moduleId] = ['READ', 'EDIT'].includes(level) ? level : 'NONE';
    }
    return base;
  }, { ttlMs: SESSION_READ_TTL_MS, force });
}
