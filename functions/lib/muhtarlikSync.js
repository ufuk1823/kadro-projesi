const CKAN_RESOURCE_ID = '7d0b7f55-9ec2-4e35-91f8-0fd0aceefa18';
const CKAN_SEARCH_URL = 'https://acikveri.bizizmir.com/api/3/action/datastore_search';
const COLLECTION = 'izmir_muhtarliklar';
const META_DOC = '_sync_meta';

const { parseTrCoord, normLoc, normMahalleKey } = require('./geo');

async function fetchAllMuhtarlikRecords() {
    const all = [];
    let offset = 0;
    const limit = 500;
    while (true) {
        const url = `${CKAN_SEARCH_URL}?resource_id=${CKAN_RESOURCE_ID}&limit=${limit}&offset=${offset}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CKAN HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || 'CKAN API hatası');
        all.push(...json.result.records);
        if (all.length >= json.result.total) break;
        offset += limit;
    }
    return all;
}

function recordToDoc(record) {
    const lat = parseTrCoord(record.ENLEM);
    const lng = parseTrCoord(record.BOYLAM);
    if (lat == null || lng == null) return null;
    return {
        sourceId: record._id,
        ilce: record.ILCE || '',
        ilceId: record.ILCEID ?? null,
        mahalle: record.MAHALLE || '',
        adi: record.ADI || '',
        yol: record.YOL || '',
        kapino: record.KAPINO || '',
        aciklama: record.ACIKLAMA || '',
        lat,
        lng,
        lookupKey: normMahalleKey(record.ILCE, record.MAHALLE),
        ilceNorm: normLoc(record.ILCE),
        mahalleNorm: normLoc(record.MAHALLE),
        active: true,
        source: 'izmir_acik_veri',
    };
}

async function syncMuhtarliklarToFirestore(db, admin) {
    const records = await fetchAllMuhtarlikRecords();
    const col = db.collection(COLLECTION);
    const seenIds = new Set();
    let upserted = 0;
    let skipped = 0;
    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    async function commitBatch() {
        if (batchCount === 0) return;
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
    }

    for (const record of records) {
        const docData = recordToDoc(record);
        if (!docData) {
            skipped += 1;
            continue;
        }
        const docId = `src_${docData.sourceId}`;
        seenIds.add(String(docData.sourceId));
        batch.set(col.doc(docId), {
            ...docData,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        batchCount += 1;
        upserted += 1;
        if (batchCount >= batchSize) await commitBatch();
    }
    await commitBatch();

    const existingSnap = await col.where('active', '==', true).get();
    let deactivated = 0;
    batch = db.batch();
    batchCount = 0;
    for (const docSnap of existingSnap.docs) {
        if (docSnap.id === META_DOC) continue;
        const sourceId = String(docSnap.data().sourceId ?? '');
        if (!seenIds.has(sourceId)) {
            batch.update(docSnap.ref, {
                active: false,
                deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            batchCount += 1;
            deactivated += 1;
            if (batchCount >= batchSize) await commitBatch();
        }
    }
    await commitBatch();

    await col.doc(META_DOC).set({
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        totalFromApi: records.length,
        upserted,
        skipped,
        deactivated,
        resourceId: CKAN_RESOURCE_ID,
    }, { merge: true });

    return { totalFromApi: records.length, upserted, skipped, deactivated };
}

module.exports = {
    CKAN_RESOURCE_ID,
    COLLECTION,
    META_DOC,
    fetchAllMuhtarlikRecords,
    syncMuhtarliklarToFirestore,
};
