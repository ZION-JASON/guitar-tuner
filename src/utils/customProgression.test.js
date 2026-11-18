import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOM_PROGRESSION_STORAGE_KEY,
  DEFAULT_STEP_BEATS,
  MAX_STEP_BEATS,
  MIN_STEP_BEATS,
  appendFavoriteToProgression,
  clampStepBeats,
  clearCustomProgression,
  createProgressionStep,
  duplicateProgressionStep,
  findDragTargetSlotIndex,
  getSequenceDurationSec,
  getSequenceTotalBeats,
  loadCustomProgression,
  moveProgressionStep,
  normalizeProgressionStep,
  previewProgressionReorder,
  removeProgressionStep,
  saveCustomProgression,
  updateProgressionStepBeats,
} from './customProgression.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('clampStepBeats clamps to [1, 16] and defaults invalid inputs', () => {
  assert.equal(clampStepBeats(0), MIN_STEP_BEATS);
  assert.equal(clampStepBeats(-3), MIN_STEP_BEATS);
  assert.equal(clampStepBeats(25), MAX_STEP_BEATS);
  assert.equal(clampStepBeats(3.6), 4);
  assert.equal(clampStepBeats('bad'), DEFAULT_STEP_BEATS);
});

test('normalizeProgressionStep validates fields and repairs missing defaults', () => {
  assert.equal(normalizeProgressionStep(null), null);
  assert.equal(
    normalizeProgressionStep({ instrument: 'violin', rootPc: 0, qualityId: 'major' }),
    null
  );
  assert.equal(
    normalizeProgressionStep({ instrument: 'guitar', rootPc: 0, qualityId: 'bad_quality' }),
    null
  );

  const normalized = normalizeProgressionStep({
    uid: 'step-a',
    instrument: 'bass',
    rootPc: -2,
    qualityId: 'minor',
    voicingIdx: 1.9,
    beats: 6,
  });

  assert.equal(normalized.uid, 'step-a');
  assert.equal(normalized.favId, 'bass:10:minor');
  assert.equal(normalized.instrument, 'bass');
  assert.equal(normalized.rootPc, 10);
  assert.equal(normalized.qualityId, 'minor');
  assert.equal(normalized.voicingIdx, 1);
  assert.equal(normalized.beats, 6);
});

test('loadCustomProgression handles corrupt JSON and regenerates duplicate step UIDs', () => {
  const corruptStorage = createMemoryStorage({
    [CUSTOM_PROGRESSION_STORAGE_KEY]: '{invalid',
  });
  assert.deepEqual(loadCustomProgression(corruptStorage), []);

  const dupStorage = createMemoryStorage({
    [CUSTOM_PROGRESSION_STORAGE_KEY]: JSON.stringify([
      { uid: 'dup-1', instrument: 'guitar', rootPc: 0, qualityId: 'major', beats: 4 },
      { uid: 'dup-1', instrument: 'guitar', rootPc: 7, qualityId: 'major', beats: 2 },
      { uid: 'bad', instrument: 'drums', rootPc: 0, qualityId: 'major' },
    ]),
  });

  const loaded = loadCustomProgression(dupStorage);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].uid, 'dup-1');
  assert.notEqual(loaded[1].uid, 'dup-1');
  assert.equal(loaded[1].rootPc, 7);
  assert.equal(loaded[1].beats, 2);
});

