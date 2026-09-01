import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  normalizePermissionLevel,
  permissionAllowsAction
} from '../src/core/authorization.js';

test('SUPER_ADMIN ativo possui acesso integral', () => {
  const session = { profile: { active: true, role: 'SUPER_ADMIN' }, permissions: {} };
  assert.equal(hasPermission(session, 'users', 'DELETE'), true);
});

test('usuário inativo nunca possui acesso', () => {
  const session = {
    profile: { active: false, role: 'SUPER_ADMIN' },
    permissions: { users: 'EDIT' }
  };
  assert.equal(hasPermission(session, 'users', 'READ'), false);
});

test('READ permite consulta e bloqueia escrita', () => {
  const session = {
    profile: { active: true, role: 'USER' },
    permissions: { users: 'READ' }
  };
  assert.equal(hasPermission(session, 'users', 'READ'), true);
  assert.equal(hasPermission(session, 'users', 'CREATE'), false);
  assert.equal(hasPermission(session, 'users', 'UPDATE'), false);
  assert.equal(hasPermission(session, 'users', 'DELETE'), false);
});

test('EDIT inclui leitura e todas as operações de escrita', () => {
  for (const action of ['READ', 'CREATE', 'UPDATE', 'DELETE']) {
    assert.equal(permissionAllowsAction('EDIT', action), true);
  }
});

test('normalização usa somente NONE, READ e EDIT', () => {
  assert.equal(normalizePermissionLevel('read'), 'READ');
  assert.equal(normalizePermissionLevel('EDIT'), 'EDIT');
  assert.equal(normalizePermissionLevel('ROOT'), 'NONE');
});
