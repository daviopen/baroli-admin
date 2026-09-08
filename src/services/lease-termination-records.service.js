import { cachedRead, invalidateReadCache } from '../core/read-cache.js';
import { getFirebaseServices } from './firebase.service.js';

const COLLECTION = 'leaseTerminations';
const LIST_LIMIT = 150;
const LIST_TTL_MS = 60_000;

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

function invalidateTerminationReads() {
  invalidateReadCache('lease-terminations:list', 'lease-termination:options', 'tasks:refs');
}

export async function listLeaseTerminations({ includeDeleted = false, force = false } = {}) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre novamente.');
  const uid = auth.currentUser.uid;
  return cachedRead(`lease-terminations:list:${uid}:${includeDeleted ? 'all' : 'active'}`, async () => {
    const { collection, getDocs, query, orderBy, limit } = firestoreSdk;
    const q = query(collection(db, COLLECTION), orderBy('updatedAt', 'desc'), limit(LIST_LIMIT));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((item) => normalizeRecord(item.id, item.data()))
      .filter((item) => includeDeleted || !item.deletedAt);
  }, { ttlMs: LIST_TTL_MS, force });
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
  invalidateTerminationReads();
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
  invalidateTerminationReads();
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
  invalidateTerminationReads();
}
