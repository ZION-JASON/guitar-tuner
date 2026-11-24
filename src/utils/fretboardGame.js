import { CHROMATIC_NOTES, getInstrumentConfig } from './musicTheory.js';

export const FRETBOARD_GAME_STORAGE_KEY = 'chromatuner.fretboardGameStats.v1';
export const QUIZ_ROUND_COUNT = 10;
export const BLITZ_DURATION_SEC = 60;

export const NATURAL_PC_SET = new Set([0, 2, 4, 5, 7, 9, 11]);
export const NATURAL_NOTE_OPTIONS = CHROMATIC_NOTES.filter((n) => NATURAL_PC_SET.has(n.index));

export const FRET_RANGES = [
  { id: 'beginner', label: '0–5 Beginner', minFret: 0, maxFret: 5 },
  { id: 'octave', label: '0–12 Octave', minFret: 0, maxFret: 12 },
  { id: 'full', label: '0–15 Full Neck', minFret: 0, maxFret: 15 },
];

export const GAME_MODES = [
  { id: 'practice', label: 'Practice', desc: 'Untimed learning with hints & sound' },
  { id: 'blitz60', label: '60s Blitz', desc: 'Race the clock & beat your high score' },
  { id: 'quiz10', label: '10-Round Quiz', desc: 'Scored 10-note accuracy challenge' },
];

export const NOTE_POOLS = [
  { id: 'natural', label: 'Natural Notes (C–B)' },
  { id: 'chromatic', label: 'All 12 Notes' },
];

export function getFretRangeConfig(rangeId = 'octave') {
  return FRET_RANGES.find((r) => r.id === rangeId) || FRET_RANGES[1];
}

export function getStringFilterOptions(instrument = 'guitar') {
  const cfg = getInstrumentConfig(instrument);
  const options = [{ id: 'all', label: 'All Strings' }];

  if (cfg.openMidi.length >= 6) {
    options.push({ id: 'bass-roots', label: '6E & 5A Roots' });
  } else if (cfg.openMidi.length === 4) {
    options.push({ id: 'bass-roots', label: 'Low 2 Strings' });
  }

  // Ordered highest string (1) down to lowest string (N), matching fretboard display
  for (let sIdx = cfg.openMidi.length - 1; sIdx >= 0; sIdx -= 1) {
    const stringNum = cfg.openMidi.length - sIdx;
    const label = cfg.stringLabels[sIdx] || `S${stringNum}`;
    options.push({ id: `s:${stringNum}`, label });
  }

  return options;
}

export function buildFretboardQuestionPool({
  instrument = 'guitar',
  fretRangeId = 'octave',
  notePool = 'natural',
  stringFilter = 'all',
} = {}) {
  const cfg = getInstrumentConfig(instrument);
  const range = getFretRangeConfig(fretRangeId);
  const totalStrings = cfg.openMidi.length;

  let allowedStringNums = null;
  if (stringFilter === 'bass-roots') {
    allowedStringNums = new Set([totalStrings, Math.max(1, totalStrings - 1)]);
  } else if (typeof stringFilter === 'string' && stringFilter.startsWith('s:')) {
    const parsed = Number(stringFilter.slice(2));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= totalStrings) {
      allowedStringNums = new Set([parsed]);
    }
  }

  const pool = [];
  for (let sIdx = totalStrings - 1; sIdx >= 0; sIdx -= 1) {
    const stringNum = totalStrings - sIdx;
    if (allowedStringNums && !allowedStringNums.has(stringNum)) continue;

    const openMidi = cfg.openMidi[sIdx];
    const stringLabel = cfg.stringLabels[sIdx] || `S${stringNum}`;
    const openPc = ((openMidi % 12) + 12) % 12;

    for (let fret = range.minFret; fret <= range.maxFret; fret += 1) {
      const midi = openMidi + fret;
      const pc = ((midi % 12) + 12) % 12;
      const isNatural = NATURAL_PC_SET.has(pc);
      if (notePool === 'natural' && !isNatural) continue;

      const noteMeta = CHROMATIC_NOTES[pc];
      pool.push({
        id: `${cfg.id}:s${stringNum}:f${fret}`,
        instrument: cfg.id,
        stringNum,
        stringLabel,
        openPc,
        openNote: CHROMATIC_NOTES[openPc].name,
        fret,
        midi,
        pc,
        sharpName: noteMeta.name,
        flatName: noteMeta.flatName,
        dualLabel: noteMeta.label,
        isNatural,
      });
    }
  }

  // Graceful fallback if filter yielded 0 items
  if (pool.length === 0 && stringFilter !== 'all') {
    return buildFretboardQuestionPool({
      instrument,
      fretRangeId,
      notePool,
      stringFilter: 'all',
    });
  }

  return pool;
}

