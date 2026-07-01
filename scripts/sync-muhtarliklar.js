/**
 * Manuel muhtarlık senkronu — belediye API'sine yalnızca bu script (veya Cloud Function) erişir.
 *
 * Kurulum:
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key
 *   2. set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccount.json
 *   3. cd functions && npm install
 *   4. node ../scripts/sync-muhtarliklar.js
 */
const admin = require('firebase-admin');
const { syncMuhtarliklarToFirestore } = require('../functions/lib/muhtarlikSync');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GCLOUD_PROJECT || 'kadro-org',
    });
}

syncMuhtarliklarToFirestore(admin.firestore(), admin)
    .then((result) => {
        console.log('Senkron tamam:', result);
        process.exit(0);
    })
    .catch((err) => {
        console.error('Senkron hatası:', err);
        process.exit(1);
    });
