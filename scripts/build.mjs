import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });
await mkdir(path.join(dist, 'config'), { recursive: true });

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY ?? '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.FIREBASE_APP_ID ?? '',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID ?? ''
};

const functionsEnabled = /^(1|true|yes)$/i.test(process.env.FIREBASE_FUNCTIONS_ENABLED ?? 'false');

const runtime = {
  firebase: firebaseConfig,
  functionsRegion: process.env.FIREBASE_FUNCTIONS_REGION ?? 'southamerica-east1',
  functionsEnabled
};

await writeFile(
  path.join(dist, 'config', 'runtime-config.js'),
  `window.BAROLI_CONFIG = ${JSON.stringify(runtime, null, 2)};\n`,
  'utf8'
);

console.log('Build concluído em dist/.');
