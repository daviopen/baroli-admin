const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
const targetEmail = 'davitads@gmail.com';
if (!projectId) throw new Error('FIREBASE_PROJECT_ID ausente.');

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

(async () => {
  const report = {
    email: targetEmail,
    auth: null,
    canonicalProfile: null,
    profilesByEmail: []
  };

  try {
    const user = await auth.getUserByEmail(targetEmail);
    report.auth = {
      exists: true,
      uid: user.uid,
      disabled: user.disabled,
      emailVerified: user.emailVerified,
      providers: user.providerData.map((p) => p.providerId).sort()
    };

    const canonical = await db.collection('users').doc(user.uid).get();
    report.canonicalProfile = canonical.exists
      ? {
          exists: true,
          active: canonical.get('active') === true,
          role: canonical.get('role') || null,
          email: canonical.get('email') || null
        }
      : { exists: false };
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      report.auth = { exists: false };
      report.canonicalProfile = { exists: false };
    } else {
      throw error;
    }
  }

  const matchingProfiles = await db.collection('users').where('email', '==', targetEmail).get();
  report.profilesByEmail = matchingProfiles.docs.map((doc) => ({
    uid: doc.id,
    active: doc.get('active') === true,
    role: doc.get('role') || null,
    matchesAuthUid: Boolean(report.auth?.uid && report.auth.uid === doc.id)
  }));

  console.log(JSON.stringify(report, null, 2));
})();
