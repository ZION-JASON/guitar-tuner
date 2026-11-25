import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SEQUENCE_RHYTHM_ID,
  RHYTHM_CATEGORIES,
  RHYTHM_PATTERNS,
  RHYTHM_SPEED_OPTIONS,
  RHYTHM_SUBDIVISIONS,
  SEQUENCE_RHYTHM_STORAGE_KEY,
  expandRhythmEventsForStep,
  formatShortArrowCode,
  formatUpDownDescription,
  getRhythmPattern,
  getRhythmPatternsByCategory,
  loadSequenceRhythmId,
  normalizeRhythmId,
  resolveRhythmDemoBpm,
  saveSequenceRhythmId,
} from './rhythmTheory.js';

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

test('RHYTHM_PATTERNS include valid Down/Up spoken notation, beat offsets, and non-empty categories', () => {
  assert.ok(RHYTHM_PATTERNS.length >= 15);
  assert.ok(RHYTHM_SUBDIVISIONS.length >= 4);

  for (const pat of RHYTHM_PATTERNS) {
    assert.ok(pat.id && pat.name);
    assert.ok(RHYTHM_CATEGORIES.includes(pat.category));
    assert.ok(Array.isArray(pat.slots) && pat.slots.length > 0);
    assert.ok(typeof pat.upDownText === 'string' && pat.upDownText.length > 0);
    assert.ok(typeof pat.shortCode === 'string' && pat.shortCode.length > 0);
    assert.equal(pat.upDownText, formatUpDownDescription(pat.slots));
    assert.equal(pat.shortCode, formatShortArrowCode(pat.slots));

    let prevOffset = -1;
    for (const slot of pat.slots) {
      assert.ok(slot.offsetBeats >= 0 && slot.offsetBeats < pat.cycleBeats);
      assert.ok(slot.offsetBeats > prevOffset);
      prevOffset = slot.offsetBeats;
    }
  }

  const rock = getRhythmPattern('rock-eighths');
  assert.equal(rock.shortCode, 'D U D U D U D U');
  assert.match(rock.upDownText, /Down · Up · Down · Up/);

  const island = getRhythmPattern('island-strum');
  assert.equal(island.shortCode, 'D - D U - U D U');
  assert.match(island.upDownText, /Down · \(miss\) · Down · Up · \(miss\) · Up · Down · Up/);

  const pendulum = getRhythmPattern('pendulum-strum');
  assert.equal(pendulum.shortCode, 'D - D U D - D U');
  assert.match(pendulum.upDownText, /Down · \(air-up\) · Down · Up · Down · \(air-up\) · Down · Up/);

  const wristWarmer = getRhythmPattern('sixteenth-motor');
  assert.equal(wristWarmer.cycleBeats, 2);
  assert.equal(wristWarmer.slots.length, 8);
  assert.equal(
    wristWarmer.slots.map((s) => s.countLabel).join(' '),
    '1 e & a 2 e & a'
  );
  assert.equal(wristWarmer.shortCode, 'D U D U D U D U');

  const sixteenthSub = RHYTHM_SUBDIVISIONS.find((s) => s.id === 'sixteenth');
  assert.ok(sixteenthSub);
  assert.equal(sixteenthSub.cycleBeats, 2);
  assert.equal(sixteenthSub.slots.length, 8);
  assert.equal(
    sixteenthSub.slots.map((s) => s.countLabel).join(' '),
    '1 e & a 2 e & a'
  );

  const blues128 = getRhythmPattern('blues-12-8');
  assert.equal(blues128.cycleBeats, 4);
  assert.equal(blues128.slots.length, 12);
});

test('getRhythmPatternsByCategory filters library patterns cleanly while excluding removed 16th clutter', () => {
  const allLibrary = getRhythmPatternsByCategory('All');
  assert.equal(allLibrary.some((p) => p.id === 'single'), false);
  assert.equal(allLibrary.some((p) => p.id === 'sixteenth-full'), false);
  assert.equal(allLibrary.some((p) => p.id === 'sixteenth-pop'), false);
  assert.equal(allLibrary.some((p) => p.id === 'funk-pocket'), false);
  assert.equal(allLibrary.some((p) => p.id === 'island-strum'), true);
  assert.equal(allLibrary.some((p) => p.id === 'pendulum-strum'), true);
  assert.equal(allLibrary.some((p) => p.id === 'sixteenth-motor'), true);

  const compound = getRhythmPatternsByCategory('3/4 & 6/8 Compound');
  assert.ok(compound.length >= 4);
  assert.ok(compound.every((p) => p.category === '3/4 & 6/8 Compound'));
});

