import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FAVORITE_CHORDS_STORAGE_KEY,
  makeFavoriteChordId,
  normalizeFavoriteEntry,
  loadFavoriteChords,
  saveFavoriteChords,
  toggleFavoriteChord,
  removeFavoriteChord,
  updateFavoriteChordVoicing,
} from './favoriteChords.js';

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

test('makeFavoriteChordId normalizes rootPc modulo 12 and defaults safely', () => {
  assert.equal(
    makeFavoriteChordId({ instrument: 'guitar', rootPc: 0, qualityId: 'major' }),
    'guitar:0:major'
  );
  assert.equal(
    makeFavoriteChordId({ instrument: 'bass', rootPc: -1, qualityId: 'minor' }),
    'bass:11:minor'
  );
  assert.equal(
    makeFavoriteChordId({ instrument: 'ukulele', rootPc: 14, qualityId: '7' }),
    'ukulele:2:7'
  );
  assert.equal(
    makeFavoriteChordId({ instrument: 'ukulele', rootPc: 14, qualityId: 'nonexistent' }),
    'ukulele:2:major'
  );
});

test('normalizeFavoriteEntry rejects invalid entries and preserves valid fields', () => {
  assert.equal(normalizeFavoriteEntry(null), null);
  assert.equal(normalizeFavoriteEntry({ instrument: 'piano', rootPc: 0, qualityId: 'major' }), null);
  assert.equal(normalizeFavoriteEntry({ instrument: 'guitar', rootPc: 0, qualityId: 'unknown' }), null);
  assert.equal(normalizeFavoriteEntry({ instrument: 'guitar', rootPc: 'NaN', qualityId: 'major' }), null);

  const valid = normalizeFavoriteEntry({
    instrument: 'guitar',
    rootPc: 7,
    qualityId: 'maj7',
    voicingIdx: 2.8,
    preferFlats: true,
    savedAt: 1700000000,
  });
  assert.deepEqual(valid, {
    id: 'guitar:7:maj7',
    instrument: 'guitar',
    rootPc: 7,
    qualityId: 'maj7',
    voicingIdx: 2,
    preferFlats: true,
    savedAt: 1700000000,
  });
});

test('loadFavoriteChords handles missing, corrupt, and duplicate entries gracefully', () => {
  const emptyStorage = createMemoryStorage();
  assert.deepEqual(loadFavoriteChords(emptyStorage), []);

  const corruptStorage = createMemoryStorage({
    [FAVORITE_CHORDS_STORAGE_KEY]: '{not-valid-json',
  });
  assert.deepEqual(loadFavoriteChords(corruptStorage), []);

  const mixedStorage = createMemoryStorage({
    [FAVORITE_CHORDS_STORAGE_KEY]: JSON.stringify([
      { instrument: 'guitar', rootPc: 0, qualityId: 'major', voicingIdx: 1 },
      { instrument: 'guitar', rootPc: 0, qualityId: 'major', voicingIdx: 3 }, // duplicate ID
      { instrument: 'invalid', rootPc: 2, qualityId: 'minor' },
      { instrument: 'ukulele', rootPc: 9, qualityId: 'minor', voicingIdx: -5 },
    ]),
  });

  const loaded = loadFavoriteChords(mixedStorage);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, 'guitar:0:major');
  assert.equal(loaded[0].voicingIdx, 1);
  assert.equal(loaded[1].id, 'ukulele:9:minor');
  assert.equal(loaded[1].voicingIdx, 0);
});

test('toggleFavoriteChord adds, persists, and removes favorites', () => {
  const storage = createMemoryStorage();

  let list = toggleFavoriteChord(
    [],
    { instrument: 'guitar', rootPc: 0, qualityId: 'major', voicingIdx: 1, savedAt: 100 },
    storage
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'guitar:0:major');

  list = toggleFavoriteChord(
    list,
    { instrument: 'bass', rootPc: 4, qualityId: 'minor', voicingIdx: 0, savedAt: 200 },
    storage
  );
  assert.equal(list.length, 2);
  // Newest added appears first
  assert.equal(list[0].id, 'bass:4:minor');
  assert.equal(loadFavoriteChords(storage).length, 2);

  // Toggling an existing favorite removes it
  list = toggleFavoriteChord(
    list,
    { instrument: 'guitar', rootPc: 0, qualityId: 'major' },
    storage
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'bass:4:minor');
  assert.deepEqual(loadFavoriteChords(storage).map((c) => c.id), ['bass:4:minor']);
});

test('updateFavoriteChordVoicing and removeFavoriteChord persist updates', () => {
  const storage = createMemoryStorage();
  const initial = [
    normalizeFavoriteEntry({ instrument: 'guitar', rootPc: 5, qualityId: '7', voicingIdx: 0, savedAt: 10 }),
  ];
  saveFavoriteChords(initial, storage);

  const updated = updateFavoriteChordVoicing(initial, 'guitar:5:7', 2, storage);
  assert.equal(updated[0].voicingIdx, 2);
  assert.equal(loadFavoriteChords(storage)[0].voicingIdx, 2);

  const afterRemove = removeFavoriteChord(updated, 'guitar:5:7', storage);
  assert.deepEqual(afterRemove, []);
  assert.deepEqual(loadFavoriteChords(storage), []);
});
