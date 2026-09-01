import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authSource = await readFile(new URL('../src/features/auth/auth.js', import.meta.url), 'utf8');
const sessionSource = await readFile(new URL('../src/services/session.service.js', import.meta.url), 'utf8');
const rulesSource = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

test('Google login segue o padrão do louvor-ide: persistência local e popup', () => {
  assert.match(authSource, /setPersistence\(auth, authSdk\.browserLocalPersistence\)/);
  assert.match(authSource, /signInWithPopup\(auth, provider\)/);
  assert.doesNotMatch(authSource, /signInWithRedirect\(/);
});

test('sessão usa cache de autorização somente como otimização de UX', () => {
  assert.match(sessionSource, /sessionStorage/);
  assert.match(sessionSource, /loadUserProfile\(authUser\.uid\)/);
});

test('último acesso é gravado diretamente no Firestore sem Cloud Function', () => {
  assert.match(sessionSource, /updateDoc\(ref, \{ lastAccessAt: firestoreSdk\.serverTimestamp\(\) \}\)/);
  assert.doesNotMatch(sessionSource, /recordSessionLogin/);
});

test('rules permitem apenas que o próprio usuário altere lastAccessAt', () => {
  assert.match(rulesSource, /affectedKeys\(\)\.hasOnly\(\['lastAccessAt'\]\)/);
  assert.match(rulesSource, /request\.resource\.data\.lastAccessAt == request\.time/);
});
