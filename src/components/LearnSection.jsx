import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CHROMATIC_NOTES,
  CHORD_QUALITIES,
  INTERVAL_LABELS,
  PROGRESSION_TEMPLATES,
  SCALE_DEFINITIONS,
  buildProgression,
  getChordFamilyContext,
  getChordVoicings,
  getFretboardMatrix,
  getInstrumentConfig,
  getKeyChordFamily,
  getNoteName,
  getScaleBoxWindow,
  searchChords,
  shouldPreferFlats,
} from '../utils/musicTheory';
import { INSTRUMENTS, getInstrumentMeta } from '../utils/frequencyUtils';
import { learnAudio } from '../utils/audioSynth';
import { DEFAULT_LEARN_STATE } from '../utils/navigationHistory';
import ChordDiagramSVG from './ChordDiagramSVG';

const LEARN_TABS = [
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'progressions', label: 'Progressions & Intervals' },
];

const CHORD_CATEGORIES = [
  'All',
  'Triads',
  'Sevenths',
  'Suspended',
  'Extended',
  'Altered / Dim',
];

const BOX_FILTERS = [
  { id: 'all', label: 'Full Neck (0–15)' },
  { id: 'open', label: 'Open (0–4)' },
  { id: 'pos1', label: 'Pos 1' },
  { id: 'pos2', label: 'Pos 2' },
  { id: 'pos3', label: 'Pos 3' },
  { id: 'pos4', label: 'Pos 4' },
  { id: 'pos5', label: 'Pos 5' },
];

const FRET_MARKERS = new Set([3, 5, 7, 9, 12, 15]);

const QUICK_CHORD_LOOKUPS = [
  'F#dim',
  'Bbsus4',
  'Cdim7',
  'E7#9',
  'Am11',
  'G7sus4',
  'D6/9',
  'C#m7b5',
];

const POPULAR_KEY_FAMILIES = [
  { pc: 7, label: 'G Family (G–C–D)' },
  { pc: 0, label: 'C Family (C–F–G)' },
  { pc: 2, label: 'D Family (D–G–A)' },
  { pc: 9, label: 'A Family (A–D–E)' },
  { pc: 4, label: 'E Family (E–A–B)' },
];

