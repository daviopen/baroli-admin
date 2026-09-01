const config = globalThis.BAROLI_CONFIG ?? {};

export const firebaseConfig = config.firebase ?? {};
export const functionsRegion = config.functionsRegion ?? 'southamerica-east1';

export function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}
