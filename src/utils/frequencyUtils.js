export const NOTE_STRINGS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export const MIN_REF_FREQUENCY = 415;
export const MAX_REF_FREQUENCY = 466;
export const DEFAULT_REF_FREQUENCY = 440;

export function clampRefFrequency(ref) {
  const num = Number(ref);
  if (!Number.isFinite(num)) return DEFAULT_REF_FREQUENCY;
  return Math.min(MAX_REF_FREQUENCY, Math.max(MIN_REF_FREQUENCY, Math.round(num)));
}

export function midiToFrequency(midiNote, ref = DEFAULT_REF_FREQUENCY) {
  const safeRef = clampRefFrequency(ref);
  if (!Number.isFinite(midiNote)) return 0;
  return safeRef * Math.pow(2, (midiNote - 69) / 12);
}

export function getNoteFromFrequency(frequency, ref = DEFAULT_REF_FREQUENCY) {
  const safeRef = clampRefFrequency(ref);
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return {
      noteName: '-',
      octave: null,
      fullNote: '--',
      midiNote: null,
      cents: 0,
      targetFrequency: 0,
    };
  }

  const n = 12 * Math.log2(frequency / safeRef);
  const roundedN = Math.round(n);
  const midiNote = roundedN + 69;

  // Proper positive modulo for any MIDI note range
  const noteIndex = ((midiNote % 12) + 12) % 12;
  const noteName = NOTE_STRINGS[noteIndex];
  const octave = Math.floor(midiNote / 12) - 1;
  const cents = (n - roundedN) * 100;
  const targetFrequency = safeRef * Math.pow(2, roundedN / 12);

  return {
    noteName,
    octave,
    fullNote: `${noteName}${octave}`,
    midiNote,
    cents,
    targetFrequency,
  };
}

export const INSTRUMENTS = [
  {
    id: 'guitar',
    label: 'Guitar',
    shortLabel: '6-String · EADGBE',
    stringCount: 6,
    defaultPresetId: 'standard',
    minFreq: 38,
    maxFreq: 1200,
  },
  {
    id: 'bass',
    label: 'Bass',
    shortLabel: '4/5-String · EADG',
    stringCount: 4,
    defaultPresetId: 'bass_standard',
    minFreq: 27,
    maxFreq: 600,
  },
  {
    id: 'ukulele',
    label: 'Ukulele',
    shortLabel: '4-String · GCEA',
    stringCount: 4,
    defaultPresetId: 'uke_standard',
    minFreq: 140,
    maxFreq: 1200,
  },
];

export function getInstrumentMeta(instrumentId) {
  return INSTRUMENTS.find((inst) => inst.id === instrumentId) || INSTRUMENTS[0];
}

