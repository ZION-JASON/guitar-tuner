import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectPitchYIN } from './pitchAlgorithm.js';
import {
  LearnAudioEngine,
  synthesizePluckedStringSamples,
} from './audioSynth.js';
import {
  SAMPLE_LIBRARY_CONFIG,
  findNearestSample,
  getInstrumentSampleEntries,
  noteLabelToMidi,
} from './sampleLibrary.js';
import {
  clampRefFrequency,
  getNoteFromFrequency,
  matchPresetString,
  PitchStabilizer,
} from './frequencyUtils.js';
import {
  applyThemeToDocument,
  loadTheme,
  normalizeTheme,
  saveTheme,
  THEME_IDS,
  THEME_STORAGE_KEY,
  toggleThemeValue,
} from './themeUtils.js';

function makeSine(freq, sampleRate = 48000, size = 4096, amplitude = 0.5, dc = 0) {
  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    buf[i] = dc + amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

function makeGuitarWaveform(freq, sampleRate = 48000, size = 4096) {
  // Realistic plucked string: weak fundamental, strong 2nd and 3rd harmonics
  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-t * 2.5);
    buf[i] =
      decay *
      (0.25 * Math.sin(2 * Math.PI * freq * t) +
        0.55 * Math.sin(2 * Math.PI * freq * 2 * t + 0.3) +
        0.35 * Math.sin(2 * Math.PI * freq * 3 * t + 0.7) +
        0.15 * Math.sin(2 * Math.PI * freq * 4 * t));
  }
  return buf;
}

function centsError(measured, expected) {
  return Math.abs(1200 * Math.log2(measured / expected));
}

test('detectPitchYIN achieves sub-cent accuracy across standard guitar & bass range', () => {
  const sampleRate = 48000;
  const targets = [
    41.2034, // E1 bass
    73.4162, // D2 drop D
    82.4069, // E2
    110.0, // A2
    146.8324, // D3
    195.9977, // G3
    246.9417, // B3
    329.6276, // E4
    440.0, // A4
    880.0, // A5
  ];

  for (const target of targets) {
    const buf = makeSine(target, sampleRate, 4096, 0.3, 0.05); // includes DC offset
    const res = detectPitchYIN(buf, sampleRate);
    assert.ok(res.frequency > 0, `Expected pitch for ${target}Hz`);
    const err = centsError(res.frequency, target);
    assert.ok(
      err < 0.5,
      `Expected < 0.5 cents error at ${target}Hz, got ${err.toFixed(3)} cents (${res.frequency.toFixed(3)}Hz)`
    );
    assert.ok(res.clarity > 0.95);
  }
});

test('detectPitchYIN avoids octave errors on harmonic-dominant guitar strings', () => {
  const sampleRate = 48000;
  const lowNotes = [82.4069, 110.0, 146.8324, 195.9977];

  for (const target of lowNotes) {
    const buf = makeGuitarWaveform(target, sampleRate, 4096);
    const res = detectPitchYIN(buf, sampleRate);
    assert.ok(res.frequency > 0, `Expected detection for guitar waveform ${target}Hz`);
    const err = centsError(res.frequency, target);
    assert.ok(
      err < 1.0,
      `Octave/pitch error at ${target}Hz: detected ${res.frequency.toFixed(2)}Hz (${err.toFixed(2)} cents off)`
    );
  }
});

test('detectPitchYIN accurately resolves sharp and flat offsets', () => {
  const sampleRate = 44100;
  const e2 = 82.4069;
  const flatFreq = e2 * Math.pow(2, -14 / 1200);
  const sharpFreq = e2 * Math.pow(2, 19 / 1200);

  const flatRes = detectPitchYIN(makeSine(flatFreq, sampleRate, 4096, 0.05), sampleRate);
  const sharpRes = detectPitchYIN(makeSine(sharpFreq, sampleRate, 4096, 0.05), sampleRate);

  const flatNote = getNoteFromFrequency(flatRes.frequency, 440);
  const sharpNote = getNoteFromFrequency(sharpRes.frequency, 440);

  assert.equal(flatNote.fullNote, 'E2');
  assert.ok(Math.abs(flatNote.cents - -14) < 0.5, `Expected -14c, got ${flatNote.cents}`);

  assert.equal(sharpNote.fullNote, 'E2');
  assert.ok(Math.abs(sharpNote.cents - 19) < 0.5, `Expected +19c, got ${sharpNote.cents}`);
});

