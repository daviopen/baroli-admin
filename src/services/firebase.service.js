import { firebaseConfig, functionsRegion, hasFirebaseConfig } from '../config/firebase.js';

const SDK_VERSION = '12.18.0';
const base = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

let servicesPromise;

export async function getFirebaseServices() {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase ainda não configurado. Preencha as variáveis FIREBASE_* antes do build.');
  }

  if (!servicesPromise) {
    servicesPromise = Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`),
      import(`${base}/firebase-functions.js`)
    ]).then(([appSdk, authSdk, firestoreSdk, functionsSdk]) => {
      const app = appSdk.initializeApp(firebaseConfig);
      return {
        app,
        auth: authSdk.getAuth(app),
        db: firestoreSdk.getFirestore(app),
        functions: functionsSdk.getFunctions(app, functionsRegion),
        authSdk,
        firestoreSdk,
        functionsSdk
      };
    });
  }

  return servicesPromise;
}
