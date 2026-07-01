const MUHTARLIK_RADIUS_M = 50;
const MUHTARLIK_KP_REWARD = 5;
const MODERATOR_EMAIL = 'ufuk.kop33@gmail.com';
const MUHTAR_COL = 'izmir_muhtarliklar';
const CHECKIN_COL = 'kp_checkins';

const {
    normLoc,
    normMahalleKey,
    distanceMeters,
    getIstanbulParts,
    isIzmirIl,
    isMuhtarlikWindowOpen,
} = require('./geo');

async function findMuhtarlikForUser(db, ilce, neighborhood) {
    const lookupKey = normMahalleKey(ilce, neighborhood);
    const exact = await db.collection(MUHTAR_COL)
        .where('lookupKey', '==', lookupKey)
        .where('active', '==', true)
        .limit(1)
        .get();
    if (!exact.empty) return exact.docs[0];

    const ilceNorm = normLoc(ilce);
    const mahalleNorm = normLoc(neighborhood);
    const byIlce = await db.collection(MUHTAR_COL)
        .where('ilceNorm', '==', ilceNorm)
        .where('active', '==', true)
        .get();
    if (byIlce.empty) return null;

    let best = null;
    let bestScore = -1;
    for (const docSnap of byIlce.docs) {
        const m = docSnap.data().mahalleNorm || '';
        if (m === mahalleNorm) return docSnap;
        if (m.includes(mahalleNorm) || mahalleNorm.includes(m)) {
            const score = Math.min(m.length, mahalleNorm.length);
            if (score > bestScore) {
                bestScore = score;
                best = docSnap;
            }
        }
    }
    return best;
}

async function claimMuhtarlikKp(db, admin, authToken, lat, lng) {
    if (!authToken?.uid) {
        const err = new Error('Giriş yapmalısınız.');
        err.code = 'unauthenticated';
        throw err;
    }

    const now = new Date();
    if (!isMuhtarlikWindowOpen(now)) {
        const err = new Error('Konum bildirimi yalnızca Cuma 16:45–17:15 arasında açıktır.');
        err.code = 'failed-precondition';
        throw err;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const err = new Error('Geçerli bir konum alınamadı.');
        err.code = 'invalid-argument';
        throw err;
    }

    const userRef = db.collection('users').doc(authToken.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        const err = new Error('Üye kaydı bulunamadı.');
        err.code = 'failed-precondition';
        throw err;
    }
    const ud = userSnap.data();
    const il = ud.il || ud.city;
    const ilce = ud.ilce || ud.district;
    const neighborhood = ud.neighborhood;

    if (!neighborhood?.trim()) {
        const err = new Error('Kayıtlı mahalleniz yok. Önce konumlu fotoğraf ile mahallenizi atayın.');
        err.code = 'failed-precondition';
        throw err;
    }
    if (!isIzmirIl(il)) {
        const err = new Error('Muhtarlık Kadro Puanı şu an yalnızca İzmir mahalleleri için geçerlidir.');
        err.code = 'failed-precondition';
        throw err;
    }

    const muhtarDoc = await findMuhtarlikForUser(db, ilce, neighborhood);
    if (!muhtarDoc) {
        const err = new Error('Mahallenizin muhtarlık kaydı bulunamadı. Veri senkronizasyonu bekleniyor olabilir.');
        err.code = 'not-found';
        throw err;
    }
    const muhtar = muhtarDoc.data();
    const dist = distanceMeters(lat, lng, muhtar.lat, muhtar.lng);
    if (dist > MUHTARLIK_RADIUS_M) {
        const err = new Error(`Muhtarlık binasına uzaklığınız ~${Math.round(dist)} m. En fazla ${MUHTARLIK_RADIUS_M} m içinde olmalısınız.`);
        err.code = 'failed-precondition';
        throw err;
    }

    const { dateKey: fridayKey } = getIstanbulParts(now);
    const checkinId = `${authToken.uid}_${fridayKey}`;
    const checkinRef = db.collection(CHECKIN_COL).doc(checkinId);
    const existing = await checkinRef.get();
    if (existing.exists) {
        const err = new Error('Bu haftanın muhtarlık toplantısı için zaten Kadro Puanı aldınız.');
        err.code = 'already-exists';
        throw err;
    }

    await db.runTransaction(async (tx) => {
        const again = await tx.get(checkinRef);
        if (again.exists) {
            const err = new Error('Bu haftanın muhtarlık toplantısı için zaten Kadro Puanı aldınız.');
            err.code = 'already-exists';
            throw err;
        }
        tx.set(checkinRef, {
            uid: authToken.uid,
            fridayKey,
            lat,
            lng,
            distanceM: Math.round(dist),
            points: MUHTARLIK_KP_REWARD,
            muhtarlikId: muhtarDoc.id,
            ilce: muhtar.ilce,
            mahalle: muhtar.mahalle,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(userRef, {
            kadroPoints: admin.firestore.FieldValue.increment(MUHTARLIK_KP_REWARD),
        }, { merge: true });
    });

    const updated = await userRef.get();
    return {
        pointsAwarded: MUHTARLIK_KP_REWARD,
        totalPoints: updated.data()?.kadroPoints ?? MUHTARLIK_KP_REWARD,
        distanceM: Math.round(dist),
        muhtarlikAdi: muhtar.adi || '',
    };
}

function isModeratorEmail(email) {
    return (email || '').toLowerCase() === MODERATOR_EMAIL.toLowerCase();
}

module.exports = {
    MUHTARLIK_RADIUS_M,
    MUHTARLIK_KP_REWARD,
    claimMuhtarlikKp,
    isModeratorEmail,
    isMuhtarlikWindowOpen,
};
