import { cachedRead, invalidateReadCache } from '../../core/read-cache.js';
import { getFirebaseServices } from '../../services/firebase.service.js';

const TASK_LIST_LIMIT = 200;
const TASK_LIST_TTL_MS = 45_000;
const TASK_REFERENCE_TTL_MS = 10 * 60_000;
const REFERENCE_LIMITS = Object.freeze({ users: 50, properties: 150, clients: 150, leases: 200, leaseTerminations: 100 });

export const TASK_STATUSES = Object.freeze([
  { id: 'TODO', label: 'A fazer' },
  { id: 'IN_PROGRESS', label: 'Em andamento' },
  { id: 'WAITING', label: 'Aguardando' },
  { id: 'DONE', label: 'Concluído' }
]);

export const TASK_PRIORITIES = Object.freeze([
  { id: '', label: 'Sem prioridade' },
  { id: 'LOW', label: 'Baixa' },
  { id: 'MEDIUM', label: 'Média' },
  { id: 'HIGH', label: 'Alta' },
  { id: 'URGENT', label: 'Urgente' }
]);

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function cleanChecklist(items = []) {
  return items
    .map((item, index) => ({
      id: cleanText(item.id || `item-${index + 1}`, 80),
      text: cleanText(item.text, 220),
      done: Boolean(item.done)
    }))
    .filter((item) => item.text)
    .slice(0, 40);
}

function cleanLink(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id, 180);
  if (!id) return null;
  return { id, label: cleanText(value.label, 220) };
}

function normalizedTask(input = {}) {
  const status = TASK_STATUSES.some((item) => item.id === input.status) ? input.status : 'TODO';
  const priority = TASK_PRIORITIES.some((item) => item.id === input.priority) ? input.priority : '';
  return {
    title: cleanText(input.title, 180),
    description: cleanText(input.description, 4000),
    status,
    priority,
    dueDate: cleanText(input.dueDate, 10),
    assignedTo: cleanLink(input.assignedTo),
    property: cleanLink(input.property),
    tenant: cleanLink(input.tenant),
    lease: cleanLink(input.lease),
    termination: cleanLink(input.termination),
    checklist: cleanChecklist(input.checklist),
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 8) : []
  };
}

function actorData(actor = {}) {
  return {
    actorUserId: actor?.authUser?.uid || actor?.profile?.uid || actor?.uid || actor?.id,
    actorUserEmail: actor?.authUser?.email || actor?.profile?.email || null,
    actorUserName: actor?.profile?.name || actor?.authUser?.displayName || null
  };
}

async function writeAudit(batch, db, firestoreSdk, actor, action, entityId, details = {}) {
  const actorInfo = actorData(actor);
  if (!actorInfo.actorUserId) return;
  batch.set(firestoreSdk.doc(firestoreSdk.collection(db, 'auditLogs')), {
    ...actorInfo,
    action,
    entityType: 'TASK',
    entityId,
    details,
    createdAt: firestoreSdk.serverTimestamp()
  });
}

function invalidateTaskReads() {
  invalidateReadCache('tasks:list', 'tasks:refs');
}

export async function listTasks({ force = false } = {}) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const uid = auth.currentUser?.uid || 'anonymous';
  return cachedRead(`tasks:list:${uid}`, async () => {
    const q = firestoreSdk.query(
      firestoreSdk.collection(db, 'tasks'),
      firestoreSdk.orderBy('updatedAt', 'desc'),
      firestoreSdk.limit(TASK_LIST_LIMIT)
    );
    const snap = await firestoreSdk.getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, { ttlMs: TASK_LIST_TTL_MS, force });
}

