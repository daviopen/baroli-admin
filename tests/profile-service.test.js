import test from 'node:test';
import assert from 'node:assert/strict';

import { authProviderState, normalizeProfileInput } from '../src/services/profile.service.js';

test('normalizeProfileInput normalizes self-service profile fields', () => {
  assert.deepEqual(
    normalizeProfileInput({
      name: '  Marina   Oliveira  ',
      phone: '  (61) 99999-9999 ',
      birthDate: '1990-05-20',
      photoURL: ' https://example.com/photo.jpg '
    }),
    {
      name: 'Marina Oliveira',
      phone: '(61) 99999-9999',
      birthDate: '1990-05-20',
      photoURL: 'https://example.com/photo.jpg'
    }
  );
});

test('normalizeProfileInput rejects invalid names and future birth dates', () => {
  assert.throws(() => normalizeProfileInput({ name: 'A' }), /nome completo/i);
  assert.throws(
    () => normalizeProfileInput({ name: 'Marina Oliveira', birthDate: '2999-01-01' }),
    /data de nascimento válida/i
  );
});

test('authProviderState reports Google and password providers', () => {
  const state = authProviderState({
    providerData: [
      { providerId: 'password' },
      { providerId: 'google.com', photoURL: 'https://example.com/google.jpg' }
    ]
  });
  assert.deepEqual(state, {
    hasPassword: true,
    hasGoogle: true,
    googlePhotoURL: 'https://example.com/google.jpg'
  });
});
