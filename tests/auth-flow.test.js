import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  friendlyAuthError,
  googleAuthStrategy,
  isPopupFallbackError
} from '../src/features/auth/auth.js';

const authSource = await readFile(new URL('../src/features/auth/auth.js', import.meta.url), 'utf8');
const sessionSource = await readFile(new URL('../src/services/session.service.js', import.meta.url), 'utf8');
const rulesSource = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const appCssSource = await readFile(new URL('../src/styles/app.css', import.meta.url), 'utf8');

test('Google login segue o modelo responsivo do louvor-ide', () => {
  assert.match(authSource, /setPersistence\(auth, authSdk\.browserLocalPersistence\)/);
  assert.match(authSource, /signInWithPopup\(auth, provider\)/);
  assert.match(authSource, /signInWithRedirect\(auth, provider\)/);
  assert.match(authSource, /getRedirectResult\(auth\)/);
});

test('desktop usa popup e mobile usa redirect', () => {
  assert.equal(googleAuthStrategy({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'popup');
  assert.equal(googleAuthStrategy({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile)' }), 'redirect');
  assert.equal(googleAuthStrategy({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile' }), 'redirect');
});

test('navegador embutido orienta abertura no navegador externo', () => {
  assert.equal(googleAuthStrategy({ userAgent: 'Mozilla/5.0 Instagram 350.0 Android' }), 'external-browser');
  assert.match(friendlyAuthError({ code: 'auth/embedded-browser' }), /Chrome ou Safari/);
});

test('falhas de popup compatíveis acionam fallback para redirect', () => {
  assert.equal(isPopupFallbackError({ code: 'auth/popup-blocked' }), true);
  assert.equal(isPopupFallbackError({ code: 'auth/web-storage-unsupported' }), true);
  assert.equal(isPopupFallbackError({ code: 'auth/network-request-failed' }), false);
});

test('views ocultas não participam do layout durante troca login/app', () => {
  assert.match(indexSource, /id="login-view"[^>]*hidden/);
  assert.match(indexSource, /id="app-view"[^>]*hidden/);
  assert.match(appCssSource, /\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important/);
});

test('Hosting e Firebase Auth usam a mesma origem para evitar storage cross-site', () => {
  assert.match(indexSource, /alignHostingOriginWithFirebaseAuthDomain/);
  assert.match(indexSource, /window\.location\.hostname !== authDomain/);
  assert.match(indexSource, /window\.location\.replace\(target\)/);
  assert.match(indexSource, /firebaseapp\.com/);
  assert.match(indexSource, /web\.app/);
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
