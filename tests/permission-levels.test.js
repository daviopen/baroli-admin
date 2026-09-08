import assert from 'node:assert/strict';
import test from 'node:test';
import { MODULES, PERMISSION_LEVELS } from '../src/constants/modules.js';
import {
  DEFAULT_USER_PERMISSION_LEVELS,
  USER_PROFILES,
  buildPermissionLevels,
  buildPermissionPayload,
  getProfilePermissionLevels,
  getUserProfileDefinition,
  normalizePermissionLevel,
  normalizeUserProfile
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

test('Baroli exposes the four business profiles', () => {
  assert.deepEqual(Object.keys(USER_PROFILES), ['ADM_SUPER', 'GESTAO', 'ADMINISTRATIVO', 'CORRETOR']);
  assert.equal(normalizeUserProfile('ADM-SUPER'), 'ADM_SUPER');
  assert.equal(getUserProfileDefinition('ADM_SUPER').systemRole, 'SUPER_ADMIN');
  assert.equal(getUserProfileDefinition('GESTAO').systemRole, 'USER');
});

test('profile presets cover every active module', () => {
  for (const profile of Object.keys(USER_PROFILES)) {
    const levels = getProfilePermissionLevels(profile);
    assert.deepEqual(Object.keys(levels), MODULES.map(({ id }) => id));
  }
  assert.equal(getProfilePermissionLevels('ADM_SUPER').users, 'EDIT');
  assert.equal(getProfilePermissionLevels('CORRETOR').finance, 'NONE');
  assert.equal(getProfilePermissionLevels('ADMINISTRATIVO').leases, 'EDIT');
  assert.equal(getProfilePermissionLevels('GESTAO').finance, 'EDIT');
});

test('permissions is not a standalone module anymore', () => {
  assert.equal(MODULES.some(({ id }) => id === 'permissions'), false);
});
