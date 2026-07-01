const ISTANBUL_TZ = 'Europe/Istanbul';

function parseTrCoord(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const n = parseFloat(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function normLoc(value) {
    return (value || '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/\s+mah(?:allesi|alle)?\.?$/i, '')
        .replace(/\s+/g, ' ');
}

function normMahalleKey(ilce, mahalle) {
    return `${normLoc(ilce)}|${normLoc(mahalle)}`;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function getIstanbulParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: ISTANBUL_TZ,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return {
        weekday: parts.weekday,
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
    };
}

function isIzmirIl(il) {
    const n = normLoc(il);
    return n === 'izmir' || n === 'izmir ili' || n.startsWith('izmir');
}

const MUHTARLIK_WINDOW_START = 16 * 60 + 45;
const MUHTARLIK_WINDOW_END = 17 * 60 + 15;

function isMuhtarlikWindowOpen(date = new Date()) {
    const { weekday, minuteOfDay } = getIstanbulParts(date);
    if (weekday !== 'Fri') return false;
    return minuteOfDay >= MUHTARLIK_WINDOW_START && minuteOfDay <= MUHTARLIK_WINDOW_END;
}

module.exports = {
    ISTANBUL_TZ,
    parseTrCoord,
    normLoc,
    normMahalleKey,
    distanceMeters,
    getIstanbulParts,
    isIzmirIl,
    isMuhtarlikWindowOpen,
    MUHTARLIK_WINDOW_START,
    MUHTARLIK_WINDOW_END,
};