export function pickNextFretboardQuestion(pool, prevTarget = null, rngFn = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  let candidates = pool;
  if (prevTarget) {
    const nonSameCell = pool.filter(
      (cell) => !(cell.stringNum === prevTarget.stringNum && cell.fret === prevTarget.fret)
    );
    const nonSamePc = nonSameCell.filter((cell) => cell.pc !== prevTarget.pc);
    if (nonSamePc.length > 0) {
      candidates = nonSamePc;
    } else if (nonSameCell.length > 0) {
      candidates = nonSameCell;
    }
  }

  const rawRand = typeof rngFn === 'function' ? rngFn() : Math.random();
  const safeIdx = Math.min(candidates.length - 1, Math.max(0, Math.floor(rawRand * candidates.length)));
  return candidates[safeIdx];
}

export function buildLandmarkTip(target) {
  if (!target) return '';
  const { stringLabel, openNote, fret, dualLabel } = target;

  if (fret === 0) {
    return `Open ${stringLabel} string is always ${dualLabel}.`;
  }
  if (fret === 12) {
    return `12th fret (double dot) repeats the open ${openNote} string 1 octave higher (${dualLabel}).`;
  }
  if (fret === 5) {
    return `5th fret on ${stringLabel} is 5 semitones (a Perfect 4th) up from open ${openNote} → ${dualLabel}.`;
  }
  if (fret === 7) {
    return `7th fret on ${stringLabel} is 7 semitones (a Perfect 5th) up from open ${openNote} → ${dualLabel}.`;
  }
  if (fret > 12) {
    const aboveOctave = fret - 12;
    return `Same note as fret ${aboveOctave} on ${stringLabel}, just 1 octave above the 12th fret (${openNote} + ${aboveOctave}st = ${dualLabel}).`;
  }
  if (fret >= 9) {
    const downFromOctave = 12 - fret;
    return `${downFromOctave} fret${downFromOctave === 1 ? '' : 's'} below the 12th-fret octave ${openNote} on ${stringLabel} = ${dualLabel}.`;
  }
  return `Start at open ${stringLabel} (${openNote}) and count up ${fret} semitone${fret === 1 ? '' : 's'} = ${dualLabel}.`;
}

export function evaluateFretboardGuess(target, guessedPc, responseMs = 0) {
  if (!target) return null;
  const safeGuessPc = ((Math.round(Number(guessedPc)) % 12) + 12) % 12;
  const isCorrect = safeGuessPc === target.pc;
  const guessedMeta = CHROMATIC_NOTES[safeGuessPc];
  const landmarkTip = buildLandmarkTip(target);

  return {
    isCorrect,
    targetPc: target.pc,
    guessedPc: safeGuessPc,
    correctLabel: target.dualLabel,
    guessedLabel: guessedMeta ? guessedMeta.label : '',
    feedbackTitle: isCorrect
      ? `Correct! ${target.stringLabel} Fret ${target.fret} is ${target.dualLabel}`
      : `Not quite — you picked ${guessedMeta ? guessedMeta.label : '?'}, answer is ${target.dualLabel}`,
    landmarkTip,
    responseMs: Math.max(0, Number(responseMs) || 0),
  };
}

export function getOctaveAnchorCells(pool, target) {
  if (!Array.isArray(pool) || !target) return [];
  return pool.filter(
    (cell) =>
      cell.pc === target.pc &&
      !(cell.stringNum === target.stringNum && cell.fret === target.fret)
  );
}

const DEFAULT_STATS = {
  bestBlitzScore: 0,
  bestQuizScore: 0,
  bestStreak: 0,
  totalCorrect: 0,
  totalAttempts: 0,
};

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

export function loadFretboardGameStats(storageOverride = null) {
  const storage = getSafeStorage(storageOverride);
  if (!storage) return { ...DEFAULT_STATS };
  try {
    const raw = storage.getItem(FRETBOARD_GAME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw);
    return {
      bestBlitzScore: Math.max(0, Number(parsed?.bestBlitzScore) || 0),
      bestQuizScore: Math.max(0, Number(parsed?.bestQuizScore) || 0),
      bestStreak: Math.max(0, Number(parsed?.bestStreak) || 0),
      totalCorrect: Math.max(0, Number(parsed?.totalCorrect) || 0),
      totalAttempts: Math.max(0, Number(parsed?.totalAttempts) || 0),
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveFretboardGameStats(stats, storageOverride = null) {
  const safe = {
    bestBlitzScore: Math.max(0, Number(stats?.bestBlitzScore) || 0),
    bestQuizScore: Math.max(0, Number(stats?.bestQuizScore) || 0),
    bestStreak: Math.max(0, Number(stats?.bestStreak) || 0),
    totalCorrect: Math.max(0, Number(stats?.totalCorrect) || 0),
    totalAttempts: Math.max(0, Number(stats?.totalAttempts) || 0),
  };
  const storage = getSafeStorage(storageOverride);
  if (storage) {
    try {
      storage.setItem(FRETBOARD_GAME_STORAGE_KEY, JSON.stringify(safe));
    } catch {
      // ignore storage quota errors
    }
  }
  return safe;
}
