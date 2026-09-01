const crypto = require('node:crypto');
const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID;
const targetEmailSha256 = String(process.env.TARGET_EMAIL_SHA256 || '').trim().toLowerCase();

if (!projectId) throw new Error('FIREBASE_PROJECT_ID não informado.');
if (!/^[a-f0-9]{64}$/.test(targetEmailSha256)) {
  throw new Error('TARGET_EMAIL_SHA256 inválido.');
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();

function emailHash(email) {
  return crypto.createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
}

async function findTargetUser() {
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const match = page.users.find((user) => user.email && emailHash(user.email) === targetEmailSha256);
    if (match) return match;
    pageToken = page.pageToken;
  } while (pageToken);
  return null;
}

async function main() {
  const target = await findTargetUser();
  if (!target) {
    throw new Error('TARGET_AUTH_USER_NOT_FOUND: faça um primeiro login no app com a conta Google alvo e execute novamente.');
  }

  const targetRef = db.collection('users').doc(target.uid);
  const targetProfile = await targetRef.get();
  if (targetProfile.exists && targetProfile.data().role === 'SUPER_ADMIN' && targetProfile.data().active === true) {
    console.log(`Bootstrap já concluído para UID ${target.uid}.`);
    return;
  }

  const activeSuperAdmins = await db.collection('users')
    .where('role', '==', 'SUPER_ADMIN')
    .where('active', '==', true)
    .limit(2)
    .get();

  if (!activeSuperAdmins.empty) {
    throw new Error('BOOTSTRAP_LOCKED: já existe SUPER_ADMIN ativo. Use a administração normal para promover outros usuários.');
  }

  if (target.disabled) await auth.updateUser(target.uid, { disabled: false });

  const now = FieldValue.serverTimestamp();
  const profile = {
    uid: target.uid,
    name: target.displayName || target.email?.split('@')[0] || 'Super Admin',
    email: target.email,
    role: 'SUPER_ADMIN',
    active: true,
    updatedAt: now,
    updatedBy: 'SYSTEM_BOOTSTRAP'
  };
  if (!targetProfile.exists) {
    profile.createdAt = now;
    profile.createdBy = 'SYSTEM_BOOTSTRAP';
    profile.lastAccessAt = null;
  }

  const batch = db.batch();
  batch.set(targetRef, profile, { merge: true });
  batch.set(db.collection('auditLogs').doc(), {
    actorUserId: 'SYSTEM_BOOTSTRAP',
    actorUserEmail: null,
    actorUserName: 'System Bootstrap',
    action: 'FIRST_SUPER_ADMIN_BOOTSTRAPPED',
    entityType: 'USER',
    entityId: target.uid,
    createdAt: now,
    details: { source: 'github-actions' }
  });
  await batch.commit();

  console.log(`Primeiro SUPER_ADMIN configurado com sucesso para UID ${target.uid}.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
