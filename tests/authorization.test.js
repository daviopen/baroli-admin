import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, normalizeActions } from '../src/core/authorization.js';

test('SUPER_ADMIN ativo possui acesso integral', () => {
  const session = { profile: { active: true, role: 'SUPER_ADMIN' }, permissions: {} };
  assert.equal(hasPermission(session, 'users', 'DELETE'), true);
});

test('usuário inativo nunca possui acesso', () => {
  const session = {
    profile: { active: false, role: 'SUPER_ADMIN' },
    permissions: { users: ['READ', 'UPDATE'] }
  };
  assert.equal(hasPermission(session, 'users', 'READ'), false);
});

test('ACL explícita respeita módulo e ação', () => {
  const session = {
    profile: { active: true, role: 'USER' },
    permissions: { users: ['READ'] }
  };
  assert.equal(hasPermission(session, 'users', 'READ'), true);
  assert.equal(hasPermission(session, 'users', 'UPDATE'), false);
});

test('normalização remove duplicados e ações inválidas', () => {
  assert.deepEqual(normalizeActions(['READ', 'READ', 'ROOT', 'UPDATE']), ['READ', 'UPDATE']);
});
