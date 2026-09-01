import { MODULES } from '../constants/modules.js';
import { getFirebaseServices } from '../services/firebase.service.js';

export async function loadUserProfile(uid) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const ref = firestoreSdk.doc(db, 'users', uid);
  const snap = await firestoreSdk.getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function loadOwnPermissions(uid) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const entries = await Promise.all(
    MODULES.map(async ({ id }) => {
      const ref = firestoreSdk.doc(db, 'permissions', `${uid}__${id}`);
      const snap = await firestoreSdk.getDoc(ref);
      if (!snap.exists()) return [id, 'NONE'];
      const data = snap.data();
      const level = String(data.level || '').toUpperCase();
      return [id, ['READ', 'EDIT'].includes(level) ? level : 'NONE'];
    })
  );
  return Object.fromEntries(entries);
}