export const TUNING_PRESETS = [
  {
    id: 'chromatic',
    instrument: 'all',
    label: 'CHROMATIC',
    shortLabel: 'AUTO',
    strings: [],
  },
  // Guitar Presets
  {
    id: 'standard',
    instrument: 'guitar',
    label: 'STANDARD',
    shortLabel: 'EADGBE',
    strings: [
      { stringNum: 6, noteName: 'E', octave: 2, midi: 40 },
      { stringNum: 5, noteName: 'A', octave: 2, midi: 45 },
      { stringNum: 4, noteName: 'D', octave: 3, midi: 50 },
      { stringNum: 3, noteName: 'G', octave: 3, midi: 55 },
      { stringNum: 2, noteName: 'B', octave: 3, midi: 59 },
      { stringNum: 1, noteName: 'E', octave: 4, midi: 64 },
    ],
  },
  {
    id: 'drop_d',
    instrument: 'guitar',
    label: 'DROP D',
    shortLabel: 'DADGBE',
    strings: [
      { stringNum: 6, noteName: 'D', octave: 2, midi: 38 },
      { stringNum: 5, noteName: 'A', octave: 2, midi: 45 },
      { stringNum: 4, noteName: 'D', octave: 3, midi: 50 },
      { stringNum: 3, noteName: 'G', octave: 3, midi: 55 },
      { stringNum: 2, noteName: 'B', octave: 3, midi: 59 },
      { stringNum: 1, noteName: 'E', octave: 4, midi: 64 },
    ],
  },
  {
    id: 'eb_standard',
    instrument: 'guitar',
    label: 'Eb STANDARD',
    shortLabel: 'HALF DOWN',
    strings: [
      { stringNum: 6, noteName: 'D#', octave: 2, midi: 39 },
      { stringNum: 5, noteName: 'G#', octave: 2, midi: 44 },
      { stringNum: 4, noteName: 'C#', octave: 3, midi: 49 },
      { stringNum: 3, noteName: 'F#', octave: 3, midi: 54 },
      { stringNum: 2, noteName: 'A#', octave: 3, midi: 58 },
      { stringNum: 1, noteName: 'D#', octave: 4, midi: 63 },
    ],
  },
  {
    id: 'dadgad',
    instrument: 'guitar',
    label: 'DADGAD',
    shortLabel: 'MODAL D',
    strings: [
      { stringNum: 6, noteName: 'D', octave: 2, midi: 38 },
      { stringNum: 5, noteName: 'A', octave: 2, midi: 45 },
      { stringNum: 4, noteName: 'D', octave: 3, midi: 50 },
      { stringNum: 3, noteName: 'G', octave: 3, midi: 55 },
      { stringNum: 2, noteName: 'A', octave: 3, midi: 57 },
      { stringNum: 1, noteName: 'D', octave: 4, midi: 62 },
    ],
  },
  {
    id: 'open_g',
    instrument: 'guitar',
    label: 'OPEN G',
    shortLabel: 'DGDGBD',
    strings: [
      { stringNum: 6, noteName: 'D', octave: 2, midi: 38 },
      { stringNum: 5, noteName: 'G', octave: 2, midi: 43 },
      { stringNum: 4, noteName: 'D', octave: 3, midi: 50 },
      { stringNum: 3, noteName: 'G', octave: 3, midi: 55 },
      { stringNum: 2, noteName: 'B', octave: 3, midi: 59 },
      { stringNum: 1, noteName: 'D', octave: 4, midi: 62 },
    ],
  },
  // Bass Presets
  {
    id: 'bass_standard',
    instrument: 'bass',
    label: '4-STRING STD',
    shortLabel: 'EADG',
    strings: [
      { stringNum: 4, noteName: 'E', octave: 1, midi: 28 },
      { stringNum: 3, noteName: 'A', octave: 1, midi: 33 },
      { stringNum: 2, noteName: 'D', octave: 2, midi: 38 },
      { stringNum: 1, noteName: 'G', octave: 2, midi: 43 },
    ],
  },
  {
    id: 'bass_drop_d',
    instrument: 'bass',
    label: 'BASS DROP D',
    shortLabel: 'DADG',
    strings: [
      { stringNum: 4, noteName: 'D', octave: 1, midi: 26 },
      { stringNum: 3, noteName: 'A', octave: 1, midi: 33 },
      { stringNum: 2, noteName: 'D', octave: 2, midi: 38 },
      { stringNum: 1, noteName: 'G', octave: 2, midi: 43 },
    ],
  },
  {
    id: 'bass_5_string',
    instrument: 'bass',
    label: '5-STRING STD',
    shortLabel: 'BEADG',
    strings: [
      { stringNum: 5, noteName: 'B', octave: 0, midi: 23 },
      { stringNum: 4, noteName: 'E', octave: 1, midi: 28 },
      { stringNum: 3, noteName: 'A', octave: 1, midi: 33 },
      { stringNum: 2, noteName: 'D', octave: 2, midi: 38 },
      { stringNum: 1, noteName: 'G', octave: 2, midi: 43 },
    ],
  },
  {
    id: 'bass_half_down',
    instrument: 'bass',
    label: 'BASS Eb STD',
    shortLabel: 'Eb Ab Db Gb',
    strings: [
      { stringNum: 4, noteName: 'D#', octave: 1, midi: 27 },
      { stringNum: 3, noteName: 'G#', octave: 1, midi: 32 },
      { stringNum: 2, noteName: 'C#', octave: 2, midi: 37 },
      { stringNum: 1, noteName: 'F#', octave: 2, midi: 42 },
    ],
  },
  // Ukulele Presets
  {
    id: 'uke_standard',
    instrument: 'ukulele',
    label: 'HIGH-G (GCEA)',
    shortLabel: 'RE-ENTRANT',
    strings: [
      { stringNum: 4, noteName: 'G', octave: 4, midi: 67 },
      { stringNum: 3, noteName: 'C', octave: 4, midi: 60 },
      { stringNum: 2, noteName: 'E', octave: 4, midi: 64 },
      { stringNum: 1, noteName: 'A', octave: 4, midi: 69 },
    ],
  },
  {
    id: 'uke_low_g',
    instrument: 'ukulele',
    label: 'LOW-G (GCEA)',
    shortLabel: 'LINEAR GCEA',
    strings: [
      { stringNum: 4, noteName: 'G', octave: 3, midi: 55 },
      { stringNum: 3, noteName: 'C', octave: 4, midi: 60 },
      { stringNum: 2, noteName: 'E', octave: 4, midi: 64 },
      { stringNum: 1, noteName: 'A', octave: 4, midi: 69 },
    ],
  },
  {
    id: 'uke_baritone',
    instrument: 'ukulele',
    label: 'BARITONE',
    shortLabel: 'DGBE',
    strings: [
      { stringNum: 4, noteName: 'D', octave: 3, midi: 50 },
      { stringNum: 3, noteName: 'G', octave: 3, midi: 55 },
      { stringNum: 2, noteName: 'B', octave: 3, midi: 59 },
      { stringNum: 1, noteName: 'E', octave: 4, midi: 64 },
    ],
  },
  {
    id: 'uke_d_tuning',
    instrument: 'ukulele',
    label: 'D-TUNING',
    shortLabel: 'ADF#B',
    strings: [
      { stringNum: 4, noteName: 'A', octave: 4, midi: 69 },
      { stringNum: 3, noteName: 'D', octave: 4, midi: 62 },
      { stringNum: 2, noteName: 'F#', octave: 4, midi: 66 },
      { stringNum: 1, noteName: 'B', octave: 4, midi: 71 },
    ],
  },
];

