import assert from 'node:assert/strict';
import test from 'node:test';
import { MODULES, PERMISSION_LEVELS } from '../src/constants/modules.js';
import {
  DEFAULT_USER_PERMISSION_LEVELS,
  buildPermissionLevels,
  buildPermissionPayload,
  normalizePermissionLevel
} from '../src/features/permissions/permission-levels.js';

test('permission levels follow the Louvor IDE contract', () => {
  assert.deepEqual(PERMISSION_LEVELS, ['NONE', 'READ', 'EDIT']);
  assert.equal(normalizePermissionLevel('read'), 'READ');
  assert.equal(normalizePermissionLevel('edit'), 'EDIT');
  assert.equal(normalizePermissionLevel('invalid'), 'NONE');
});

test('new users default to dashboard read and no access elsewhere', () => {
  for (const { id } of MODULES) {
    assert.equal(DEFAULT_USER_PERMISSION_LEVELS[id], id === 'dashboard' ? 'READ' : 'NONE');
  }
});

test('permission payload persists levels directly without CRUD translation', () => {
  const levels = Object.fromEntries(MODULES.map(({ id }, index) => [
    id,
    index % 3 === 0 ? 'EDIT' : index % 3 === 1 ? 'READ' : 'NONE'
  ]));
  assert.deepEqual(buildPermissionPayload(levels), levels);
  assert.deepEqual(buildPermissionLevels(levels), levels);
});
