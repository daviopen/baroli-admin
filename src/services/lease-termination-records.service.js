import { getFirebaseServices } from './firebase.service.js';

const COLLECTION = 'leaseTerminations';

function clean(value) {
  return String(value ?? '').trim();
}

function plainTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return value;
}

function normalizeRecord(id, data) {
  return {
    id,
    ...data,
    createdAt: plainTimestamp(data.createdAt),
    updatedAt: plainTimestamp(data.updatedAt),
    deletedAt: plainTimestamp(data.deletedAt)
  };
}

export async function listLeaseTerminations({ includeDeleted = false } = {}) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre novamente.');
  const { collection, getDocs } = firestoreSdk;
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map((item) => normalizeRecord(item.id, item.data()))
    .filter((item) => includeDeleted || !item.deletedAt)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

export async function getLeaseTermination(id) {
  if (!clean(id)) return null;
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre novamente.');
  const { doc, getDoc } = firestoreSdk;
  const snapshot = await getDoc(doc(db, COLLECTION, id));
  return snapshot.exists() ? normalizeRecord(snapshot.id, snapshot.data()) : null;
}

export async function saveLeaseTermination({ id = '', lease, input, calculation, notes = '', status = 'CALCULADA' }) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');
  if (!lease?.id) throw new Error('Selecione uma locação válida antes de salvar.');
  if (!calculation) throw new Error('Calcule a rescisão antes de salvar.');

  const { collection, doc, setDoc, serverTimestamp } = firestoreSdk;
  const ref = clean(id) ? doc(db, COLLECTION, clean(id)) : doc(collection(db, COLLECTION));
  const payload = {
    leaseId: lease.id,
    contractNumber: clean(lease.contractNumber),
    propertyId: clean(lease.propertyId || lease.property?.id),
    propertyReference: clean(lease.property?.reference || lease.propertyReference),
    propertyLabel: clean(lease.propertyLabel || input.property),
    landlordName: clean(lease.landlordName || input.landlord),
    tenantName: clean(lease.tenantName || input.tenant),
    terminationDate: clean(input.terminationDate),
    contractStart: clean(input.contractStart),
    contractEnd: clean(input.contractEnd),
    monthlyRent: Number(input.monthlyRent || 0),
    status,
    result: calculation.result,
    finalBalance: Number(calculation.finalBalance || 0),
    input,
    calculation,
    notes: clean(notes),
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  };

  if (!clean(id)) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = user.uid;
  }

  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function updateLeaseTerminationStatus(id, status) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');
  const { doc, updateDoc, serverTimestamp } = firestoreSdk;
  await updateDoc(doc(db, COLLECTION, id), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
}

export async function deleteLeaseTermination(id) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');
  const { doc, updateDoc, serverTimestamp } = firestoreSdk;
  await updateDoc(doc(db, COLLECTION, id), {
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
}
