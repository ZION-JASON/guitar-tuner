import { midiToFrequency } from './frequencyUtils.js';

const PITCH_CLASS_MAP = {
  C: 0,
  Cs: 1,
  D: 2,
  Ds: 3,
  E: 4,
  F: 5,
  Fs: 6,
  G: 7,
  Gs: 8,
  A: 9,
  As: 10,
  B: 11,
};

export const SAMPLE_LIBRARY_CONFIG = {
  guitar: {
    folder: 'guitar-acoustic',
    basePath: '/samples/guitar-acoustic',
    notes: [
      'D2', 'Ds2', 'E2', 'F2', 'Fs2', 'G2', 'Gs2', 'A2', 'As2', 'B2',
      'C3', 'Cs3', 'D3', 'Ds3', 'E3', 'F3', 'Fs3', 'G3', 'Gs3', 'A3', 'As3', 'B3',
      'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'Fs4', 'G4', 'Gs4', 'A4', 'As4', 'B4',
      'C5', 'Cs5', 'D5',
    ],
    priorityNotes: [
      'E2', 'G2', 'A2', 'B2',
      'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
      'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    ],
  },
  bass: {
    folder: 'bass-electric',
    basePath: '/samples/bass-electric',
    notes: [
      'Cs1', 'E1', 'G1', 'As1',
      'Cs2', 'E2', 'G2', 'As2',
      'Cs3', 'E3', 'G3', 'As3',
      'Cs4', 'E4', 'G4', 'As4',
      'Cs5',
    ],
    priorityNotes: ['E1', 'G1', 'As1', 'Cs2', 'E2', 'G2', 'As2', 'Cs3', 'E3', 'G3'],
  },
  ukulele: {
    folder: 'guitar-nylon',
    basePath: '/samples/guitar-nylon',
    notes: [
      'B1', 'D2', 'E2', 'Fs2', 'Gs2', 'A2', 'B2',
      'Cs3', 'D3', 'E3', 'Fs3', 'G3', 'A3', 'B3',
      'Cs4', 'Ds4', 'E4', 'Fs4', 'Gs4', 'A4', 'B4',
      'Cs5', 'D5', 'E5', 'Fs5', 'G5', 'Gs5', 'A5', 'As5',
    ],
    priorityNotes: ['G3', 'A3', 'Cs4', 'E4', 'Fs4', 'A4', 'B4', 'Cs5', 'D5', 'E5'],
  },
};

export function noteLabelToMidi(label) {
  if (typeof label !== 'string') return Number.NaN;
  const match = /^([A-G]s?)(\d+)$/.exec(label.trim());
  if (!match) return Number.NaN;
  const [, pitchName, octaveStr] = match;
  const pc = PITCH_CLASS_MAP[pitchName];
  if (pc === undefined) return Number.NaN;
  const octave = Number.parseInt(octaveStr, 10);
  return (octave + 1) * 12 + pc;
}

const builtInstrumentTables = new Map();

export function getInstrumentSampleEntries(instrument = 'guitar') {
  const normalized = SAMPLE_LIBRARY_CONFIG[instrument] ? instrument : 'guitar';
  if (builtInstrumentTables.has(normalized)) {
    return builtInstrumentTables.get(normalized);
  }

  const cfg = SAMPLE_LIBRARY_CONFIG[normalized];
  const entries = cfg.notes
    .map((note) => {
      const midi = noteLabelToMidi(note);
      const baseFreq = midiToFrequency(midi, 440);
      return {
        instrument: normalized,
        folder: cfg.folder,
        note,
        midi,
        baseFreq,
        key: `${normalized}:${note}`,
        url: `${cfg.basePath}/${note}.mp3`,
      };
    })
    .filter((entry) => Number.isFinite(entry.midi) && Number.isFinite(entry.baseFreq))
    .sort((a, b) => a.midi - b.midi);

  builtInstrumentTables.set(normalized, entries);
  return entries;
}

export function findNearestSample(instrument = 'guitar', targetFreq) {
  if (!Number.isFinite(targetFreq) || targetFreq <= 0) return null;
  const entries = getInstrumentSampleEntries(instrument);
  if (entries.length === 0) return null;

  let best = entries[0];
  let bestDist = Math.abs(Math.log2(targetFreq / best.baseFreq));

  for (let i = 1; i < entries.length; i++) {
    const candidate = entries[i];
    const dist = Math.abs(Math.log2(targetFreq / candidate.baseFreq));
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }

  const rawRate = targetFreq / best.baseFreq;
  const playbackRate = Math.max(0.25, Math.min(4.0, rawRate));
  const centsShift = 1200 * Math.log2(playbackRate);

  return {
    ...best,
    playbackRate,
    centsShift,
  };
}

export function getCoreWarmupSamples(instrument = 'guitar') {
  const normalized = SAMPLE_LIBRARY_CONFIG[instrument] ? instrument : 'guitar';
  const cfg = SAMPLE_LIBRARY_CONFIG[normalized];
  const entries = getInstrumentSampleEntries(normalized);
  const byNote = new Map(entries.map((e) => [e.note, e]));

  const prioritized = [];
  const seen = new Set();

  for (const note of cfg.priorityNotes) {
    const entry = byNote.get(note);
    if (entry && !seen.has(entry.key)) {
      prioritized.push(entry);
      seen.add(entry.key);
    }
  }

  for (const entry of entries) {
    if (!seen.has(entry.key)) {
      prioritized.push(entry);
      seen.add(entry.key);
    }
  }

  return prioritized;
}

function decodeAudioDataCompat(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const maybePromise = ctx.decodeAudioData(
        arrayBuffer,
        (decoded) => resolve(decoded),
        (err) => reject(err || new Error('Audio decode failed'))
      );
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve, reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export async function loadSampleBuffer(ctx, sampleEntry, sampleCache, inFlightMap) {
  if (
    !ctx ||
    ctx.state === 'closed' ||
    !sampleEntry ||
    !sampleEntry.url ||
    typeof fetch !== 'function' ||
    typeof ctx.decodeAudioData !== 'function'
  ) {
    return null;
  }

  const cacheKey = sampleEntry.key;
  if (sampleCache.has(cacheKey)) {
    return sampleCache.get(cacheKey);
  }

  if (inFlightMap.has(cacheKey)) {
    return inFlightMap.get(cacheKey);
  }

  const task = (async () => {
    try {
      const response = await fetch(sampleEntry.url, { credentials: 'same-origin' });
      if (!response || !response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      if (!ctx || ctx.state === 'closed') return null;
      const decoded = await decodeAudioDataCompat(ctx, arrayBuffer);
      if (decoded && ctx.state !== 'closed') {
        sampleCache.set(cacheKey, decoded);
        return decoded;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightMap.delete(cacheKey);
    }
  })();

  inFlightMap.set(cacheKey, task);
  return task;
}
