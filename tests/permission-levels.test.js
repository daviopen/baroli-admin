import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIONS, MODULES } from '../src/constants/modules.js';
import {
  DEFAULT_USER_PERMISSION_LEVELS,
  actionsToPermissionLevel,
  buildPermissionLevels,
  buildPermissionPayload,
  permissionLevelToActions
} from '../src/features/permissions/permission-levels.js';

test('permission levels map to the Baroli CRUD action model', () => {
  assert.deepEqual(permissionLevelToActions('NONE'), []);
  assert.deepEqual(permissionLevelToActions('READ'), ['READ']);
  assert.deepEqual(permissionLevelToActions('EDIT'), [...ACTIONS]);
});

test('technical action arrays collapse to Louvor-style levels', () => {
  assert.equal(actionsToPermissionLevel([]), 'NONE');
  assert.equal(actionsToPermissionLevel(['READ']), 'READ');
  assert.equal(actionsToPermissionLevel(['READ', 'UPDATE']), 'EDIT');
  assert.equal(actionsToPermissionLevel(['CREATE']), 'EDIT');
});

test('new users default to dashboard read and no access elsewhere', () => {
  for (const { id } of MODULES) {
    assert.equal(DEFAULT_USER_PERMISSION_LEVELS[id], id === 'dashboard' ? 'READ' : 'NONE');
  }
});

test('payload and levels round-trip consistently', () => {
  const levels = Object.fromEntries(MODULES.map(({ id }, index) => [
    id,
    index % 3 === 0 ? 'EDIT' : index % 3 === 1 ? 'READ' : 'NONE'
  ]));
  assert.deepEqual(buildPermissionLevels(buildPermissionPayload(levels)), levels);
});