test('detectPitchYIN rejects silence, NaN, and unpitched noise', () => {
  const silence = new Float32Array(4096);
  assert.equal(detectPitchYIN(silence, 48000).frequency, -1);

  const bad = new Float32Array(4096);
  bad[10] = Number.NaN;
  assert.equal(detectPitchYIN(bad, 48000).frequency, -1);

  // Deterministic pseudo-random noise
  const noise = new Float32Array(4096);
  let seed = 12345;
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    noise[i] = (seed / 0xffffffff - 0.5) * 0.4;
  }
  assert.equal(detectPitchYIN(noise, 48000).frequency, -1);
});

test('getNoteFromFrequency handles boundaries, negative MIDI, and custom A4 reference', () => {
  assert.equal(getNoteFromFrequency(0).noteName, '-');
  assert.equal(getNoteFromFrequency(-50).noteName, '-');
  assert.equal(getNoteFromFrequency(Number.NaN).noteName, '-');

  // Very low sub-audio frequency still produces valid note string without undefined
  const sub = getNoteFromFrequency(6.0, 440);
  assert.notEqual(sub.noteName, undefined);

  // 432Hz calibration: A4 at 432Hz should yield 0 cents
  const a432 = getNoteFromFrequency(432, 432);
  assert.equal(a432.fullNote, 'A4');
  assert.ok(Math.abs(a432.cents) < 0.001);

  assert.equal(clampRefFrequency(300), 415);
  assert.equal(clampRefFrequency(500), 466);
  assert.equal(clampRefFrequency('bad'), 440);
});

test('matchPresetString snaps to nearest string or locked string accurately', () => {
  // Drop D low D2 = 73.42Hz
  const dropD = matchPresetString(73.42, 'drop_d', 440);
  assert.equal(dropD.matchedStringNum, 6);
  assert.equal(dropD.fullNote, 'D2');
  assert.ok(Math.abs(dropD.cents) < 0.5);

  // Locked string 5 (A2 = 110Hz), played way flat at 103Hz
  const locked = matchPresetString(103, 'standard', 440, 5);
  assert.equal(locked.matchedStringNum, 5);
  assert.equal(locked.fullNote, 'A2');
  assert.ok(locked.cents < -40);
});

test('PitchStabilizer filters single-frame glitches but follows deliberate note changes', () => {
  const stabilizer = new PitchStabilizer(5);
  assert.ok(Math.abs(stabilizer.push(82.41, 0.98) - 82.41) < 0.01);
  assert.ok(Math.abs(stabilizer.push(82.45, 0.98) - 82.43) < 0.1);

  // Single-frame octave glitch should be ignored
  const afterGlitch = stabilizer.push(164.82, 0.95);
  assert.ok(afterGlitch < 85, `Single glitch leaked through: ${afterGlitch}`);

  // Two consecutive frames at A2 (110Hz) should switch smoothly
  stabilizer.push(110.0, 0.98);
  const switched = stabilizer.push(110.05, 0.98);
  assert.ok(Math.abs(switched - 110.0) < 0.2);
});

test('detectPitchYIN and matchPresetString handle sub-bass (B0/E1) and re-entrant Ukulele tuning', () => {
  const sampleRate = 48000;
  // Sub-bass B0 (30.8677 Hz) and D1 (36.7081 Hz) require 8192 buffer and minFreq <= 27
  for (const target of [30.8677, 36.7081, 41.2034]) {
    const res = detectPitchYIN(makeSine(target, sampleRate, 8192, 0.35), sampleRate, {
      minFreq: 27,
      maxFreq: 600,
    });
    assert.ok(res.frequency > 0, `Expected bass detection at ${target}Hz`);
    const err = centsError(res.frequency, target);
    assert.ok(err < 0.6, `Bass error ${err.toFixed(2)} cents at ${target}Hz`);
  }

  const bassB0 = matchPresetString(30.87, 'bass_5_string', 440);
  assert.equal(bassB0.matchedStringNum, 5);
  assert.equal(bassB0.fullNote, 'B0');

  const bassE1 = matchPresetString(41.2, 'bass_standard', 440);
  assert.equal(bassE1.matchedStringNum, 4);
  assert.equal(bassE1.fullNote, 'E1');

  // Re-entrant High-G Ukulele: 4G4=392Hz, 3C4=261.63Hz, 2E4=329.63Hz, 1A4=440Hz
  const ukeG4 = matchPresetString(392.0, 'uke_standard', 440);
  assert.equal(ukeG4.matchedStringNum, 4);
  assert.equal(ukeG4.fullNote, 'G4');

  const ukeC4 = matchPresetString(261.63, 'uke_standard', 440);
  assert.equal(ukeC4.matchedStringNum, 3);
  assert.equal(ukeC4.fullNote, 'C4');

  const ukeA4 = matchPresetString(440.0, 'uke_standard', 440);
  assert.equal(ukeA4.matchedStringNum, 1);
  assert.equal(ukeA4.fullNote, 'A4');
});