test('expandRhythmEventsForStep tiles cycles across 8 beats and truncates split 2-beat bars cleanly', () => {
  const single2 = expandRhythmEventsForStep('single', 2);
  assert.equal(single2.length, 1);
  assert.equal(single2[0].durationBeats, 2);

  // Island strum (cycleBeats=4) over 8 beats = 2 full 8-slot cycles = 16 slots
  const island8 = expandRhythmEventsForStep('island-strum', 8);
  assert.equal(island8.length, 16);
  assert.equal(island8[0].offsetBeats, 0);
  assert.equal(island8[8].offsetBeats, 4);
  assert.equal(island8[15].offsetBeats, 7.5);
  assert.ok(island8[15].durationBeats <= 0.5);

  // Split 2-beat bar takes only strokes < 2 beats
  const island2 = expandRhythmEventsForStep('island-strum', 2);
  assert.equal(island2.length, 4);
  assert.deepEqual(
    island2.map((s) => s.shortCode),
    ['D', '-', 'D', 'U']
  );

  // Wrist Warmer (2-beat cycle) over 4 beats = 16 quarter-beat slots (0..3.75), split 2 beats = 8 slots (0..1.75)
  const wrist4 = expandRhythmEventsForStep('sixteenth-motor', 4);
  assert.equal(wrist4.length, 16);
  assert.equal(wrist4[1].offsetBeats, 0.25);
  assert.equal(wrist4[15].offsetBeats, 3.75);

  const wrist2 = expandRhythmEventsForStep('sixteenth-motor', 2);
  assert.equal(wrist2.length, 8);
  assert.equal(wrist2[7].offsetBeats, 1.75);

  // Swing shuffle keeps exact 2:1 triplet timing (0 and 2/3 of each beat)
  const swing4 = expandRhythmEventsForStep('swing-shuffle', 4);
  const activeSwingOffsets = swing4.filter((s) => s.action !== 'rest').map((s) => s.offsetBeats);
  assert.equal(activeSwingOffsets.length, 8);
  assert.ok(Math.abs(activeSwingOffsets[1] - 2 / 3) < 1e-6);
  assert.ok(Math.abs(activeSwingOffsets[3] - (1 + 2 / 3)) < 1e-6);
});

test('sequence rhythm persistence normalizes, migrates deprecated 16th IDs, saves, and loads cleanly', () => {
  assert.equal(normalizeRhythmId('island-strum'), 'island-strum');
  assert.equal(normalizeRhythmId('pendulum-strum'), 'pendulum-strum');
  assert.equal(normalizeRhythmId('sixteenth-motor'), 'sixteenth-motor');
  assert.equal(normalizeRhythmId('sixteenth-full'), 'sixteenth-motor');
  assert.equal(normalizeRhythmId('sixteenth-pop'), 'sixteenth-motor');
  assert.equal(normalizeRhythmId('funk-pocket'), 'sixteenth-motor');
  assert.equal(normalizeRhythmId('non-existent'), DEFAULT_SEQUENCE_RHYTHM_ID);
  assert.equal(normalizeRhythmId('inherit', { allowInherit: true }), 'inherit');
  assert.equal(normalizeRhythmId(null, { allowInherit: true }), 'inherit');

  const storage = createMemoryStorage();
  assert.equal(loadSequenceRhythmId(storage), DEFAULT_SEQUENCE_RHYTHM_ID);

  saveSequenceRhythmId('pop-backbeat', storage);
  assert.equal(storage.getItem(SEQUENCE_RHYTHM_STORAGE_KEY), 'pop-backbeat');
  assert.equal(loadSequenceRhythmId(storage), 'pop-backbeat');

  saveSequenceRhythmId('bogus-id', storage);
  assert.equal(loadSequenceRhythmId(storage), DEFAULT_SEQUENCE_RHYTHM_ID);
});

test('resolveRhythmDemoBpm respects original tempo, global override, speed scaling, and BPM bounds', () => {
  assert.deepEqual(
    RHYTHM_SPEED_OPTIONS.map((o) => o.scale),
    [0.5, 0.75, 1, 1.25]
  );

  // Original tempo ignores global BPM when recommendedBpm is present
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'original',
      speedScale: 1,
      recommendedBpm: 76,
      globalBpm: 110,
      anchorGlobalBpm: 110,
    }),
    76
  );

  // Speed presets scale original tempo cleanly and clamp at 40..220 BPM
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'original',
      speedScale: 0.75,
      recommendedBpm: 76,
      globalBpm: 90,
      anchorGlobalBpm: 90,
    }),
    57
  );
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'original',
      speedScale: 0.5,
      recommendedBpm: 68,
      globalBpm: 90,
      anchorGlobalBpm: 90,
    }),
    40
  );
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'original',
      speedScale: 1.25,
      recommendedBpm: 76,
      globalBpm: 90,
      anchorGlobalBpm: 90,
    }),
    95
  );

  // Global mode overrides pattern recommendedBpm with anchor global BPM * speedScale
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'global',
      speedScale: 1,
      recommendedBpm: 76,
      globalBpm: 105,
      anchorGlobalBpm: 105,
    }),
    105
  );
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'global',
      speedScale: 0.75,
      recommendedBpm: 76,
      globalBpm: 79,
      anchorGlobalBpm: 105,
    }),
    79
  );
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'global',
      speedScale: 1.25,
      recommendedBpm: 112,
      globalBpm: 200,
      anchorGlobalBpm: 200,
    }),
    220
  );

  // Subdivisions (recommendedBpm = null) always follow anchor global BPM * speedScale
  assert.equal(
    resolveRhythmDemoBpm({
      tempoMode: 'original',
      speedScale: 0.75,
      recommendedBpm: null,
      globalBpm: 96,
      anchorGlobalBpm: 96,
    }),
    72
  );
});
