const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || undefined });
const db = getFirestore();

function legacyActionsToLevel(actions) {
  if (!Array.isArray(actions)) return 'NONE';
  if (actions.some((action) => ['CREATE', 'UPDATE', 'DELETE'].includes(action))) return 'EDIT';
  return actions.includes('READ') ? 'READ' : 'NONE';
}

async function commitOperations(operations) {
  if (!operations.length) return;
  const batch = db.batch();
  for (const operation of operations) {
    if (operation.type === 'delete') {
      batch.delete(operation.ref);
    } else {
      batch.update(operation.ref, operation.patch);
    }
  }
  await batch.commit();
}

async function main() {
  const snapshot = await db.collection('permissions').get();
  let migrated = 0;
  let removed = 0;
  let operations = [];

  for (const document of snapshot.docs) {
    const data = document.data();
    const currentLevel = String(data.level || '').toUpperCase();
    const hasCanonicalLevel = ['READ', 'EDIT'].includes(currentLevel);
    const hasLegacyActions = Array.isArray(data.actions);

    if (!hasLegacyActions) continue;

    if (hasCanonicalLevel) {
      operations.push({
        type: 'update',
        ref: document.ref,
        patch: {
          actions: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        }
      });
      migrated += 1;
    } else {
      const level = legacyActionsToLevel(data.actions);
      if (level === 'NONE') {
        operations.push({ type: 'delete', ref: document.ref });
        removed += 1;
      } else {
        operations.push({
          type: 'update',
          ref: document.ref,
          patch: {
            level,
            actions: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp()
          }
        });
        migrated += 1;
      }
    }

    if (operations.length >= 400) {
      await commitOperations(operations);
      operations = [];
    }
  }

  await commitOperations(operations);
  console.log(`Migração de permissões concluída: ${migrated} documento(s) convertido(s), ${removed} removido(s) como NONE.`);
}

main().catch((error) => {
  console.error('Falha na migração de permissões:', error?.message || error);
  process.exitCode = 1;
});