test('synthesizePluckedStringSamples produces pitch-accurate acoustic waveforms for Guitar, Bass, and Ukulele', () => {
  const sampleRate = 48000;
  const cases = [
    { instrument: 'guitar', freq: 82.4069 }, // E2
    { instrument: 'guitar', freq: 195.9977 }, // G3
    { instrument: 'guitar', freq: 329.6276 }, // E4
    { instrument: 'bass', freq: 41.2034 }, // E1
    { instrument: 'bass', freq: 97.9989 }, // G2
    { instrument: 'ukulele', freq: 261.6256 }, // C4
    { instrument: 'ukulele', freq: 391.9954 }, // G4
    { instrument: 'ukulele', freq: 440.0 }, // A4
  ];

  for (const c of cases) {
    const samples = synthesizePluckedStringSamples({
      freq: c.freq,
      durationSec: 1.4,
      sampleRate,
      instrument: c.instrument,
    });
    assert.ok(samples.length >= sampleRate);

    // Measure settled sustain window (around 0.15s..0.32s after transient pick burst)
    const slice = samples.slice(7200, 7200 + 8192);
    const res = detectPitchYIN(slice, sampleRate, {
      minFreq: 27,
      maxFreq: 1000,
    });
    assert.ok(
      res.frequency > 0,
      `Expected pitched sustain for ${c.instrument} ${c.freq}Hz`
    );
    const err = centsError(res.frequency, c.freq);
    assert.ok(
      err < 2.5,
      `Synth pitch error ${err.toFixed(2)} cents for ${c.instrument} at ${c.freq}Hz (got ${res.frequency.toFixed(2)}Hz)`
    );

    // Verify natural acoustic decay (tail quieter than attack)
    let earlyEnergy = 0;
    let lateEnergy = 0;
    for (let i = 1000; i < 5000; i++) earlyEnergy += samples[i] * samples[i];
    for (let i = samples.length - 6000; i < samples.length - 2000; i++) {
      lateEnergy += samples[i] * samples[i];
    }
    assert.ok(
      lateEnergy < earlyEnergy,
      `Expected natural acoustic decay for ${c.instrument} ${c.freq}Hz`
    );
  }
});

test('LearnAudioEngine unlocks suspended/interrupted mobile AudioContext and awaits resume before strumming', async () => {
  const startedSources = [];
  let createdCtx = null;

  class MockAudioContext {
    constructor() {
      this.sampleRate = 48000;
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = { kind: 'dest' };
      createdCtx = this;
    }
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect() {},
      };
    }
    createGain() {
      return {
        gain: { value: 1, setValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
    createBiquadFilter() {
      return {
        type: 'peaking',
        frequency: { value: 0 },
        Q: { value: 0 },
        gain: { value: 0 },
        connect() {},
        disconnect() {},
      };
    }
    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      return {
        length,
        sampleRate,
        getChannelData: () => data,
      };
    }
    createBufferSource() {
      const src = {
        buffer: null,
        onended: null,
        connect() {},
        disconnect() {},
        start(when) {
          startedSources.push({ length: src.buffer?.length || 0, when, state: createdCtx.state });
        },
        stop() {},
      };
      return src;
    }
    async resume() {
      await Promise.resolve();
      this.state = 'running';
      this.currentTime = 0.25;
    }
    async close() {
      this.state = 'closed';
    }
  }

  const prevWindow = globalThis.window;
  const prevAudioSession = globalThis.navigator?.audioSession;
  const mockAudioSession = { type: 'auto' };

  globalThis.window = {
    AudioContext: MockAudioContext,
    addEventListener() {},
    removeEventListener() {},
  };
  if (globalThis.navigator) {
    try {
      Object.defineProperty(globalThis.navigator, 'audioSession', {
        configurable: true,
        writable: true,
        value: mockAudioSession,
      });
    } catch {
      // ignore if navigator.audioSession is non-configurable in this Node runtime
    }
  }

  try {
    const engine = new LearnAudioEngine();
    // 1. Tap Strum while iOS AudioContext starts 'suspended'
    engine.playChordStrum([40, 45, 50, 55, 59, 64], 440, 'guitar');

    // Silent 1-sample unlock buffer should fire synchronously on tap
    assert.equal(startedSources.length, 1);
    assert.equal(startedSources[0].length, 1);

    // Wait for ctx.resume() promise to settle
    await new Promise((r) => setTimeout(r, 10));

    // Now all 6 guitar strings should be scheduled AFTER ctx.state === 'running'
    const chordPlucks = startedSources.filter((s) => s.length > 1);
    assert.equal(chordPlucks.length, 6);
    assert.ok(chordPlucks.every((s) => s.state === 'running' && s.when >= 0.25));

    // Verify navigator.audioSession switched to 'playback' (bypasses iPhone silent switch)
    if (globalThis.navigator?.audioSession === mockAudioSession) {
      assert.equal(mockAudioSession.type, 'playback');
    }

    // 2. Simulate iOS 'interrupted' state and ensure it still resumes & plays
    startedSources.length = 0;
    createdCtx.state = 'interrupted';
    engine.playChordStrum([55, 60, 64, 67], 440, 'ukulele');
    await new Promise((r) => setTimeout(r, 10));

    const ukePlucks = startedSources.filter((s) => s.length > 1);
    assert.equal(ukePlucks.length, 4);
    assert.ok(ukePlucks.every((s) => s.state === 'running'));
  } finally {
    globalThis.window = prevWindow;
    if (globalThis.navigator && prevAudioSession !== undefined) {
      try {
        Object.defineProperty(globalThis.navigator, 'audioSession', {
          configurable: true,
          writable: true,
          value: prevAudioSession,
        });
      } catch {
        // ignore
      }
    }
  }
});