test('sequence editing actions append, move, duplicate, update beats, remove, and clear persistently', () => {
  const storage = createMemoryStorage();
  const cMaj = { id: 'guitar:0:major', instrument: 'guitar', rootPc: 0, qualityId: 'major', voicingIdx: 0 };
  const gMaj = { id: 'guitar:7:major', instrument: 'guitar', rootPc: 7, qualityId: 'major', voicingIdx: 1 };
  const aMin = { id: 'guitar:9:minor', instrument: 'guitar', rootPc: 9, qualityId: 'minor', voicingIdx: 0 };

  let seq = appendFavoriteToProgression([], cMaj, 4, storage);
  seq = appendFavoriteToProgression(seq, gMaj, 2, storage);
  seq = appendFavoriteToProgression(seq, aMin, 4, storage);

  assert.equal(seq.length, 3);
  assert.deepEqual(seq.map((s) => s.rootPc), [0, 7, 9]);

  // Duplicate middle G major step
  seq = duplicateProgressionStep(seq, seq[1].uid, storage);
  assert.equal(seq.length, 4);
  assert.deepEqual(seq.map((s) => s.rootPc), [0, 7, 7, 9]);

  // Move last A minor step to index 1
  seq = moveProgressionStep(seq, 3, 1, storage);
  assert.deepEqual(seq.map((s) => s.rootPc), [0, 9, 7, 7]);

  // Update beats on step 0
  seq = updateProgressionStepBeats(seq, seq[0].uid, 8, storage);
  assert.equal(seq[0].beats, 8);

  // Verify persistence
  const reloaded = loadCustomProgression(storage);
  assert.equal(reloaded.length, 4);
  assert.equal(reloaded[0].beats, 8);
  assert.deepEqual(reloaded.map((s) => s.rootPc), [0, 9, 7, 7]);

  // Remove step 1
  seq = removeProgressionStep(seq, seq[1].uid, storage);
  assert.deepEqual(seq.map((s) => s.rootPc), [0, 7, 7]);

  // Clear all
  seq = clearCustomProgression(storage);
  assert.deepEqual(seq, []);
  assert.deepEqual(loadCustomProgression(storage), []);
});

test('getSequenceTotalBeats and getSequenceDurationSec compute rhythm loop lengths accurately', () => {
  const s1 = createProgressionStep({ instrument: 'guitar', rootPc: 0, qualityId: 'major' }, 4);
  const s2 = createProgressionStep({ instrument: 'guitar', rootPc: 5, qualityId: 'major' }, 2);
  const s3 = createProgressionStep({ instrument: 'guitar', rootPc: 7, qualityId: '7' }, 2);

  saveCustomProgression([s1, s2, s3]);
  assert.equal(getSequenceTotalBeats([s1, s2, s3]), 8);
  assert.equal(getSequenceDurationSec([s1, s2, s3], 120), 4);
  assert.equal(getSequenceDurationSec([s1, s2, s3], 60), 8);
  assert.equal(getSequenceTotalBeats([]), 0);
});

test('previewProgressionReorder and findDragTargetSlotIndex resolve 2D grid drag targets accurately', () => {
  const items = ['C', 'G', 'Am', 'F'];
  assert.deepEqual(previewProgressionReorder(items, 0, 2), ['G', 'Am', 'C', 'F']);
  assert.deepEqual(previewProgressionReorder(items, 3, 1), ['C', 'F', 'G', 'Am']);
  assert.deepEqual(items, ['C', 'G', 'Am', 'F']);

  const slots = [
    { index: 0, left: 0, right: 100, top: 0, bottom: 100 },
    { index: 1, left: 120, right: 220, top: 0, bottom: 100 },
    { index: 2, left: 0, right: 100, top: 120, bottom: 220 },
    { index: 3, left: 120, right: 220, top: 120, bottom: 220 },
  ];

  // Direct hits inside cards
  assert.equal(findDragTargetSlotIndex(slots, 50, 50), 0);
  assert.equal(findDragTargetSlotIndex(slots, 180, 40), 1);
  assert.equal(findDragTargetSlotIndex(slots, 45, 170), 2);
  assert.equal(findDragTargetSlotIndex(slots, 190, 190), 3);

  // Gap hit resolves to closest slot box
  assert.equal(findDragTargetSlotIndex(slots, 108, 50), 0);
  assert.equal(findDragTargetSlotIndex(slots, 114, 50), 1);
  assert.equal(findDragTargetSlotIndex([], 50, 50), -1);
});