const ChordFamilyModal = ({
  target,
  instrument = 'guitar',
  refFrequency,
  onClose,
  onLookupChord,
  onOpenProgressionsTab,
}) => {
  const [playingId, setPlayingId] = useState(null);
  const [activeStepIdx, setActiveStepIdx] = useState(null);

  const familyCtx = useMemo(() => {
    if (!target) return null;
    return getChordFamilyContext(
      target.rootPc,
      target.qualityId,
      target.preferFlats ?? null,
      instrument
    );
  }, [target, instrument]);

  useEffect(() => {
    if (!target) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        learnAudio.stopAll();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [target, onClose]);

  useEffect(() => {
    setPlayingId(null);
    setActiveStepIdx(null);
  }, [target]);

  if (!target || !familyCtx) return null;

  const handleToggleProgression = (prog) => {
    if (playingId === prog.id) {
      learnAudio.stopAll();
      setPlayingId(null);
      setActiveStepIdx(null);
      return;
    }
    setPlayingId(prog.id);
    setActiveStepIdx(0);
    learnAudio.playProgression(
      prog.chords,
      refFrequency,
      850,
      (idx) => setActiveStepIdx(idx),
      () => {
        setPlayingId(null);
        setActiveStepIdx(null);
      },
      instrument
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chord-family-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          learnAudio.stopAll();
          onClose();
        }
      }}
    >
      <div className="glass-panel rounded-t-3xl sm:rounded-2xl border border-cyan-300/35 shadow-[0_24px_64px_rgba(2,6,23,0.75)] w-full max-w-4xl max-h-[88dvh] sm:max-h-[90dvh] overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
        <div
          aria-hidden="true"
          className="w-10 h-1 rounded-full bg-white/25 mx-auto sm:hidden shrink-0"
        />
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2
                id="chord-family-modal-title"
                className="font-display font-bold text-xl sm:text-2xl text-white"
              >
                {familyCtx.chord.symbol} Family &amp; Progressions
              </h2>
              <span className="font-mono text-xs text-cyan-300 font-semibold">
                {familyCtx.keyFamilyLabel}
              </span>
            </div>
            <p className="mt-1 font-sans text-xs sm:text-sm text-slate-300">
              {familyCtx.relationshipSummary}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              learnAudio.stopAll();
              onClose();
            }}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-white/15 bg-white/[0.08] hover:bg-white/[0.16] font-mono text-xs font-semibold text-white shrink-0 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

        {/* 7 Chords in This Family */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-mono text-xs uppercase tracking-wider text-slate-300">
              All 7 Chords in {familyCtx.parentMajorName} Major Family
            </h3>
            <span className="font-mono text-[11px] text-cyan-300">
              Primary I–IV–V: {familyCtx.familyChords[0].symbol} ·{' '}
              {familyCtx.familyChords[3].symbol} · {familyCtx.familyChords[4].symbol}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {familyCtx.familyChords.map((fc) => (
              <div
                key={`modal-fam-${fc.roman}-${fc.symbol}`}
                className={`rounded-xl p-2.5 border flex flex-col justify-between gap-1.5 ${
                  fc.isSelected
                    ? 'bg-cyan-400/20 border-cyan-300/60 shadow-[0_0_16px_rgba(34,211,238,0.2)]'
                    : ['I', 'IV', 'V'].includes(fc.roman)
                      ? 'bg-white/[0.07] border-white/20'
                      : 'glass-recessed border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 font-mono text-[10px]">
                  <span className="text-cyan-300 font-bold shrink-0">{fc.roman}</span>
                  <span className="text-slate-400 truncate text-right">{fc.role}</span>
                </div>
                <div className="font-display font-bold text-lg text-white">
                  {fc.symbol}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (fc.voicings[0]) {
                        learnAudio.playChordStrum(
                          fc.voicings[0].midiNotes,
                          refFrequency,
                          instrument
                        );
                      }
                    }}
                    className="flex-1 min-h-[34px] px-1.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.18] font-mono text-[10px] font-semibold text-white cursor-pointer transition-colors"
                  >
                    Strum
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      learnAudio.stopAll();
                      onLookupChord(fc.symbol);
                    }}
                    className="min-h-[34px] px-1.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.14] font-mono text-[10px] text-slate-300 cursor-pointer transition-colors"
                    aria-label={`Inspect ${fc.symbol} diagram`}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Playable Progressions Featuring This Chord */}
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-xs uppercase tracking-wider text-slate-300">
            Progressions Using {familyCtx.chord.symbol} &amp; This Family
          </h3>

          <div className="flex flex-col gap-2.5">
            {familyCtx.progressions.map((prog) => {
              const isPlaying = playingId === prog.id;
              return (
                <div
                  key={prog.id}
                  className="glass-recessed rounded-xl p-3.5 border border-white/12 flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display font-bold text-base text-white">
                          {prog.name}
                        </span>
                        <span className="font-mono text-xs text-cyan-300">
                          {prog.numeralLabel}
                        </span>
                      </div>
                      {prog.description && (
                        <p className="mt-0.5 font-sans text-xs text-slate-300">
                          {prog.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleProgression(prog)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        isPlaying
                          ? 'bg-rose-500/25 text-rose-100 border-rose-300/40'
                          : 'bg-cyan-400 text-slate-950 border-cyan-300'
                      }`}
                    >
                      {isPlaying ? 'Stop' : 'Play'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {prog.chords.map((stepChord, idx) => {
                      const isStepActive = isPlaying && activeStepIdx === idx;
                      const isSearchedChord =
                        stepChord.rootPc === familyCtx.chord.rootPc &&
                        stepChord.quality.id === familyCtx.chord.quality.id;
                      return (
                        <button
                          key={`${prog.id}-${idx}-${stepChord.symbol}`}
                          type="button"
                          onClick={() => {
                            if (stepChord.voicings[0]) {
                              learnAudio.playChordStrum(
                                stepChord.voicings[0].midiNotes,
                                refFrequency,
                                instrument
                              );
                            }
                          }}
                          className={`min-h-[54px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 active:scale-[0.97] transition-all cursor-pointer ${
                            isStepActive
                              ? 'bg-emerald-400/25 border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.35)]'
                              : isSearchedChord
                                ? 'bg-cyan-400/15 border-cyan-300/45 hover:bg-cyan-400/25'
                                : 'bg-white/[0.05] border-white/10 hover:bg-white/[0.12]'
                          }`}
                        >
                          <div>
                            <div className="font-mono text-[10px] text-cyan-300">
                              {stepChord.roman}
                            </div>
                            <div className="font-display font-bold text-base text-white">
                              {stepChord.symbol}
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            Strum
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Action */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
          <span className="font-mono text-xs text-slate-400">
            Tap any progression chord to hear it, or open full diagrams in Progressions.
          </span>
          <button
            type="button"
            onClick={() => {
              learnAudio.stopAll();
              onOpenProgressionsTab(familyCtx.parentMajorPc);
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-cyan-300/40 bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 font-mono text-xs font-semibold cursor-pointer transition-colors"
          >
            Open {familyCtx.parentMajorName} in Progressions Tab
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

const SpotlightChordPanel = ({
  chordData,
  instrument = 'guitar',
  labelMode,
  refFrequency,
  activeRootPc,
  onSyncRoot,
  onClearSearch,
  onShowFamily,
}) => {
  const [voicingIdx, setVoicingIdx] = useState(0);

  useEffect(() => {
    setVoicingIdx(0);
  }, [chordData.symbol, chordData.rootPc, chordData.quality.id, instrument]);

  const safeIdx = Math.min(voicingIdx, Math.max(0, chordData.voicings.length - 1));
  const activeVoicing = chordData.voicings[safeIdx];

  return (
    <article
      aria-label={`Chord Diagram Lookup Result for ${chordData.symbol}`}
      className="glass-panel rounded-2xl p-4 sm:p-5 border border-cyan-300/35 shadow-[0_8px_32px_rgba(34,211,238,0.12)] flex flex-col md:flex-row items-center md:items-stretch gap-5"
    >
      <div className="glass-recessed rounded-2xl p-4 flex flex-col items-center justify-center w-full md:w-[230px] shrink-0">
        <ChordDiagramSVG
          voicing={activeVoicing}
          rootPc={chordData.rootPc}
          labelMode={labelMode}
          compact={false}
          preferFlats={chordData.preferFlats}
          instrumentLabel={instrument}
        />
        <span className="mt-2 font-mono text-[11px] text-cyan-300 text-center">
          {activeVoicing?.label}
        </span>
      </div>

      <div className="flex-1 w-full flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                {chordData.symbol}
              </h2>
              <span className="font-mono text-xs sm:text-sm text-cyan-300 font-semibold">
                {chordData.quality.name}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {chordData.quality.category}
              </span>
            </div>
            <p className="mt-1 font-sans text-xs sm:text-sm text-slate-300">
              {chordData.quality.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeVoicing) {
                  learnAudio.playChordStrum(activeVoicing.midiNotes, refFrequency, instrument);
                }
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl border bg-cyan-400 text-slate-950 border-cyan-300 font-mono text-xs font-semibold shadow-[0_4px_16px_rgba(34,211,238,0.28)] active:scale-[0.96] transition-transform cursor-pointer"
            >
              Strum Chord
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeVoicing) {
                  learnAudio.playSequence(
                    activeVoicing.midiNotes,
                    refFrequency,
                    190,
                    null,
                    null,
                    instrument
                  );
                }
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border bg-white/[0.08] text-slate-100 border-white/15 hover:bg-white/[0.16] font-mono text-xs font-semibold active:scale-[0.96] transition-colors cursor-pointer"
            >
              Arpeggiate
            </button>
            <button
              type="button"
              onClick={() => onShowFamily(chordData)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-cyan-300/40 bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 font-mono text-xs font-semibold active:scale-[0.96] transition-colors cursor-pointer"
            >
              Family &amp; Progressions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="glass-recessed rounded-xl px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Chord Tones
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-cyan-300">
              {chordData.notes.join(' · ')}
            </div>
          </div>
          <div className="glass-recessed rounded-xl px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Formula Degrees
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-white">
              {chordData.quality.degrees.join(' – ')}
            </div>
          </div>
          <div className="glass-recessed rounded-xl px-3 py-2.5 col-span-2 sm:col-span-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Voicings Available
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-white tabular-nums">
              {safeIdx + 1} of {chordData.voicings.length}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {chordData.voicings.map((v, idx) => (
              <button
                key={`${v.label}-${idx}`}
                type="button"
                onClick={() => {
                  setVoicingIdx(idx);
                  learnAudio.playChordStrum(v.midiNotes, refFrequency, instrument);
                }}
                aria-pressed={idx === safeIdx}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border font-mono text-xs font-medium transition-colors cursor-pointer ${
                  idx === safeIdx
                    ? 'bg-white/20 text-white border-white/35'
                    : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {chordData.rootPc !== activeRootPc && (
              <button
                type="button"
                onClick={() => onSyncRoot(chordData.rootPc)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-cyan-300/35 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25 font-mono text-xs font-semibold cursor-pointer transition-colors"
              >
                Set Active Key to {chordData.rootName}
              </button>
            )}
            <button
              type="button"
              onClick={onClearSearch}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-white/12 bg-white/[0.04] text-slate-300 hover:text-white font-mono text-xs cursor-pointer transition-colors"
            >
              Show All Chords
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

const ChordCard = ({
  chordData,
  instrument = 'guitar',
  labelMode,
  refFrequency,
  activeStrumId,
  onStrum,
  onShowFamily,
}) => {
  const [voicingIdx, setVoicingIdx] = useState(0);

  useEffect(() => {
    setVoicingIdx(0);
  }, [chordData.rootPc, chordData.quality.id, instrument]);

  const safeIdx = Math.min(voicingIdx, Math.max(0, chordData.voicings.length - 1));
  const activeVoicing = chordData.voicings[safeIdx];
  const cardId = `${chordData.rootPc}-${chordData.quality.id}`;
  const isStrumming = activeStrumId === cardId;

  return (
    <article className="glass-panel rounded-2xl p-2.5 sm:p-4 flex flex-col justify-between gap-2 sm:gap-3 transition-[border-color,transform] duration-200 hover:border-white/25">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <h3 className="font-display font-bold text-lg sm:text-xl text-white truncate">
              {chordData.symbol}
            </h3>
            <span className="font-mono text-[11px] sm:text-xs text-slate-400 truncate">
              {chordData.quality.name}
            </span>
          </div>
          <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 font-mono text-[11px] sm:text-xs text-cyan-300 truncate">
            <span className="truncate">{chordData.notes.join(' · ')}</span>
            <span className="text-slate-500 hidden sm:inline">/</span>
            <span className="text-slate-400 hidden sm:inline">
              {chordData.quality.degrees.join('–')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onShowFamily(chordData)}
            className="min-h-[40px] sm:min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl border border-cyan-300/30 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-200 font-mono text-[11px] font-semibold active:scale-[0.96] transition-colors whitespace-nowrap cursor-pointer"
            aria-label={`Show chord family and progressions for ${chordData.symbol}`}
          >
            Family
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeVoicing) {
                onStrum(cardId, activeVoicing.midiNotes);
              }
            }}
            className={`min-h-[40px] sm:min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl border font-mono text-[11px] sm:text-xs font-semibold active:scale-[0.96] transition-[transform,background-color,border-color,color] duration-200 whitespace-nowrap cursor-pointer ${
              isStrumming
                ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                : 'bg-white/[0.08] text-slate-100 border-white/15 hover:bg-white/[0.16]'
            }`}
            aria-label={`Strum ${chordData.symbol} (${activeVoicing?.label || ''})`}
          >
            Strum
          </button>
        </div>
      </div>

      <div className="glass-recessed rounded-xl py-2 px-1 sm:py-3 sm:px-2">
        <ChordDiagramSVG
          voicing={activeVoicing}
          rootPc={chordData.rootPc}
          labelMode={labelMode}
          compact
          preferFlats={chordData.preferFlats}
          instrumentLabel={instrument}
        />
      </div>

      {/* Voicing Switcher */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between font-mono text-[10px] sm:text-[11px] text-slate-300">
          <span className="truncate">{activeVoicing?.label}</span>
          <span className="text-slate-400 shrink-0 tabular-nums">
            {safeIdx + 1}/{chordData.voicings.length}
          </span>
        </div>

        {chordData.voicings.length > 1 && (
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {chordData.voicings.map((v, idx) => (
              <button
                key={`${v.label}-${idx}`}
                type="button"
                onClick={() => {
                  setVoicingIdx(idx);
                  learnAudio.playChordStrum(v.midiNotes, refFrequency, instrument);
                }}
                aria-pressed={idx === safeIdx}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg border font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                  idx === safeIdx
                    ? 'bg-white/20 text-white border-white/35'
                    : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                Pos {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};

const LearnSection = ({
  instrument = 'guitar',
  onSelectInstrument,
  refFrequency,
  learnState = DEFAULT_LEARN_STATE,
  onUpdateLearn,
  canGoBack = false,
  prevLabel = null,
  onGoBack,
}) => {
  const activeLearn = learnState || DEFAULT_LEARN_STATE;
  const rootPc = activeLearn.rootPc ?? 0;
  const activeTab = activeLearn.tab || 'chords';
  const chordQuery = activeLearn.chordQuery || '';
  const chordCategory = activeLearn.chordCategory || 'All';
  const chordLabelMode = activeLearn.chordLabelMode || 'fingers';
  const familyModalTarget = activeLearn.familyModalTarget || null;
  const scaleId = activeLearn.scaleId || 'major';
  const scaleLabelMode = activeLearn.scaleLabelMode || 'notes';
  const boxFilter = activeLearn.boxFilter || 'all';
  const progressionId = activeLearn.progressionId || 'three_chord_family';

  const instrumentConfig = getInstrumentConfig(instrument);
  const instrumentMeta = getInstrumentMeta(instrument);

  const [activeStrumId, setActiveStrumId] = useState(null);
  const [playingScalePc, setPlayingScalePc] = useState(null);
  const [isPlayingScale, setIsPlayingScale] = useState(false);
  const [activeProgStep, setActiveProgStep] = useState(null);

  const stopPlaybackState = () => {
    learnAudio.stopAll();
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    setActiveProgStep(null);
    setActiveStrumId(null);
  };

  useEffect(() => {
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    setActiveProgStep(null);
    setActiveStrumId(null);
  }, [instrument, activeTab, rootPc, scaleId, progressionId]);

  useEffect(() => {
    return () => {
      learnAudio.stopAll();
    };
  }, []);

  const preferFlats = shouldPreferFlats(rootPc);
  const selectedRootName = getNoteName(rootPc, preferFlats);

  const chordSearchResults = useMemo(
    () => searchChords(chordQuery, rootPc, instrument),
    [chordQuery, rootPc, instrument]
  );

  // Compute all 25 chord qualities dynamically for the chosen rootPc & instrument
  const filteredChords = useMemo(() => {
    return CHORD_QUALITIES.filter(
      (q) => chordCategory === 'All' || q.category === chordCategory
    ).map((q) => getChordVoicings(rootPc, q.id, null, instrument));
  }, [rootPc, chordCategory, instrument]);

  const keyChordFamily = useMemo(
    () => getKeyChordFamily(rootPc, instrument),
    [rootPc, instrument]
  );

  // Compute fretboard + scale details dynamically for the chosen rootPc, scaleId & instrument
  const fretboardData = useMemo(
    () => getFretboardMatrix(rootPc, scaleId, 15, instrument),
    [rootPc, scaleId, instrument]
  );

  const boxWindow = useMemo(
    () => getScaleBoxWindow(rootPc, boxFilter, instrument),
    [rootPc, boxFilter, instrument]
  );

  const activeProgression = useMemo(
    () => buildProgression(rootPc, progressionId, instrument),
    [rootPc, progressionId, instrument]
  );

  const handleStrum = (cardId, midiNotes) => {
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    setActiveProgStep(null);
    setActiveStrumId(cardId);
    learnAudio.playChordStrum(midiNotes, refFrequency, instrument);
  };

  const handlePlayScale = () => {
    if (isPlayingScale) {
      learnAudio.stopAll();
      setIsPlayingScale(false);
      setPlayingScalePc(null);
      return;
    }
    setActiveProgStep(null);
    setIsPlayingScale(true);
    learnAudio.playSequence(
      fretboardData.details.ascendingMidi,
      refFrequency,
      260,
      (_idx, midi) => {
        setPlayingScalePc(((midi % 12) + 12) % 12);
      },
      () => {
        setIsPlayingScale(false);
        setPlayingScalePc(null);
      },
      instrument
    );
  };

  const handlePlayProgression = () => {
    if (activeProgStep !== null) {
      learnAudio.stopAll();
      setActiveProgStep(null);
      return;
    }
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    learnAudio.playProgression(
      activeProgression.chords,
      refFrequency,
      900,
      (idx) => setActiveProgStep(idx),
      () => setActiveProgStep(null),
      instrument
    );
  };

  const handleSelectRoot = (nextPc) => {
    if (nextPc === rootPc) return;
    stopPlaybackState();
    onUpdateLearn({ rootPc: nextPc });
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Dynamic Root Note & Sub-Module Toolbar */}
      <section
        aria-label="Learn Root Note and Section Selector"
        className="glass-panel rounded-2xl p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4"
      >
        {canGoBack && prevLabel && (
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <button
              type="button"
              onClick={() => {
                stopPlaybackState();
                if (onGoBack) onGoBack();
              }}
              aria-label={`Back to ${prevLabel}`}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-white/15 bg-white/[0.08] hover:bg-white/[0.16] text-slate-100 font-mono text-xs font-semibold inline-flex items-center gap-2 active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer max-w-full"
            >
              <span aria-hidden="true">←</span>
              <span className="truncate">Back to {prevLabel}</span>
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          <div>
            <h1 className="font-display font-bold text-lg sm:text-2xl text-white">
              Interactive Theory &amp; {instrumentMeta.label} Fretboard Lab
            </h1>
            <p className="hidden sm:block mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
              Switch between Guitar, Bass, and Ukulele or pick any root note to transpose all chord diagrams, scale shapes, and progressions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 shrink-0 w-full lg:w-auto">
            <div
              role="group"
              aria-label="Learn Instrument Selector"
              className="grid grid-cols-3 sm:flex items-center gap-1 glass-recessed rounded-xl p-1 shrink-0"
            >
              {INSTRUMENTS.map((inst) => {
                const active = instrument === inst.id;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      if (inst.id !== instrument) {
                        stopPlaybackState();
                        if (onSelectInstrument) onSelectInstrument(inst.id);
                      }
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.97] transition-transform duration-100 cursor-pointer ${
                      active
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_4px_14px_rgba(34,211,238,0.28)]'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {inst.label}
                  </button>
                );
              })}
            </div>

            <div
              role="tablist"
              aria-label="Learn Sections"
              className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 glass-recessed rounded-xl p-1 shrink-0"
            >
              {LEARN_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      if (tab.id !== activeTab) {
                        stopPlaybackState();
                        onUpdateLearn({ tab: tab.id, familyModalTarget: null });
                      }
                    }}
                    className={`min-h-[40px] px-2 sm:px-3.5 py-2 rounded-lg font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.97] transition-transform duration-100 cursor-pointer ${
                      active
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_4px_14px_rgba(34,211,238,0.28)]'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {tab.id === 'progressions' ? (
                      <>
                        <span className="sm:hidden">Progressions</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </>
                    ) : (
                      tab.label
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* All 12 Chromatic Root Notes */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <div className="flex items-center justify-between gap-2 font-mono text-[11px] sm:text-xs text-slate-300">
            <span className="shrink-0">Root Note</span>
            <span className="text-cyan-300 font-semibold truncate text-right">
              {selectedRootName} · {instrumentMeta.shortLabel} ({refFrequency} Hz)
            </span>
          </div>
          <div
            role="group"
            aria-label="Root Note Selector"
            className="flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-6 lg:grid-cols-12 gap-1.5 pb-0.5 sm:pb-0"
          >
            {CHROMATIC_NOTES.map((note) => {
              const active = rootPc === note.index;
              return (
                <button
                  key={note.index}
                  type="button"
                  onClick={() => handleSelectRoot(note.index)}
                  aria-pressed={active}
                  className={`min-h-[44px] min-w-[56px] sm:min-w-0 shrink-0 px-2.5 sm:px-2 py-2 rounded-xl border font-mono text-xs font-semibold active:scale-[0.96] transition-transform duration-100 whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.3)]'
                      : 'bg-white/[0.06] text-slate-200 border-white/12 hover:bg-white/[0.14]'
                  }`}
                >
                  {note.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* TAB 1: CHORD LIBRARY & DIAGRAM LOOKUP */}
      {activeTab === 'chords' && (
        <section aria-label="Chord Diagrams Library" className="flex flex-col gap-4">
          {/* Chord Diagram Search Bar */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="chord-diagram-search"
                className="font-display font-bold text-base sm:text-lg text-white"
              >
                Chord Diagram Lookup
              </label>
              <span className="font-mono text-xs text-slate-400">
                Type any chord symbol or quality (sus, dim, m7b5, 7#9, 9, 13, m11, 6/9)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <path
                    d="M14.5 14.5L18 18M16.5 9.5a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  id="chord-diagram-search"
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  value={chordQuery}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    const wasEmpty = !chordQuery.trim();
                    const isNowNonEmpty = Boolean(nextVal.trim());
                    onUpdateLearn(
                      { chordQuery: nextVal },
                      { replace: !(wasEmpty && isNowNonEmpty) }
                    );
                  }}
                  placeholder="Look up chord diagram (e.g. F#dim, Bbsus4, E7#9, Am11, Cdim7)..."
                  aria-label="Search chord diagram"
                  className="w-full min-h-[46px] pl-10 pr-20 py-2.5 rounded-xl glass-recessed border border-white/15 focus:border-cyan-300/60 focus:outline-none font-mono text-sm text-white placeholder:text-slate-400 transition-colors"
                />
                {chordQuery && (
                  <button
                    type="button"
                    onClick={() => onUpdateLearn({ chordQuery: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[32px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-mono text-xs cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 glass-recessed rounded-xl p-1 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (chordLabelMode !== 'fingers') {
                      onUpdateLearn({ chordLabelMode: 'fingers' }, { replace: true });
                    }
                  }}
                  aria-pressed={chordLabelMode === 'fingers'}
                  className={`min-h-[38px] px-3 py-1 rounded-lg font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    chordLabelMode === 'fingers'
                      ? 'bg-white/20 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fingers
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (chordLabelMode !== 'notes') {
                      onUpdateLearn({ chordLabelMode: 'notes' }, { replace: true });
                    }
                  }}
                  aria-pressed={chordLabelMode === 'notes'}
                  className={`min-h-[38px] px-3 py-1 rounded-lg font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    chordLabelMode === 'notes'
                      ? 'bg-white/20 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Note Names
                </button>
              </div>
            </div>

            {/* Quick Complex Chord Lookups */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-slate-400 mr-1">
                Try complex:
              </span>
              {QUICK_CHORD_LOOKUPS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    if (chordQuery.trim().toLowerCase() !== sample.toLowerCase()) {
                      onUpdateLearn({ chordQuery: sample });
                    }
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg border font-mono text-xs transition-colors cursor-pointer ${
                    chordQuery.trim().toLowerCase() === sample.toLowerCase()
                      ? 'bg-cyan-400/20 text-cyan-200 border-cyan-300/45'
                      : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Search Spotlight OR Category Filter */}
          {chordQuery.trim() ? (
            chordSearchResults.exactChord ? (
              <>
                <SpotlightChordPanel
                  chordData={chordSearchResults.exactChord}
                  instrument={instrument}
                  labelMode={chordLabelMode}
                  refFrequency={refFrequency}
                  activeRootPc={rootPc}
                  onSyncRoot={handleSelectRoot}
                  onClearSearch={() => onUpdateLearn({ chordQuery: '' })}
                  onShowFamily={(cd) =>
                    onUpdateLearn({
                      familyModalTarget: {
                        rootPc: cd.rootPc,
                        qualityId: cd.quality.id,
                        preferFlats: cd.preferFlats,
                      },
                    })
                  }
                />

                {chordSearchResults.matches.length > 1 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-slate-300 px-1">
                      Related & Matching Diagrams ({chordSearchResults.matches.length - 1})
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                      {chordSearchResults.matches.slice(1).map((chordData) => (
                        <ChordCard
                          key={`search-${chordData.rootPc}-${chordData.quality.id}`}
                          chordData={chordData}
                          instrument={instrument}
                          labelMode={chordLabelMode}
                          refFrequency={refFrequency}
                          activeStrumId={activeStrumId}
                          onStrum={handleStrum}
                          onShowFamily={(cd) =>
                            onUpdateLearn({
                              familyModalTarget: {
                                rootPc: cd.rootPc,
                                qualityId: cd.quality.id,
                                preferFlats: cd.preferFlats,
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="glass-panel rounded-2xl p-6 text-center flex flex-col items-center gap-3">
                <p className="font-display font-semibold text-base text-white">
                  No chord matched &ldquo;{chordQuery.trim()}&rdquo;
                </p>
                <p className="font-sans text-xs sm:text-sm text-slate-300 max-w-md">
                  Try a root + quality like <span className="font-mono text-cyan-300">F#dim</span>,{' '}
                  <span className="font-mono text-cyan-300">Bbsus4</span>,{' '}
                  <span className="font-mono text-cyan-300">E7#9</span>, or a keyword like{' '}
                  <span className="font-mono text-cyan-300">sus</span>,{' '}
                  <span className="font-mono text-cyan-300">dim</span>, or{' '}
                  <span className="font-mono text-cyan-300">m7b5</span>.
                </p>
                <button
                  type="button"
                  onClick={() => onUpdateLearn({ chordQuery: '' })}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-white/15 bg-white/[0.08] text-white font-mono text-xs font-semibold cursor-pointer hover:bg-white/[0.15]"
                >
                  Reset Search
                </button>
              </div>
            )
          ) : (
            <>
              <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar">
                  {CHORD_CATEGORIES.map((cat) => {
                    const active = chordCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (chordCategory !== cat) {
                            onUpdateLearn({ chordCategory: cat }, { replace: true });
                          }
                        }}
                        aria-pressed={active}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          active
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <span className="font-mono text-xs text-slate-400">
                  Showing {filteredChords.length} {instrumentMeta.label} {selectedRootName} diagrams
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                {filteredChords.map((chordData) => (
                  <ChordCard
                    key={`${chordData.rootPc}-${chordData.quality.id}`}
                    chordData={chordData}
                    instrument={instrument}
                    labelMode={chordLabelMode}
                    refFrequency={refFrequency}
                    activeStrumId={activeStrumId}
                    onStrum={handleStrum}
                    onShowFamily={(cd) =>
                      onUpdateLearn({
                        familyModalTarget: {
                          rootPc: cd.rootPc,
                          qualityId: cd.quality.id,
                          preferFlats: cd.preferFlats,
                        },
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* TAB 2: SCALE EXPLORER */}
      {activeTab === 'scales' && (
        <section aria-label="Scale Explorer" className="flex flex-col gap-4">
          {/* Scale Selector & Playback Controls */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-xl text-white">
                  {selectedRootName} {fretboardData.details.scale.name}
                </h2>
                <p className="mt-1 font-sans text-xs sm:text-sm text-slate-300">
                  {fretboardData.details.scale.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePlayScale}
                  className={`min-h-[44px] px-4 py-2 rounded-xl border font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap cursor-pointer transition-[transform,background-color,border-color,color] duration-200 ${
                    isPlayingScale
                      ? 'bg-rose-500/25 text-rose-100 border-rose-300/40'
                      : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
                  }`}
                >
                  {isPlayingScale ? 'Stop Scale' : 'Play Ascending Scale'}
                </button>

                <div className="flex items-center gap-1 glass-recessed rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (scaleLabelMode !== 'notes') {
                        onUpdateLearn({ scaleLabelMode: 'notes' }, { replace: true });
                      }
                    }}
                    aria-pressed={scaleLabelMode === 'notes'}
                    className={`min-h-[36px] px-3 py-1 rounded-lg font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      scaleLabelMode === 'notes'
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Notes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (scaleLabelMode !== 'degrees') {
                        onUpdateLearn({ scaleLabelMode: 'degrees' }, { replace: true });
                      }
                    }}
                    aria-pressed={scaleLabelMode === 'degrees'}
                    className={`min-h-[36px] px-3 py-1 rounded-lg font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      scaleLabelMode === 'degrees'
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Degrees
                  </button>
                </div>
              </div>
            </div>

            {/* Scale Quality Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar pb-1 sm:pb-0">
              {SCALE_DEFINITIONS.map((sc) => {
                const active = sc.id === scaleId;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      if (sc.id === scaleId) return;
                      stopPlaybackState();
                      onUpdateLearn({ scaleId: sc.id });
                    }}
                    aria-pressed={active}
                    className={`min-h-[42px] px-3.5 py-2 rounded-xl border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active
                        ? 'bg-white/20 text-white border-white/35'
                        : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                    }`}
                  >
                    {sc.name}
                  </button>
                );
              })}
            </div>

            {/* Scale Degrees & Notes Strip */}
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {fretboardData.details.notes.map((n) => {
                const isRoot = n.pc === rootPc;
                const isSounding = playingScalePc === n.pc;
                return (
                  <button
                    key={`${n.pc}-${n.degree}`}
                    type="button"
                    onClick={() =>
                      learnAudio.playPluckedNote(
                        instrumentConfig.scaleOctaveBase + rootPc + n.semitones,
                        refFrequency,
                        0,
                        null,
                        0.55,
                        instrument
                      )
                    }
                    className={`min-h-[54px] p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 active:scale-[0.96] transition-[transform,background-color,border-color,box-shadow] duration-150 cursor-pointer ${
                      isSounding
                        ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.45)]'
                        : isRoot
                          ? 'bg-cyan-400/20 text-cyan-200 border-cyan-300/45'
                          : 'glass-recessed text-slate-100 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="font-display font-bold text-base">
                      {n.name}
                    </span>
                    <span className="font-mono text-[11px] opacity-80">
                      Deg {n.degree}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive 15-Fret Fretboard */}
          <div className="glass-panel rounded-2xl p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-300">
                  Interactive Fretboard · {boxWindow.label}
                </span>
                <span className="md:hidden font-mono text-[11px] text-cyan-300 shrink-0">
                  Swipe ↔
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar">
                {BOX_FILTERS.map((box) => {
                  const active = boxFilter === box.id;
                  return (
                    <button
                      key={box.id}
                      type="button"
                      onClick={() => {
                        if (boxFilter !== box.id) {
                          onUpdateLearn({ boxFilter: box.id }, { replace: true });
                        }
                      }}
                      aria-pressed={active}
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg border font-mono text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        active
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                      }`}
                    >
                      {box.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="min-w-[780px] glass-recessed rounded-xl p-3 sm:p-4">
                {/* Fret Numbers Header */}
                <div className="grid grid-cols-[44px_repeat(16,minmax(0,1fr))] items-center gap-1 mb-2">
                  <div className="font-mono text-[10px] text-slate-400 text-center">
                    STR
                  </div>
                  {Array.from({ length: 16 }).map((_, fret) => (
                    <div
                      key={`hdr-${fret}`}
                      className={`font-mono text-[11px] text-center tabular-nums ${
                        FRET_MARKERS.has(fret)
                          ? 'text-cyan-300 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {fret === 0 ? 'OPEN' : fret}
                    </div>
                  ))}
                </div>

                {/* 6 Guitar Strings */}
                <div className="flex flex-col gap-1.5">
                  {fretboardData.rows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[44px_repeat(16,minmax(0,1fr))] items-center gap-1"
                    >
                      <div className="font-mono text-xs font-semibold text-slate-300 text-center">
                        {row.label}
                      </div>

                      {row.cells.map((cell) => {
                        const inBox =
                          cell.fret >= boxWindow.min && cell.fret <= boxWindow.max;
                        const active = cell.inScale && inBox;
                        const isSounding = active && playingScalePc === cell.pc;

                        return (
                          <div
                            key={`${row.label}-${cell.fret}`}
                            className={`relative h-10 flex items-center justify-center rounded-md ${
                              cell.fret === 0
                                ? 'border-r-2 border-white/50 bg-white/[0.04]'
                                : 'border-r border-white/12'
                            }`}
                          >
                            {/* String wire line */}
                            <div
                              aria-hidden="true"
                              className="absolute left-0 right-0 h-[1.5px] bg-white/20 pointer-events-none"
                            />

                            {cell.inScale ? (
                              <button
                                type="button"
                                onClick={() =>
                                  learnAudio.playPluckedNote(
                                    cell.midi,
                                    refFrequency,
                                    0,
                                    null,
                                    0.55,
                                    instrument
                                  )
                                }
                                aria-label={`${row.label} fret ${cell.fret} ${cell.noteName}`}
                                className={`relative z-10 w-8 h-8 rounded-full font-mono text-[11px] font-bold flex items-center justify-center active:scale-90 transition-[transform,opacity,background-color,box-shadow] duration-150 cursor-pointer ${
                                  !inBox
                                    ? 'opacity-20 bg-white/15 text-slate-300'
                                    : isSounding
                                      ? 'bg-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(52,211,153,0.9)] scale-110'
                                      : cell.isRoot
                                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                                        : 'bg-slate-100 text-slate-950 hover:bg-cyan-200'
                                }`}
                              >
                                {scaleLabelMode === 'notes'
                                  ? cell.noteName
                                  : cell.degree}
                              </button>
                            ) : (
                              FRET_MARKERS.has(cell.fret) &&
                              row.stringNum === (instrument === 'guitar' ? 3 : 2) && (
                                <span
                                  aria-hidden="true"
                                  className="w-2 h-2 rounded-full bg-white/15 pointer-events-none"
                                />
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Diatonic Chords in Selected Key & Scale */}
          {fretboardData.details.diatonicChords.length > 0 && (
            <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
              <h3 className="font-display font-bold text-base text-white">
                Diatonic Chords in {selectedRootName} {fretboardData.details.scale.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {fretboardData.details.diatonicChords.map((dc) => {
                  const voiced = getChordVoicings(dc.rootPc, dc.qualityId, null, instrument);
                  return (
                    <button
                      key={`${dc.roman}-${dc.symbol}`}
                      type="button"
                      onClick={() => {
                        if (voiced.voicings[0]) {
                          learnAudio.playChordStrum(
                            voiced.voicings[0].midiNotes,
                            refFrequency,
                            instrument
                          );
                        }
                      }}
                      className="min-h-[68px] p-3 rounded-xl glass-recessed hover:bg-white/[0.1] border border-white/12 flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer"
                    >
                      <span className="font-mono text-[11px] text-cyan-300">
                        {dc.roman}
                      </span>
                      <span className="font-display font-bold text-lg text-white">
                        {dc.symbol}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Tap to Strum
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: PROGRESSIONS & INTERVALS */}
      {activeTab === 'progressions' && (
        <section
          aria-label="Chord Progressions and Intervals"
          className="flex flex-col gap-5"
        >
          {/* Dynamic Chord Progressions */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-xl text-white">
                  {activeProgression.name} in {selectedRootName}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-cyan-300">
                  {activeProgression.numeralLabel}
                </p>
                {activeProgression.description && (
                  <p className="mt-1 font-sans text-xs sm:text-sm text-slate-300">
                    {activeProgression.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handlePlayProgression}
                className={`min-h-[44px] px-4 py-2 rounded-xl border font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer transition-[transform,background-color,border-color,color] duration-200 ${
                  activeProgStep !== null
                    ? 'bg-rose-500/25 text-rose-100 border-rose-300/40'
                    : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
                }`}
              >
                {activeProgStep !== null ? 'Stop Progression' : 'Play Progression'}
              </button>
            </div>

            {/* Quick Guitar Key Families (G-C-D, C-F-G, D-G-A, etc.) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-slate-400 mr-1">
                Quick Keys:
              </span>
              {POPULAR_KEY_FAMILIES.map((fam) => {
                const active = rootPc === fam.pc;
                return (
                  <button
                    key={fam.pc}
                    type="button"
                    onClick={() => handleSelectRoot(fam.pc)}
                    aria-pressed={active}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-cyan-400/20 text-cyan-200 border-cyan-300/45'
                        : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                    }`}
                  >
                    {fam.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar">
              {PROGRESSION_TEMPLATES.map((tpl) => {
                const active = tpl.id === progressionId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      if (tpl.id === progressionId) return;
                      stopPlaybackState();
                      onUpdateLearn({ progressionId: tpl.id });
                    }}
                    aria-pressed={active}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                    }`}
                  >
                    {tpl.name}
                  </button>
                );
              })}
            </div>

            <div
              className={`grid grid-cols-2 ${
                activeProgression.chords.length === 3
                  ? 'lg:grid-cols-3'
                  : 'lg:grid-cols-4'
              } gap-2.5 sm:gap-4`}
            >
              {activeProgression.chords.map((chord, idx) => {
                const isActiveStep = activeProgStep === idx;
                const firstVoicing = chord.voicings[0];
                return (
                  <button
                    key={`${chord.roman}-${chord.symbol}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (firstVoicing) {
                        learnAudio.playChordStrum(
                          firstVoicing.midiNotes,
                          refFrequency,
                          instrument
                        );
                      }
                    }}
                    className={`p-2.5 sm:p-4 rounded-2xl border text-left flex flex-col gap-2 sm:gap-3 active:scale-[0.98] transition-[transform,background-color,border-color,box-shadow] duration-200 cursor-pointer ${
                      isActiveStep
                        ? 'bg-cyan-400/15 border-cyan-300/60 shadow-[0_0_24px_rgba(34,211,238,0.25)]'
                        : 'glass-recessed border-white/12 hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-cyan-300">
                        {chord.roman}
                      </span>
                      <span className="font-display font-bold text-xl text-white">
                        {chord.symbol}
                      </span>
                    </div>
                    <ChordDiagramSVG
                      voicing={firstVoicing}
                      rootPc={chord.rootPc}
                      compact
                      preferFlats={chord.preferFlats}
                      instrumentLabel={instrument}
                    />
                    <span className="font-mono text-[11px] text-slate-400 text-center">
                      {chord.notes.join(' · ')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Complete Key Chord Family (I - ii - iii - IV - V - vi) */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-lg text-white">
                  Key of {keyChordFamily.rootName} Chord Family
                </h2>
                <p className="mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
                  All 6 primary chords that naturally belong together in {keyChordFamily.rootName} major. Tap to strum or inspect diagram.
                </p>
              </div>
              <span className="font-mono text-xs text-cyan-300 shrink-0">
                Primary I–IV–V: {keyChordFamily.chords[0].symbol} · {keyChordFamily.chords[3].symbol} · {keyChordFamily.chords[4].symbol}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {keyChordFamily.chords.map((fc) => {
                const isPrimaryTriad = ['I', 'IV', 'V'].includes(fc.roman);
                return (
                  <div
                    key={`${fc.roman}-${fc.symbol}`}
                    className={`rounded-xl p-3 border flex flex-col justify-between gap-2 ${
                      isPrimaryTriad
                        ? 'bg-cyan-400/10 border-cyan-300/35'
                        : 'glass-recessed border-white/12'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-cyan-300">
                        {fc.roman}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {fc.role}
                      </span>
                    </div>
                    <div className="font-display font-bold text-xl text-white">
                      {fc.symbol}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (fc.voicings[0]) {
                            learnAudio.playChordStrum(
                              fc.voicings[0].midiNotes,
                              refFrequency,
                              instrument
                            );
                          }
                        }}
                        className="flex-1 min-h-[40px] px-2 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] border border-white/12 font-mono text-[11px] font-semibold text-white cursor-pointer transition-colors"
                      >
                        Strum
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopPlaybackState();
                          onUpdateLearn({
                            tab: 'chords',
                            chordQuery: fc.symbol,
                            familyModalTarget: null,
                          });
                          if (typeof window !== 'undefined') {
                            window.scrollTo({ top: 0, behavior: 'auto' });
                          }
                        }}
                        className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.12] border border-white/10 font-mono text-[11px] text-slate-300 cursor-pointer transition-colors"
                        aria-label={`View ${fc.symbol} chord diagram`}
                      >
                        Diagram
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 12-Semitone Interval Matrix from Selected Root */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
            <h2 className="font-display font-bold text-lg text-white">
              Intervals from {selectedRootName}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {INTERVAL_LABELS.map((iv) => {
                const targetPc = (rootPc + iv.semitones) % 12;
                const targetName = getNoteName(targetPc, preferFlats);
                const rootMidi = instrumentConfig.scaleOctaveBase + rootPc;
                return (
                  <button
                    key={iv.semitones}
                    type="button"
                    onClick={() =>
                      learnAudio.playSequence(
                        [rootMidi, rootMidi + iv.semitones],
                        refFrequency,
                        320,
                        null,
                        null,
                        instrument
                      )
                    }
                    className="min-h-[68px] p-3 rounded-xl glass-recessed hover:bg-white/[0.1] border border-white/12 flex flex-col items-start justify-between gap-1 text-left active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer"
                  >
                    <div className="w-full flex items-center justify-between font-mono text-xs">
                      <span className="text-cyan-300 font-semibold">
                        {iv.short}
                      </span>
                      <span className="text-slate-400">
                        +{iv.semitones}st
                      </span>
                    </div>
                    <div className="font-display font-bold text-base text-white">
                      {selectedRootName} → {targetName}
                    </div>
                    <div className="font-sans text-[11px] text-slate-400">
                      {iv.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <ChordFamilyModal
        target={familyModalTarget}
        instrument={instrument}
        refFrequency={refFrequency}
        onClose={() => {
          if (canGoBack && onGoBack) {
            onGoBack();
          } else {
            onUpdateLearn({ familyModalTarget: null }, { replace: true });
          }
        }}
        onLookupChord={(sym) => {
          stopPlaybackState();
          onUpdateLearn({
            tab: 'chords',
            chordQuery: sym,
            familyModalTarget: null,
          });
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        }}
        onOpenProgressionsTab={(parentPc) => {
          stopPlaybackState();
          onUpdateLearn({
            tab: 'progressions',
            rootPc: parentPc,
            familyModalTarget: null,
          });
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        }}
      />
    </div>
  );
};

export default LearnSection;
