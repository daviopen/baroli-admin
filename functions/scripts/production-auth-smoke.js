const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const crypto = require('node:crypto');

const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
const apiKey = String(process.env.FIREBASE_API_KEY || '').trim();

if (!projectId || !apiKey) {
  throw new Error('FIREBASE_PROJECT_ID e FIREBASE_API_KEY são obrigatórios para o smoke de autenticação.');
}

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const email = `baroli.auth.smoke.${suffix}@example.com`;
const password = `Aa1!${crypto.randomBytes(24).toString('base64url')}`;
const displayName = 'Baroli Auth Smoke';
let uid = null;

function firestoreDocumentUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`;
}

async function signInWithPassword() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Login e-mail/senha falhou em produção: ${response.status} ${payload?.error?.message || 'erro desconhecido'}`);
  }
  if (!payload.idToken || payload.localId !== uid) {
    throw new Error('Firebase Authentication retornou uma sessão inválida para o usuário temporário.');
  }
  return payload.idToken;
}

async function fetchFirestore(path, idToken) {
  return fetch(firestoreDocumentUrl(path), {
    headers: idToken ? { authorization: `Bearer ${idToken}` } : {}
  });
}

async function assertProfileReadable(idToken) {
  const response = await fetchFirestore(`users/${encodeURIComponent(uid)}`, idToken);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Perfil autenticado não pôde ser lido: HTTP ${response.status}.`);
  }

  const fields = payload.fields || {};
  if (fields.email?.stringValue !== email || fields.active?.booleanValue !== true || fields.role?.stringValue !== 'USER') {
    throw new Error('Perfil retornado pelo Firestore não corresponde ao usuário temporário ativo.');
  }
}

async function assertAnonymousProfileBlocked() {
  const response = await fetchFirestore(`users/${encodeURIComponent(uid)}`, null);
  if (response.status !== 403) {
    throw new Error(`Leitura anônima deveria ser bloqueada com 403, mas retornou ${response.status}.`);
  }
}

async function assertActiveGate(idToken) {
  const probePath = 'settings/production-auth-smoke';

  const activeResponse = await fetchFirestore(probePath, idToken);
  if (![200, 404].includes(activeResponse.status)) {
    throw new Error(`Usuário ativo não passou pelo gate de autorização de settings: HTTP ${activeResponse.status}.`);
  }

  await db.collection('users').doc(uid).update({
    active: false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'PRODUCTION_AUTH_SMOKE'
  });

  const inactiveResponse = await fetchFirestore(probePath, idToken);
  if (inactiveResponse.status !== 403) {
    throw new Error(`Usuário inativo deveria ser bloqueado com 403, mas retornou ${inactiveResponse.status}.`);
  }
}

async function run() {
  try {
    const authUser = await auth.createUser({
      email,
      password,
      displayName,
      disabled: false,
      emailVerified: true
    });
    uid = authUser.uid;

    const now = FieldValue.serverTimestamp();
    await db.collection('users').doc(uid).set({
      uid,
      name: displayName,
      email,
      role: 'USER',
      active: true,
      createdAt: now,
      createdBy: 'PRODUCTION_AUTH_SMOKE',
      updatedAt: now,
      updatedBy: 'PRODUCTION_AUTH_SMOKE',
      lastAccessAt: null
    });

    const idToken = await signInWithPassword();
    await assertProfileReadable(idToken);
    await assertAnonymousProfileBlocked();
    await assertActiveGate(idToken);

    console.log('✅ Usuário temporário criado, login real validado, perfil carregado e bloqueio de usuário inativo confirmado.');
  } finally {
    if (uid) {
      await Promise.allSettled([
        db.collection('users').doc(uid).delete(),
        auth.deleteUser(uid)
      ]);
      console.log('🧹 Usuário temporário removido do Firebase Auth e do Firestore.');
    }
  }
}

run().catch((error) => {
  console.error(`❌ Smoke de autenticação em produção falhou: ${error.message}`);
  process.exitCode = 1;
});
