import { CHORD_QUALITIES } from './musicTheory.js';

export const FAVORITE_CHORDS_STORAGE_KEY = 'chromatuner.favoriteChords.v1';

const VALID_INSTRUMENTS = new Set(['guitar', 'bass', 'ukulele']);
const VALID_QUALITY_IDS = new Set(CHORD_QUALITIES.map((q) => q.id));

function getSafeStorage(storageOverride) {
  if (storageOverride) return storageOverride;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function makeFavoriteChordId({ instrument = 'guitar', rootPc = 0, qualityId = 'major' }) {
  const safeInst = VALID_INSTRUMENTS.has(instrument) ? instrument : 'guitar';
  const safeRoot = ((Math.round(Number(rootPc) || 0) % 12) + 12) % 12;
  const safeQual = VALID_QUALITY_IDS.has(qualityId) ? qualityId : 'major';
  return `${safeInst}:${safeRoot}:${safeQual}`;
}

export function normalizeFavoriteEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const instrument = VALID_INSTRUMENTS.has(raw.instrument) ? raw.instrument : null;
  const qualityId = VALID_QUALITY_IDS.has(raw.qualityId) ? raw.qualityId : null;
  if (!instrument || !qualityId) return null;

  const rawRoot = Number(raw.rootPc);
  if (!Number.isFinite(rawRoot)) return null;
  const rootPc = ((Math.round(rawRoot) % 12) + 12) % 12;

  const rawVoicingIdx = Number(raw.voicingIdx);
  const voicingIdx =
    Number.isFinite(rawVoicingIdx) && rawVoicingIdx >= 0 ? Math.floor(rawVoicingIdx) : 0;

  const preferFlats = typeof raw.preferFlats === 'boolean' ? raw.preferFlats : null;
  const savedAt =
    typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : 0;

  return {
    id: makeFavoriteChordId({ instrument, rootPc, qualityId }),
    instrument,
    rootPc,
    qualityId,
    voicingIdx,
    preferFlats,
    savedAt,
  };
}

export function loadFavoriteChords(storageOverride = null) {
  const storage = getSafeStorage(storageOverride);
  if (!storage) return [];

  try {
    const rawText = storage.getItem(FAVORITE_CHORDS_STORAGE_KEY);
    if (!rawText) return [];
    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const result = [];
    for (const item of parsed) {
      const normalized = normalizeFavoriteEntry(item);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      result.push(normalized);
    }
    return result;
  } catch {
    return [];
  }
}

export function saveFavoriteChords(favorites, storageOverride = null) {
  const storage = getSafeStorage(storageOverride);
  if (!storage || !Array.isArray(favorites)) return false;

  try {
    const sanitized = favorites
      .map(normalizeFavoriteEntry)
      .filter(Boolean);
    storage.setItem(FAVORITE_CHORDS_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function toggleFavoriteChord(favorites, item, storageOverride = null) {
  const current = Array.isArray(favorites) ? favorites : [];
  const candidate = normalizeFavoriteEntry({
    ...item,
    savedAt: item?.savedAt ?? Date.now(),
  });
  if (!candidate) return current;

  const exists = current.some((entry) => entry.id === candidate.id);
  const next = exists
    ? current.filter((entry) => entry.id !== candidate.id)
    : [candidate, ...current];

  saveFavoriteChords(next, storageOverride);
  return next;
}

export function removeFavoriteChord(favorites, id, storageOverride = null) {
  const current = Array.isArray(favorites) ? favorites : [];
  const next = current.filter((entry) => entry.id !== id);
  saveFavoriteChords(next, storageOverride);
  return next;
}

export function updateFavoriteChordVoicing(favorites, id, voicingIdx, storageOverride = null) {
  const current = Array.isArray(favorites) ? favorites : [];
  const safeIdx = Number.isFinite(voicingIdx) && voicingIdx >= 0 ? Math.floor(voicingIdx) : 0;
  let changed = false;
  const next = current.map((entry) => {
    if (!entry || entry.id !== id) return entry;
    if (entry.voicingIdx === safeIdx) return entry;
    changed = true;
    return { ...entry, voicingIdx: safeIdx };
  });
  if (changed) {
    saveFavoriteChords(next, storageOverride);
  }
  return next;
}
