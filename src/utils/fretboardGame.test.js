import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FRETBOARD_GAME_STORAGE_KEY,
  NATURAL_PC_SET,
  buildFretboardQuestionPool,
  buildLandmarkTip,
  evaluateFretboardGuess,
  getOctaveAnchorCells,
  getStringFilterOptions,
  loadFretboardGameStats,
  pickNextFretboardQuestion,
  saveFretboardGameStats,
} from './fretboardGame.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

test('buildFretboardQuestionPool respects instrument, fret range, natural/chromatic note pool, and string filters', () => {
  const guitarBeginnerNat = buildFretboardQuestionPool({
    instrument: 'guitar',
    fretRangeId: 'beginner',
    notePool: 'natural',
    stringFilter: 'all',
  });
  assert.ok(guitarBeginnerNat.length > 0);
  assert.ok(guitarBeginnerNat.every((c) => c.fret >= 0 && c.fret <= 5));
  assert.ok(guitarBeginnerNat.every((c) => NATURAL_PC_SET.has(c.pc)));

  // Bass string 4 (open E, pc 4) fret 3 is G (pc 7)
  const bassRootOnly = buildFretboardQuestionPool({
    instrument: 'bass',
    fretRangeId: 'octave',
    notePool: 'chromatic',
    stringFilter: 's:4',
  });
  assert.equal(bassRootOnly.length, 13);
  const bassFret3 = bassRootOnly.find((c) => c.fret === 3);
  assert.equal(bassFret3.pc, 7);
  assert.equal(bassFret3.sharpName, 'G');
  assert.equal(bassFret3.stringLabel, '4E');

  // Ukulele string options match 4 strings
  const ukeOpts = getStringFilterOptions('ukulele');
  assert.ok(ukeOpts.some((o) => o.label === '1A'));
  assert.ok(ukeOpts.some((o) => o.label === '4G'));
});

test('pickNextFretboardQuestion avoids consecutive repeats of same coordinate or pitch class', () => {
  const pool = buildFretboardQuestionPool({
    instrument: 'guitar',
    fretRangeId: 'beginner',
    notePool: 'natural',
    stringFilter: 'all',
  });
  const prev = pool[0];
  const next = pickNextFretboardQuestion(pool, prev, () => 0);
  assert.ok(next);
  assert.notEqual(next.pc, prev.pc);
});

test('evaluateFretboardGuess grades accurately and generates fretboard landmark explanations', () => {
  const pool = buildFretboardQuestionPool({
    instrument: 'guitar',
    fretRangeId: 'full',
    notePool: 'chromatic',
    stringFilter: 's:6',
  });
  const fret12 = pool.find((c) => c.fret === 12);
  assert.equal(fret12.pc, 4); // E

  const correctRes = evaluateFretboardGuess(fret12, 4, 900);
  assert.equal(correctRes.isCorrect, true);
  assert.match(correctRes.feedbackTitle, /Correct! 6E Fret 12 is E/);
  assert.match(correctRes.landmarkTip, /12th fret/);

  const wrongRes = evaluateFretboardGuess(fret12, 5, 1100);
  assert.equal(wrongRes.isCorrect, false);
  assert.match(wrongRes.feedbackTitle, /you picked F, answer is E/);

  const fret5 = pool.find((c) => c.fret === 5); // A
  assert.match(buildLandmarkTip(fret5), /5th fret on 6E/);
});

test('getOctaveAnchorCells finds matching pitch classes at other neck locations for Hint', () => {
  const pool = buildFretboardQuestionPool({
    instrument: 'guitar',
    fretRangeId: 'octave',
    notePool: 'chromatic',
    stringFilter: 'all',
  });
  const target = pool.find((c) => c.stringLabel === '6E' && c.fret === 3); // G
  const anchors = getOctaveAnchorCells(pool, target);
  assert.ok(anchors.length > 0);
  assert.ok(anchors.every((a) => a.pc === target.pc && !(a.stringNum === target.stringNum && a.fret === target.fret)));
});

test('loadFretboardGameStats and saveFretboardGameStats persist safely', () => {
  const storage = createMemoryStorage();
  const initial = loadFretboardGameStats(storage);
  assert.equal(initial.bestBlitzScore, 0);
  assert.equal(initial.bestStreak, 0);

  saveFretboardGameStats(
    { bestBlitzScore: 14, bestQuizScore: 9, bestStreak: 11, totalCorrect: 23, totalAttempts: 25 },
    storage
  );
  assert.ok(storage.getItem(FRETBOARD_GAME_STORAGE_KEY));
  const loaded = loadFretboardGameStats(storage);
  assert.equal(loaded.bestBlitzScore, 14);
  assert.equal(loaded.bestQuizScore, 9);
  assert.equal(loaded.bestStreak, 11);
});