test('sampleLibrary manifests match on-disk MP3 assets and resolve nearest sample pitch accurately', () => {
  assert.equal(noteLabelToMidi('E2'), 40);
  assert.equal(noteLabelToMidi('Cs1'), 25);
  assert.equal(noteLabelToMidi('A4'), 69);

  for (const instrument of Object.keys(SAMPLE_LIBRARY_CONFIG)) {
    const entries = getInstrumentSampleEntries(instrument);
    assert.ok(entries.length >= 17, `Expected entries for ${instrument}`);
    for (const entry of entries) {
      const diskPath = path.join(process.cwd(), 'public', entry.url.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath), `Missing sample file on disk: ${diskPath}`);
      assert.ok(fs.statSync(diskPath).size > 10000, `Expected non-empty MP3: ${diskPath}`);
    }
  }

  // Exact chromatic guitar sample match at A4=440
  const exactE2 = findNearestSample('guitar', 82.4068892282175);
  assert.equal(exactE2.note, 'E2');
  assert.ok(Math.abs(exactE2.playbackRate - 1.0) < 0.0005);

  // Custom calibration (A4=432Hz) shifts playbackRate smoothly
  const calibratedA4 = findNearestSample('guitar', 432);
  assert.equal(calibratedA4.note, 'A4');
  assert.ok(Math.abs(calibratedA4.playbackRate - 432 / 440) < 0.0005);

  // Bass multisample picks closest note within <= 1.5 semitones
  const bassA1 = findNearestSample('bass', 55.0);
  assert.ok(bassA1 && bassA1.note);
  assert.ok(Math.abs(bassA1.centsShift) <= 200);

  // Ukulele nylon library maps C4 -> Cs4 (-100c) and A4 -> exact A4
  const ukeA4 = findNearestSample('ukulele', 440.0);
  assert.equal(ukeA4.note, 'A4');
  assert.ok(Math.abs(ukeA4.playbackRate - 1.0) < 0.0005);
});

