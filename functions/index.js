const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { syncMuhtarliklarToFirestore } = require('./lib/muhtarlikSync');
const { claimMuhtarlikKp, isModeratorEmail } = require('./lib/muhtarlikKp');

admin.initializeApp();
const db = admin.firestore();

function toHttpsError(error) {
    const code = error.code;
    if (code === 'unauthenticated') return new HttpsError('unauthenticated', error.message);
    if (code === 'invalid-argument') return new HttpsError('invalid-argument', error.message);
    if (code === 'not-found') return new HttpsError('not-found', error.message);
    if (code === 'already-exists') return new HttpsError('already-exists', error.message);
    if (code === 'failed-precondition') return new HttpsError('failed-precondition', error.message);
    return new HttpsError('internal', error.message || 'Sunucu hatası');
}

// Muhtarlık verisi yalnızca moderatör panelinden manuel güncellenir (syncMuhtarliklarManual).
exports.syncMuhtarliklarManual = onCall({
    timeoutSeconds: 540,
    memory: '512MiB',
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş gerekli.');
    if (!isModeratorEmail(request.auth.token.email)) {
        throw new HttpsError('permission-denied', 'Yalnızca moderatör çalıştırabilir.');
    }
    const result = await syncMuhtarliklarToFirestore(db, admin);
    return result;
});

exports.claimMuhtarlikKp = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş gerekli.');
    const lat = request.data?.lat;
    const lng = request.data?.lng;
    try {
        return await claimMuhtarlikKp(db, admin, request.auth, lat, lng);
    } catch (error) {
        throw toHttpsError(error);
    }
});
