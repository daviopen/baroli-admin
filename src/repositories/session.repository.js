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
      return [id, snap.exists() ? (snap.data().actions ?? []) : []];
    })
  );
  return Object.fromEntries(entries);
}