test('LearnAudioEngine uses decoded studio sample buffers with calibrated playbackRate when fetch & decodeAudioData succeed', async () => {
  const scheduledPlays = [];
  const fakeStudioBuffer = { duration: 3.1, length: 136710, sampleRate: 44100 };

  class MockStudioAudioContext {
    constructor() {
      this.sampleRate = 44100;
      this.state = 'running';
      this.currentTime = 1.0;
      this.destination = { kind: 'dest' };
    }
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect() {},
      };
    }
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          cancelScheduledValues() {},
          setTargetAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    }
    createBiquadFilter() {
      return {
        type: 'peaking',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        Q: { value: 0 },
        gain: { value: 0 },
        connect() {},
        disconnect() {},
      };
    }
    createStereoPanner() {
      return { pan: { value: 0 }, connect() {}, disconnect() {} };
    }
    createBuffer(channels, length, sampleRate) {
      return {
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: () => new Float32Array(length),
      };
    }
    createBufferSource() {
      const src = {
        buffer: null,
        playbackRate: { value: 1, setValueAtTime(v) { src.playbackRate.value = v; } },
        onended: null,
        connect() {},
        disconnect() {},
        start(when) {
          if (src.buffer && src.buffer.length > 1) {
            scheduledPlays.push({ buffer: src.buffer, rate: src.playbackRate.value, when });
          }
        },
        stop() {},
      };
      return src;
    }
    async decodeAudioData() {
      return fakeStudioBuffer;
    }
    async close() {
      this.state = 'closed';
    }
  }

  const prevWindow = globalThis.window;
  const prevFetch = globalThis.fetch;

  globalThis.window = {
    AudioContext: MockStudioAudioContext,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.fetch = async () => ({
    ok: true,
    async arrayBuffer() {
      return new ArrayBuffer(16);
    },
  });

  try {
    const engine = new LearnAudioEngine();
    // Play a 6-string guitar chord at calibrated A4=432Hz
    engine.playChordStrum([40, 45, 50, 55, 59, 64], 432, 'guitar');

    await new Promise((r) => setTimeout(r, 25));

    assert.equal(scheduledPlays.length, 6);
    assert.ok(scheduledPlays.every((p) => p.buffer === fakeStudioBuffer));
    assert.ok(scheduledPlays.every((p) => Math.abs(p.rate - 432 / 440) < 0.001));
    // Verify staggered downstroke timing
    for (let i = 1; i < scheduledPlays.length; i++) {
      assert.ok(scheduledPlays[i].when > scheduledPlays[i - 1].when);
    }
  } finally {
    globalThis.window = prevWindow;
    globalThis.fetch = prevFetch;
  }
});

test('themeUtils normalizes, toggles, persists, and applies Pixelated theme without touching tuner math', () => {
  assert.equal(normalizeTheme('pixel'), THEME_IDS.PIXEL);
  assert.equal(normalizeTheme('studio'), THEME_IDS.STUDIO);
  assert.equal(normalizeTheme('unknown'), THEME_IDS.STUDIO);
  assert.equal(toggleThemeValue('studio'), 'pixel');
  assert.equal(toggleThemeValue('pixel'), 'studio');

  const storageMap = new Map();
  const prevWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, v),
    },
  };

  try {
    assert.equal(loadTheme(), 'studio');
    saveTheme('pixel');
    assert.equal(storageMap.get(THEME_STORAGE_KEY), 'pixel');
    assert.equal(loadTheme(), 'pixel');

    const classes = new Set();
    const fakeDoc = {
      documentElement: {
        dataset: {},
        classList: {
          add: (c) => classes.add(c),
          remove: (c) => classes.delete(c),
        },
      },
    };

    applyThemeToDocument('pixel', fakeDoc);
    assert.equal(fakeDoc.documentElement.dataset.theme, 'pixel');
    assert.equal(classes.has('pixel-theme'), true);

    applyThemeToDocument('studio', fakeDoc);
    assert.equal(fakeDoc.documentElement.dataset.theme, undefined);
    assert.equal(classes.has('pixel-theme'), false);
  } finally {
    globalThis.window = prevWindow;
  }
});

test('LearnAudioEngine builds directional down, up, and bass strum schedules accurately', () => {
  const engine = new LearnAudioEngine();
  const chordMidi = [40, 45, 50, 55, 59, 64]; // E2 -> E4

  const down = engine._buildStrumSchedule(chordMidi, 440, 'guitar', { direction: 'down' });
  assert.equal(down.length, 6);
  assert.ok(down[0].freq < down[5].freq);
  assert.ok(down[0].delaySec < down[5].delaySec);

  // Upstroke brushes upper 5 strings from highest pitch down to lower pitch
  const up = engine._buildStrumSchedule(chordMidi, 440, 'guitar', { direction: 'up' });
  assert.equal(up.length, 5);
  assert.ok(up[0].freq > up[4].freq);
  assert.ok(up[0].delaySec < up[4].delaySec);

  // Bass stroke picks only lowest 2 bass strings
  const bass = engine._buildStrumSchedule(chordMidi, 440, 'guitar', { direction: 'bass' });
  assert.equal(bass.length, 2);
  assert.ok(bass[0].freq < bass[1].freq);
});