export function getPresetsForInstrument(instrumentId) {
  return TUNING_PRESETS.filter(
    (p) => p.instrument === 'all' || p.instrument === instrumentId
  );
}

export function getDefaultPresetIdForInstrument(instrumentId) {
  return getInstrumentMeta(instrumentId).defaultPresetId;
}

export function matchPresetString(
  frequency,
  presetId,
  ref = DEFAULT_REF_FREQUENCY,
  lockedStringNum = null
) {
  const safeRef = clampRefFrequency(ref);
  const preset = TUNING_PRESETS.find((p) => p.id === presetId) || TUNING_PRESETS[0];

  if (!Number.isFinite(frequency) || frequency <= 0) {
    const locked =
      lockedStringNum !== null
        ? preset.strings.find((s) => s.stringNum === lockedStringNum) || null
        : null;
    return {
      noteName: locked ? locked.noteName : '-',
      octave: locked ? locked.octave : null,
      fullNote: locked ? `${locked.noteName}${locked.octave}` : '--',
      midiNote: locked ? locked.midi : null,
      cents: 0,
      targetFrequency: locked ? midiToFrequency(locked.midi, safeRef) : 0,
      matchedStringNum: locked ? locked.stringNum : null,
      isLockedMode: Boolean(locked),
    };
  }

  if (preset.strings.length === 0) {
    return {
      ...getNoteFromFrequency(frequency, safeRef),
      matchedStringNum: null,
      isLockedMode: false,
    };
  }

  let targetString = null;
  if (lockedStringNum !== null) {
    targetString = preset.strings.find((s) => s.stringNum === lockedStringNum) || null;
  }

  if (!targetString) {
    let minAbsCents = Infinity;
    for (const s of preset.strings) {
      const targetFreq = midiToFrequency(s.midi, safeRef);
      const cents = 1200 * Math.log2(frequency / targetFreq);
      if (Math.abs(cents) < minAbsCents) {
        minAbsCents = Math.abs(cents);
        targetString = s;
      }
    }
  }

  const targetFreq = midiToFrequency(targetString.midi, safeRef);
  const rawCents = 1200 * Math.log2(frequency / targetFreq);
  const clampedCents = Math.max(-50, Math.min(50, rawCents));

  return {
    noteName: targetString.noteName,
    octave: targetString.octave,
    fullNote: `${targetString.noteName}${targetString.octave}`,
    midiNote: targetString.midi,
    cents: clampedCents,
    rawCents,
    targetFrequency: targetFreq,
    matchedStringNum: targetString.stringNum,
    isLockedMode: lockedStringNum !== null,
  };
}

/**
 * Median + hysteresis pitch stabilizer to eliminate single-frame octave glitches
 * and smooth needle micro-jitter without blurring note transitions.
 */
export class PitchStabilizer {
  constructor(windowSize = 5) {
    this.windowSize = windowSize;
    this.freqWindow = [];
    this.pendingFreq = null;
    this.pendingCount = 0;
    this.smoothedFreq = 0;
  }

  reset() {
    this.freqWindow = [];
    this.pendingFreq = null;
    this.pendingCount = 0;
    this.smoothedFreq = 0;
  }

  push(frequency, clarity = 1) {
    if (!Number.isFinite(frequency) || frequency <= 0 || clarity < 0.7) {
      return this.smoothedFreq > 0 ? this.smoothedFreq : -1;
    }

    if (this.freqWindow.length > 0) {
      const currentMedian = this._median(this.freqWindow);
      const semitoneDiff = Math.abs(12 * Math.log2(frequency / currentMedian));

      // Require 2 consecutive consistent frames before jumping > 0.7 semitones
      if (semitoneDiff > 0.7) {
        if (
          this.pendingFreq !== null &&
          Math.abs(12 * Math.log2(frequency / this.pendingFreq)) < 0.45
        ) {
          this.pendingCount++;
        } else {
          this.pendingFreq = frequency;
          this.pendingCount = 1;
        }

        if (this.pendingCount >= 2) {
          this.freqWindow = [this.pendingFreq, frequency];
          this.pendingFreq = null;
          this.pendingCount = 0;
          this.smoothedFreq = frequency;
          return this.smoothedFreq;
        }
        return this.smoothedFreq;
      }
    }

    this.pendingFreq = null;
    this.pendingCount = 0;
    this.freqWindow.push(frequency);
    if (this.freqWindow.length > this.windowSize) {
      this.freqWindow.shift();
    }

    const median = this._median(this.freqWindow);
    if (this.smoothedFreq <= 0) {
      this.smoothedFreq = median;
    } else {
      // Smooth in log-frequency space
      const alpha = 0.4;
      this.smoothedFreq = Math.exp(
        alpha * Math.log(median) + (1 - alpha) * Math.log(this.smoothedFreq)
      );
    }
    return this.smoothedFreq;
  }

  _median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}