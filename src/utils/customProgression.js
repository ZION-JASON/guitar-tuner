import { CHORD_QUALITIES } from './musicTheory.js';
import { normalizeRhythmId } from './rhythmTheory.js';

export const CUSTOM_PROGRESSION_STORAGE_KEY = 'chromatuner.customProgression.v1';
export const MIN_STEP_BEATS = 1;
export const MAX_STEP_BEATS = 16;
export const DEFAULT_STEP_BEATS = 4;

const VALID_INSTRUMENTS = new Set(['guitar', 'bass', 'ukulele']);
const VALID_QUALITY_IDS = new Set(CHORD_QUALITIES.map((q) => q.id));

let stepCounter = 0;

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

export function clampStepBeats(beats) {
  const n = Number(beats);
  if (!Number.isFinite(n)) return DEFAULT_STEP_BEATS;
  return Math.max(MIN_STEP_BEATS, Math.min(MAX_STEP_BEATS, Math.round(n)));
}

export function generateStepUid() {
  stepCounter += 1;
  return `seq-${Date.now()}-${stepCounter}`;
}

export function normalizeProgressionStep(raw) {
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
  const beats = clampStepBeats(raw.beats ?? DEFAULT_STEP_BEATS);
  const rhythmId = normalizeRhythmId(raw.rhythmId, { allowInherit: true });
  const uid =
    typeof raw.uid === 'string' && raw.uid.trim().length > 0
      ? raw.uid.trim()
      : generateStepUid();
  const favId =
    typeof raw.favId === 'string' && raw.favId.trim().length > 0
      ? raw.favId.trim()
      : `${instrument}:${rootPc}:${qualityId}`;

  return {
    uid,
    favId,
    instrument,
    rootPc,
    qualityId,
    voicingIdx,
    preferFlats,
    beats,
    rhythmId,
  };
}

export function createProgressionStep(
  favoriteEntry,
  beats = DEFAULT_STEP_BEATS,
  rhythmId = 'inherit'
) {
  if (!favoriteEntry || typeof favoriteEntry !== 'object') return null;
  return normalizeProgressionStep({
    uid: generateStepUid(),
    favId: favoriteEntry.id || favoriteEntry.favId,
    instrument: favoriteEntry.instrument,
    rootPc: favoriteEntry.rootPc,
    qualityId: favoriteEntry.qualityId,
    voicingIdx: favoriteEntry.voicingIdx ?? 0,
    preferFlats: favoriteEntry.preferFlats ?? null,
    beats,
    rhythmId: favoriteEntry.rhythmId ?? rhythmId,
  });
}

export function loadCustomProgression(storageOverride = null) {
  const storage = getSafeStorage(storageOverride);
  if (!storage) return [];

  try {
    const rawText = storage.getItem(CUSTOM_PROGRESSION_STORAGE_KEY);
    if (!rawText) return [];
    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) return [];

    const seenUids = new Set();
    const result = [];
    for (const item of parsed) {
      const normalized = normalizeProgressionStep(item);
      if (!normalized) continue;
      if (seenUids.has(normalized.uid)) {
        normalized.uid = generateStepUid();
      }
      seenUids.add(normalized.uid);
      result.push(normalized);
    }
    return result;
  } catch {
    return [];
  }
}

