import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authSource = await readFile(new URL('../src/features/auth/auth.js', import.meta.url), 'utf8');
const sessionSource = await readFile(new URL('../src/services/session.service.js', import.meta.url), 'utf8');

test('Google login usa redirect e não popup', () => {
  assert.match(authSource, /signInWithRedirect\(auth, provider\)/);
  assert.doesNotMatch(authSource, /signInWithPopup\(/);
});

test('auditoria de sessão não chama Functions quando backend está desabilitado', () => {
  assert.match(sessionSource, /if \(!functionsEnabled\) return/);
});
