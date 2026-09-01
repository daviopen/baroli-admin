import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function readRuntimeObject(source) {
  const match = source.match(/window\.BAROLI_CONFIG\s*=\s*(\{[\s\S]*\});\s*$/);
  assert.ok(match, 'runtime-config.js deve definir window.BAROLI_CONFIG');
  return JSON.parse(match[1]);
}

test('build mantém Cloud Functions desativadas quando FIREBASE_FUNCTIONS_ENABLED=false', async () => {
  const source = await readFile(new URL('../dist/config/runtime-config.js', import.meta.url), 'utf8');
  const runtime = readRuntimeObject(source);

  assert.equal(runtime.functionsEnabled, false);
  assert.equal(typeof runtime.firebase.projectId, 'string');
  assert.ok(runtime.firebase.projectId.length > 0, 'projectId deve existir no runtime');
});