export function saveCustomProgression(steps, storageOverride = null) {
  const storage = getSafeStorage(storageOverride);
  if (!storage || !Array.isArray(steps)) return false;

  try {
    const sanitized = steps.map(normalizeProgressionStep).filter(Boolean);
    storage.setItem(CUSTOM_PROGRESSION_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function appendFavoriteToProgression(
  steps,
  favoriteEntry,
  beats = DEFAULT_STEP_BEATS,
  storageOverride = null
) {
  const current = Array.isArray(steps) ? steps : [];
  const nextStep = createProgressionStep(favoriteEntry, beats);
  if (!nextStep) return current;
  const next = [...current, nextStep];
  saveCustomProgression(next, storageOverride);
  return next;
}

export function removeProgressionStep(steps, uid, storageOverride = null) {
  const current = Array.isArray(steps) ? steps : [];
  const next = current.filter((step) => step && step.uid !== uid);
  saveCustomProgression(next, storageOverride);
  return next;
}

export function previewProgressionReorder(steps, fromIndex, toIndex) {
  const current = Array.isArray(steps) ? steps : [];
  if (
    fromIndex < 0 ||
    fromIndex >= current.length ||
    toIndex < 0 ||
    toIndex >= current.length ||
    fromIndex === toIndex
  ) {
    return current;
  }
  const next = [...current];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function findDragTargetSlotIndex(slotRects, clientX, clientY) {
  if (!Array.isArray(slotRects) || slotRects.length === 0) return -1;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return -1;

  for (let i = 0; i < slotRects.length; i += 1) {
    const r = slotRects[i];
    if (!r) continue;
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return r.index ?? i;
    }
  }

  let bestIndex = slotRects[0].index ?? 0;
  let bestDistSq = Infinity;
  let bestCenterDistSq = Infinity;

  for (let i = 0; i < slotRects.length; i += 1) {
    const r = slotRects[i];
    if (!r) continue;
    const dx = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
    const dy = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
    const distSq = dx * dx + dy * dy;

    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const centerDistSq = (clientX - cx) * (clientX - cx) + (clientY - cy) * (clientY - cy);

    if (
      distSq < bestDistSq - 0.5 ||
      (Math.abs(distSq - bestDistSq) <= 0.5 && centerDistSq < bestCenterDistSq)
    ) {
      bestDistSq = distSq;
      bestCenterDistSq = centerDistSq;
      bestIndex = r.index ?? i;
    }
  }

  return bestIndex;
}

export function moveProgressionStep(steps, fromIndex, toIndex, storageOverride = null) {
  const next = previewProgressionReorder(steps, fromIndex, toIndex);
  if (next === steps) return steps;
  saveCustomProgression(next, storageOverride);
  return next;
}

export function duplicateProgressionStep(steps, uid, storageOverride = null) {
  const current = Array.isArray(steps) ? steps : [];
  const idx = current.findIndex((step) => step && step.uid === uid);
  if (idx === -1) return current;
  const copy = createProgressionStep(current[idx], current[idx].beats);
  if (!copy) return current;
  const next = [...current.slice(0, idx + 1), copy, ...current.slice(idx + 1)];
  saveCustomProgression(next, storageOverride);
  return next;
}

export function updateProgressionStepBeats(steps, uid, beats, storageOverride = null) {
  const current = Array.isArray(steps) ? steps : [];
  const safeBeats = clampStepBeats(beats);
  let changed = false;
  const next = current.map((step) => {
    if (!step || step.uid !== uid) return step;
    if (step.beats === safeBeats) return step;
    changed = true;
    return { ...step, beats: safeBeats };
  });
  if (changed) {
    saveCustomProgression(next, storageOverride);
  }
  return next;
}

export function updateProgressionStepRhythm(steps, uid, rhythmId, storageOverride = null) {
  const current = Array.isArray(steps) ? steps : [];
  const safeRhythmId = normalizeRhythmId(rhythmId, { allowInherit: true });
  let changed = false;
  const next = current.map((step) => {
    if (!step || step.uid !== uid) return step;
    const currentRhythm = normalizeRhythmId(step.rhythmId, { allowInherit: true });
    if (currentRhythm === safeRhythmId) return step;
    changed = true;
    return { ...step, rhythmId: safeRhythmId };
  });
  if (changed) {
    saveCustomProgression(next, storageOverride);
  }
  return next;
}

export function clearCustomProgression(storageOverride = null) {
  saveCustomProgression([], storageOverride);
  return [];
}

export function getSequenceTotalBeats(steps) {
  if (!Array.isArray(steps)) return 0;
  return steps.reduce((sum, step) => sum + clampStepBeats(step?.beats ?? DEFAULT_STEP_BEATS), 0);
}

export function getSequenceDurationSec(steps, bpm = 90) {
  const safeBpm = Math.max(40, Math.min(220, Number(bpm) || 90));
  const totalBeats = getSequenceTotalBeats(steps);
  return (totalBeats * 60) / safeBpm;
}
