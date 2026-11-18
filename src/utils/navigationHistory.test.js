import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNextNavSnapshot,
  createInitialNavSnapshot,
  describeNavSnapshot,
  normalizeNavSnapshot,
} from './navigationHistory.js';

test('navigation history tracks Tuner -> Learn -> Lookup -> Family -> Progressions -> Instrument switch without jumping to Home', () => {
  const step0 = createInitialNavSnapshot();
  assert.equal(step0.view, 'tuner');
  assert.equal(step0.instrument, 'guitar');
  assert.equal(step0.stepIndex, 0);
  assert.equal(step0.prevLabel, null);
  assert.equal(describeNavSnapshot(step0), 'Guitar Tuner');

  const step1 = buildNextNavSnapshot(step0, { view: 'learn' });
  assert.equal(step1.view, 'learn');
  assert.equal(step1.stepIndex, 1);
  assert.equal(step1.prevLabel, 'Guitar Tuner');
  assert.equal(describeNavSnapshot(step1), 'Guitar C Chords');

  const step2 = buildNextNavSnapshot(step1, {
    learn: { chordQuery: 'F#dim' },
  });
  assert.equal(step2.stepIndex, 2);
  assert.equal(step2.prevLabel, 'Guitar C Chords');
  assert.equal(describeNavSnapshot(step2), 'Guitar F#dim Diagram');

  // Refining search query with replace: true keeps stepIndex and prevLabel
  const step2Replaced = buildNextNavSnapshot(
    step2,
    { learn: { chordQuery: 'F#dim7' } },
    { replace: true }
  );
  assert.equal(step2Replaced.stepIndex, 2);
  assert.equal(step2Replaced.prevLabel, 'Guitar C Chords');
  assert.equal(describeNavSnapshot(step2Replaced), 'Guitar F#dim7 Diagram');

  const step3 = buildNextNavSnapshot(step2, {
    learn: {
      familyModalTarget: { rootPc: 6, qualityId: 'dim', preferFlats: false },
    },
  });
  assert.equal(step3.stepIndex, 3);
  assert.equal(step3.prevLabel, 'Guitar F#dim Diagram');
  assert.equal(describeNavSnapshot(step3), 'Guitar F#dim Family');

  const step4 = buildNextNavSnapshot(step3, {
    learn: {
      tab: 'progressions',
      rootPc: 7,
      familyModalTarget: null,
    },
  });
  assert.equal(step4.stepIndex, 4);
  assert.equal(step4.prevLabel, 'Guitar F#dim Family');
  assert.equal(describeNavSnapshot(step4), 'Guitar G Three-Chord Family');

  const step5 = buildNextNavSnapshot(step4, {
    instrument: 'ukulele',
  });
  assert.equal(step5.stepIndex, 5);
  assert.equal(step5.instrument, 'ukulele');
  assert.equal(step5.prevLabel, 'Guitar G Three-Chord Family');
  assert.equal(describeNavSnapshot(step5), 'Ukulele G Three-Chord Family');

  const step6 = buildNextNavSnapshot(step5, {
    view: 'tuner',
    instrument: 'bass',
  });
  assert.equal(step6.stepIndex, 6);
  assert.equal(step6.instrument, 'bass');
  assert.equal(step6.prevLabel, 'Ukulele G Three-Chord Family');
  assert.equal(describeNavSnapshot(step6), 'Bass Tuner');
});

test('normalizeNavSnapshot safely handles invalid or malformed popstate payloads', () => {
  const fromNull = normalizeNavSnapshot(null);
  assert.deepEqual(fromNull, createInitialNavSnapshot());

  const fromMalformed = normalizeNavSnapshot({
    view: 'unknown',
    instrument: 'banjo',
    learn: { tab: 'invalid', rootPc: -5, chordPlayMode: 'invalid' },
    stepIndex: -2,
    prevLabel: 42,
  });
  assert.equal(fromMalformed.view, 'tuner');
  assert.equal(fromMalformed.instrument, 'guitar');
  assert.equal(fromMalformed.learn.tab, 'chords');
  assert.equal(fromMalformed.learn.chordPlayMode, 'strum');
  assert.equal(fromMalformed.learn.rootPc, 7);
  assert.equal(fromMalformed.stepIndex, 0);
  assert.equal(fromMalformed.prevLabel, null);

  const withArpeggio = normalizeNavSnapshot({
    view: 'learn',
    instrument: 'bass',
    learn: { chordPlayMode: 'arpeggio' },
  });
  assert.equal(withArpeggio.learn.chordPlayMode, 'arpeggio');

  const theorySnap = normalizeNavSnapshot({
    view: 'learn',
    instrument: 'guitar',
    learn: { tab: 'theory', rootPc: 7 },
  });
  assert.equal(theorySnap.learn.tab, 'theory');
  assert.equal(describeNavSnapshot(theorySnap), 'Guitar G Theory & Guides');
});

