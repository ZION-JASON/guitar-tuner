import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_BPM,
  MAX_BPM,
  DEFAULT_BPM,
  TIME_SIGNATURES,
  clampBpm,
  getTimeSignatureConfig,
  getBeatIntervalSec,
  computeTapTempoBpm,
} from './metronome.js';

test('clampBpm enforces bounds and handles invalid input', () => {
  assert.equal(clampBpm(10), MIN_BPM);
  assert.equal(clampBpm(400), MAX_BPM);
  assert.equal(clampBpm(123.6), 124);
  assert.equal(clampBpm('abc'), DEFAULT_BPM);
  assert.equal(clampBpm(NaN), DEFAULT_BPM);
});

test('getTimeSignatureConfig returns matching config or defaults to 4/4', () => {
  assert.equal(TIME_SIGNATURES.length, 4);
  assert.deepEqual(getTimeSignatureConfig('3/4'), { id: '3/4', label: '3/4', beats: 3 });
  assert.deepEqual(getTimeSignatureConfig('6/8'), { id: '6/8', label: '6/8', beats: 6 });
  assert.deepEqual(getTimeSignatureConfig('invalid'), { id: '4/4', label: '4/4', beats: 4 });
});

test('getBeatIntervalSec computes accurate beat durations', () => {
  assert.equal(getBeatIntervalSec(60), 1);
  assert.equal(getBeatIntervalSec(120), 0.5);
  assert.equal(getBeatIntervalSec(10), 60 / MIN_BPM);
});

test('computeTapTempoBpm calculates average BPM and resets across long pauses', () => {
  assert.equal(computeTapTempoBpm([]), null);
  assert.equal(computeTapTempoBpm([1000]), null);

  // 500ms intervals = 120 BPM
  assert.equal(computeTapTempoBpm([0, 500, 1000, 1500]), 120);

  // Gap > 2200ms between first tap and later taps resets the tap sequence
  assert.equal(computeTapTempoBpm([0, 3500, 4100, 4700]), 100);

  // Extremely fast taps clamp to MAX_BPM
  assert.equal(computeTapTempoBpm([0, 100, 200]), MAX_BPM);

  // Non-increasing timestamps are rejected
  assert.equal(computeTapTempoBpm([1000, 1000]), null);
});