export async function createTask(input, actor) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const data = normalizedTask(input);
  if (!data.title) throw new Error('Informe o título da pendência.');
  const ref = firestoreSdk.doc(firestoreSdk.collection(db, 'tasks'));
  const actorId = actorData(actor).actorUserId;
  const batch = firestoreSdk.writeBatch(db);
  batch.set(ref, {
    ...data,
    createdAt: firestoreSdk.serverTimestamp(),
    createdBy: actorId,
    updatedAt: firestoreSdk.serverTimestamp(),
    updatedBy: actorId,
    completedAt: data.status === 'DONE' ? firestoreSdk.serverTimestamp() : null
  });
  await writeAudit(batch, db, firestoreSdk, actor, 'TASK_CREATED', ref.id, { title: data.title, status: data.status });
  await batch.commit();
  invalidateTaskReads();
  return ref.id;
}

export async function updateTask(taskId, input, actor) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const data = normalizedTask(input);
  if (!data.title) throw new Error('Informe o título da pendência.');
  const ref = firestoreSdk.doc(db, 'tasks', taskId);
  const actorId = actorData(actor).actorUserId;
  const batch = firestoreSdk.writeBatch(db);
  batch.update(ref, {
    ...data,
    updatedAt: firestoreSdk.serverTimestamp(),
    updatedBy: actorId,
    completedAt: data.status === 'DONE' ? firestoreSdk.serverTimestamp() : null
  });
  await writeAudit(batch, db, firestoreSdk, actor, 'TASK_UPDATED', taskId, { title: data.title, status: data.status });
  await batch.commit();
  invalidateTaskReads();
}

export async function updateTaskStatus(taskId, status, actor) {
  if (!TASK_STATUSES.some((item) => item.id === status)) throw new Error('Status inválido.');
  const { db, firestoreSdk } = await getFirebaseServices();
  const ref = firestoreSdk.doc(db, 'tasks', taskId);
  const actorId = actorData(actor).actorUserId;
  const patch = {
    status,
    updatedAt: firestoreSdk.serverTimestamp(),
    updatedBy: actorId,
    completedAt: status === 'DONE' ? firestoreSdk.serverTimestamp() : null
  };
  const batch = firestoreSdk.writeBatch(db);
  batch.update(ref, patch);
  await writeAudit(batch, db, firestoreSdk, actor, 'TASK_STATUS_UPDATED', taskId, { status });
  await batch.commit();
  invalidateTaskReads();
}

export async function deleteTask(taskId, actor) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const ref = firestoreSdk.doc(db, 'tasks', taskId);
  const batch = firestoreSdk.writeBatch(db);
  batch.delete(ref);
  await writeAudit(batch, db, firestoreSdk, actor, 'TASK_DELETED', taskId);
  await batch.commit();
  invalidateTaskReads();
}

export async function loadTaskReferences({ force = false } = {}) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  const uid = auth.currentUser?.uid || 'anonymous';
  return cachedRead(`tasks:refs:${uid}`, async () => {
    async function safeList(collectionName, mapper) {
      try {
        const max = REFERENCE_LIMITS[collectionName] || 100;
        const q = firestoreSdk.query(firestoreSdk.collection(db, collectionName), firestoreSdk.limit(max));
        const snap = await firestoreSdk.getDocs(q);
        return snap.docs.map((doc) => mapper(doc.id, doc.data())).filter((item) => item.label);
      } catch (_) {
        return [];
      }
    }
    const [users, properties, clients, leases, terminations] = await Promise.all([
      safeList('users', (id, data) => ({ id, label: data.name || data.email || id, active: data.active !== false })),
      safeList('properties', (id, data) => ({ id, label: data.address || data.endereco || data.code || data.codigo || data.name || id })),
      safeList('clients', (id, data) => ({ id, label: data.name || data.nome || data.email || data.cpf || id })),
      safeList('leases', (id, data) => ({ id, label: data.code || data.codigo || data.contractNumber || data.numeroContrato || data.propertyLabel || id })),
      safeList('leaseTerminations', (id, data) => ({ id, label: data.title || data.tenantName || data.clientName || data.contractCode || id }))
    ]);
    return {
      users: users.filter((item) => item.active),
      properties,
      clients,
      leases,
      terminations
    };
  }, { ttlMs: TASK_REFERENCE_TTL_MS, force });
}
