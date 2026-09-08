import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function readRuntimeObject(source) {
  const match = source.match(/window\.BAROLI_CONFIG\s*=\s*(\{[\s\S]*\});\s*$/);
  assert.ok(match, 'runtime-config.js deve definir window.BAROLI_CONFIG');
  return JSON.parse(match[1]);
}

test('build não publica configuração de Cloud Functions', async () => {
  const source = await readFile(new URL('../dist/config/runtime-config.js', import.meta.url), 'utf8');
  const runtime = readRuntimeObject(source);

  assert.equal('functionsEnabled' in runtime, false);
  assert.equal('functionsRegion' in runtime, false);
  assert.equal(typeof runtime.firebase.projectId, 'string');
  assert.ok(runtime.firebase.projectId.length > 0, 'projectId deve existir no runtime');
});

test('build usa domínio first-party do Hosting para Firebase Auth', async () => {
  const source = await readFile(new URL('../dist/config/runtime-config.js', import.meta.url), 'utf8');
  const runtime = readRuntimeObject(source);

  assert.equal(runtime.firebase.authDomain, `${runtime.firebase.projectId}.web.app`);
});
