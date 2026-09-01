const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'baroli-admin';
const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();

if (!email) {
  console.error('Defina BOOTSTRAP_ADMIN_EMAIL com o e-mail de uma conta já existente no Firebase Authentication.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();

(async () => {
  const existingSuperAdmins = await db.collection('users')
    .where('role', '==', 'SUPER_ADMIN')
    .where('active', '==', true)
    .limit(1)
    .get();

  if (!existingSuperAdmins.empty) {
    console.error('Bootstrap recusado: já existe um SUPER_ADMIN ativo. Use o próprio sistema para administrar usuários.');
    process.exit(2);
  }

  const authUser = await auth.getUserByEmail(email);
  const now = FieldValue.serverTimestamp();
  const profile = {
    uid: authUser.uid,
    name: authUser.displayName || email.split('@')[0],
    email,
    role: 'SUPER_ADMIN',
    active: true,
    createdAt: now,
    createdBy: authUser.uid,
    updatedAt: now,
    updatedBy: authUser.uid,
    lastAccessAt: null
  };

  const batch = db.batch();
  batch.set(db.collection('users').doc(authUser.uid), profile, { merge: false });
  batch.set(db.collection('auditLogs').doc(), {
    actorUserId: authUser.uid,
    actorUserEmail: email,
    actorUserName: profile.name,
    action: 'SUPER_ADMIN_BOOTSTRAPPED',
    entityType: 'USER',
    entityId: authUser.uid,
    createdAt: now,
    after: profile,
    reason: 'Bootstrap inicial controlado do ambiente.'
  });
  await batch.commit();

  console.log(`SUPER_ADMIN inicial configurado para ${email} (${authUser.uid}).`);
})();
