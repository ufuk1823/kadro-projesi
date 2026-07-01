const CKAN_RESOURCE_ID = '7d0b7f55-9ec2-4e35-91f8-0fd0aceefa18';
const CKAN_SEARCH_URL = 'https://acikveri.bizizmir.com/api/3/action/datastore_search';
const COLLECTION = 'izmir_muhtarliklar';
const META_DOC = '_sync_meta';

const { parseTrCoord, normLoc, normMahalleKey } = require('./geo');

/** Belediye API alanları — değişmediyse Firestore yazılmaz. */
const SYNC_FIELDS = [
    'sourceId', 'ilce', 'ilceId', 'mahalle', 'adi', 'yol', 'kapino', 'aciklama',
    'lat', 'lng', 'lookupKey', 'ilceNorm', 'mahalleNorm', 'source',
];

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
        source: 'izmir_acik_veri',
    };
}

function fieldEqual(a, b) {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (typeof a === 'number' && typeof b === 'number') {
        return Math.abs(a - b) < 1e-9;
    }
    return false;
}

function docDataEqual(existing, next) {
    for (const key of SYNC_FIELDS) {
        if (!fieldEqual(existing[key], next[key])) return false;
    }
    return true;
}

async function syncMuhtarliklarToFirestore(db, admin) {
    const records = await fetchAllMuhtarlikRecords();
    const col = db.collection(COLLECTION);

    const existingSnap = await col.get();
    const existingBySourceId = new Map();
    for (const docSnap of existingSnap.docs) {
        if (docSnap.id === META_DOC) continue;
        const sourceId = String(docSnap.data().sourceId ?? docSnap.id.replace(/^src_/, ''));
        existingBySourceId.set(sourceId, docSnap);
    }

    const apiBySourceId = new Map();
    let skipped = 0;
    for (const record of records) {
        const docData = recordToDoc(record);
        if (!docData) {
            skipped += 1;
            continue;
        }
        apiBySourceId.set(String(docData.sourceId), docData);
    }

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let deleted = 0;
    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    async function commitBatch() {
        if (batchCount === 0) return;
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
    }

    async function queueWrite(ref, data) {
        batch.set(ref, {
            ...data,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount += 1;
        if (batchCount >= batchSize) await commitBatch();
    }

    async function queueDelete(ref) {
        batch.delete(ref);
        batchCount += 1;
        if (batchCount >= batchSize) await commitBatch();
    }

    for (const [sourceId, docData] of apiBySourceId) {
        const docId = `src_${sourceId}`;
        const existing = existingBySourceId.get(sourceId);
        if (!existing) {
            await queueWrite(col.doc(docId), docData);
            added += 1;
        } else if (!docDataEqual(existing.data(), docData)) {
            await queueWrite(existing.ref, docData);
            updated += 1;
        } else {
            unchanged += 1;
        }
    }

    for (const [sourceId, docSnap] of existingBySourceId) {
        if (!apiBySourceId.has(sourceId)) {
            await queueDelete(docSnap.ref);
            deleted += 1;
        }
    }

    await commitBatch();

    const checked = apiBySourceId.size;
    const stats = {
        totalFromApi: records.length,
        checked,
        added,
        updated,
        deleted,
        unchanged,
        skipped,
    };

    await col.doc(META_DOC).set({
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        resourceId: CKAN_RESOURCE_ID,
        ...stats,
    }, { merge: true });

    return stats;
}

module.exports = {
    CKAN_RESOURCE_ID,
    COLLECTION,
    META_DOC,
    fetchAllMuhtarlikRecords,
    syncMuhtarliklarToFirestore,
};
