import { getFirebaseServices } from '../services/firebase.service.js';

export async function listUsers() {
  const { db, firestoreSdk } = await getFirebaseServices();
  const q = firestoreSdk.query(firestoreSdk.collection(db, 'users'), firestoreSdk.orderBy('name'));
  const snap = await firestoreSdk.getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function listAuditLogs(limit = 100) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const q = firestoreSdk.query(
    firestoreSdk.collection(db, 'auditLogs'),
    firestoreSdk.orderBy('createdAt', 'desc'),
    firestoreSdk.limit(limit)
  );
  const snap = await firestoreSdk.getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getUserPermissions(userId) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const q = firestoreSdk.query(
    firestoreSdk.collection(db, 'permissions'),
    firestoreSdk.where('userId', '==', userId)
  );
  const snap = await firestoreSdk.getDocs(q);
  return Object.fromEntries(snap.docs.map((doc) => [doc.data().module, doc.data().actions ?? []]));
}

export async function callAdminFunction(name, payload) {
  const { functions, functionsSdk } = await getFirebaseServices();
  const callable = functionsSdk.httpsCallable(functions, name);
  const response = await callable(payload);
  return response.data;
}
