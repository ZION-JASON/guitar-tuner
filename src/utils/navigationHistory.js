import {
  CHORD_QUALITIES,
  getInstrumentConfig,
  PROGRESSION_TEMPLATES,
  SCALE_DEFINITIONS,
  getNoteName,
  shouldPreferFlats,
} from './musicTheory.js';

export const VALID_INSTRUMENTS = ['guitar', 'bass', 'ukulele'];

export const DEFAULT_LEARN_STATE = {
  tab: 'chords',
  rootPc: 0,
  chordQuery: '',
  chordCategory: 'All',
  chordLabelMode: 'fingers',
  chordPlayMode: 'strum',
  scaleId: 'major',
  scaleLabelMode: 'notes',
  boxFilter: 'all',
  progressionId: 'three_chord_family',
  familyModalTarget: null,
};

export function createInitialNavSnapshot() {
  return {
    view: 'tuner',
    instrument: 'guitar',
    learn: { ...DEFAULT_LEARN_STATE },
    stepIndex: 0,
    prevLabel: null,
  };
}

export function normalizeNavSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    return createInitialNavSnapshot();
  }
  const learnRaw = raw.learn && typeof raw.learn === 'object' ? raw.learn : {};
  const validTab = ['chords', 'scales', 'progressions', 'theory'].includes(learnRaw.tab)
    ? learnRaw.tab
    : 'chords';
  const validInstrument = VALID_INSTRUMENTS.includes(raw.instrument)
    ? raw.instrument
    : 'guitar';
  const validPlayMode = ['strum', 'arpeggio'].includes(learnRaw.chordPlayMode)
    ? learnRaw.chordPlayMode
    : 'strum';
  const rootPc =
    typeof learnRaw.rootPc === 'number' && Number.isFinite(learnRaw.rootPc)
      ? ((Math.round(learnRaw.rootPc) % 12) + 12) % 12
      : 0;

  return {
    view: raw.view === 'learn' ? 'learn' : 'tuner',
    instrument: validInstrument,
    learn: {
      ...DEFAULT_LEARN_STATE,
      ...learnRaw,
      tab: validTab,
      rootPc,
      chordPlayMode: validPlayMode,
      chordQuery: typeof learnRaw.chordQuery === 'string' ? learnRaw.chordQuery : '',
      familyModalTarget:
        learnRaw.familyModalTarget &&
        typeof learnRaw.familyModalTarget.rootPc === 'number'
          ? { ...learnRaw.familyModalTarget }
          : null,
    },
    stepIndex:
      typeof raw.stepIndex === 'number' && raw.stepIndex >= 0
        ? raw.stepIndex
        : 0,
    prevLabel: typeof raw.prevLabel === 'string' ? raw.prevLabel : null,
  };
}

export function describeNavSnapshot(snap) {
  const safe = normalizeNavSnapshot(snap);
  const instLabel = getInstrumentConfig(safe.instrument).label;

  if (safe.view !== 'learn') {
    return `${instLabel} Tuner`;
  }

  const learn = safe.learn;
  const rootName = getNoteName(learn.rootPc, shouldPreferFlats(learn.rootPc));

  if (learn.tab === 'chords') {
    if (learn.familyModalTarget) {
      const targetRoot = getNoteName(
        learn.familyModalTarget.rootPc,
        learn.familyModalTarget.preferFlats ??
          shouldPreferFlats(learn.familyModalTarget.rootPc)
      );
      const q = CHORD_QUALITIES.find(
        (item) => item.id === learn.familyModalTarget.qualityId
      );
      return `${instLabel} ${targetRoot}${q ? q.symbol : ''} Family`;
    }
    if (learn.chordQuery && learn.chordQuery.trim()) {
      return `${instLabel} ${learn.chordQuery.trim()} Diagram`;
    }
    return `${instLabel} ${rootName} Chords`;
  }

  if (learn.tab === 'scales') {
    const sc = SCALE_DEFINITIONS.find((s) => s.id === learn.scaleId);
    return `${instLabel} ${rootName} ${sc ? sc.name : 'Scales'}`;
  }

  if (learn.tab === 'progressions') {
    const prog = PROGRESSION_TEMPLATES.find((p) => p.id === learn.progressionId);
    return `${instLabel} ${rootName} ${prog ? prog.name : 'Progressions'}`;
  }

  if (learn.tab === 'theory') {
    return `${instLabel} ${rootName} Theory & Guides`;
  }

  return `${instLabel} Learn`;
}

export function buildNextNavSnapshot(currentSnap, patch, { replace = false } = {}) {
  const safeCurrent = normalizeNavSnapshot(currentSnap);
  const nextView = patch.view !== undefined ? patch.view : safeCurrent.view;
  const nextInstrument =
    patch.instrument !== undefined ? patch.instrument : safeCurrent.instrument;
  const nextLearn = patch.learn
    ? { ...safeCurrent.learn, ...patch.learn }
    : { ...safeCurrent.learn };

  const candidate = normalizeNavSnapshot({
    view: nextView,
    instrument: nextInstrument,
    learn: nextLearn,
    stepIndex: replace ? safeCurrent.stepIndex : safeCurrent.stepIndex + 1,
    prevLabel: replace ? safeCurrent.prevLabel : describeNavSnapshot(safeCurrent),
  });

  return candidate;
}
