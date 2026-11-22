import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CHROMATIC_NOTES,
  INTERVAL_LABELS,
  PROGRESSION_TEMPLATES,
  SCALE_DEFINITIONS,
  buildProgression,
  getChordFamilyContext,
  getChordQualitiesForInstrument,
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
import {
  loadFavoriteChords,
  makeFavoriteChordId,
  removeFavoriteChord,
  saveFavoriteChords,
  toggleFavoriteChord,
  updateFavoriteChordVoicing,
} from '../utils/favoriteChords';
import {
  appendFavoriteToProgression,
  clearCustomProgression,
  createProgressionStep,
  duplicateProgressionStep,
  loadCustomProgression,
  moveProgressionStep,
  removeProgressionStep,
  saveCustomProgression,
  updateProgressionStepBeats,
} from '../utils/customProgression';
import { DEFAULT_BPM, getTimeSignatureConfig } from '../utils/metronome';
import ChordDiagramSVG from './ChordDiagramSVG';
import PracticeMetronomeBar from './PracticeMetronomeBar';
import FavoriteChordsTray from './FavoriteChordsTray';
import CustomProgressionSequencer from './CustomProgressionSequencer';
import TheoryGuidesSection from './TheoryGuidesSection';

const LEARN_TABS = [
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'progressions', label: 'Progressions & Intervals' },
  { id: 'theory', label: 'Theory & Guides' },
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

const BASS_QUICK_CHORD_LOOKUPS = [
  'G',
  'Cmaj7',
  'G7',
  'Am',
  'G5',
  'Bbsus4',
  'E7#9',
  'D6/9',
];

const POPULAR_KEY_FAMILIES = [
  { pc: 7, label: 'G Family (G–C–D)' },
  { pc: 0, label: 'C Family (C–F–G)' },
  { pc: 2, label: 'D Family (D–G–A)' },
  { pc: 9, label: 'A Family (A–D–E)' },
  { pc: 4, label: 'E Family (E–A–B)' },
];

const getChordArpeggioMidi = (voicing, qualityIntervals = [0, 4, 7]) => {
  const midiNotes = voicing?.midiNotes || [];
  if (midiNotes.length > 1) return midiNotes;
  if (midiNotes.length === 1) {
    const rootMidi = midiNotes[0];
    const notes = qualityIntervals.map((semi) => rootMidi + semi);
    if (qualityIntervals.length <= 3) {
      notes.push(rootMidi + 12);
    }
    return notes;
  }
  return [];
};

const ChordFamilyModal = ({
  target,
  instrument = 'guitar',
  playMode = 'strum',
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
      instrument,
      playMode
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
      <div className="glass-panel rounded-t-[4px] sm:rounded-[4px] border border-cyan-300/35 shadow-[0_24px_64px_rgba(2,6,23,0.75)] w-full max-w-4xl max-h-[88dvh] sm:max-h-[90dvh] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 flex flex-col gap-4 sm:gap-5">
        <div
          aria-hidden="true"
          className="w-10 h-1 rounded-[1px] bg-white/25 mx-auto sm:hidden shrink-0"
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
            className="min-h-[40px] px-3.5 py-1.5 rounded-[2px] border border-white/15 bg-white/[0.08] hover:bg-white/[0.16] font-mono text-xs font-semibold text-white shrink-0 cursor-pointer transition-colors"
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
                className={`rounded-[3px] p-2.5 border flex flex-col justify-between gap-1.5 ${
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
                        learnAudio.playChord(
                          fc.voicings[0].midiNotes,
                          refFrequency,
                          instrument,
                          playMode
                        );
                      }
                    }}
                    className="flex-1 min-h-[38px] sm:min-h-[34px] px-1.5 py-1 rounded-[2px] bg-white/[0.08] hover:bg-white/[0.18] font-mono text-[11px] sm:text-[10px] font-semibold text-white cursor-pointer transition-colors"
                  >
                    {fc.voicings[0]?.midiNotes?.length === 1
                      ? 'Pluck'
                      : playMode === 'arpeggio'
                        ? 'Arp'
                        : 'Strum'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      learnAudio.stopAll();
                      onLookupChord(fc.symbol);
                    }}
                    className="min-h-[38px] sm:min-h-[34px] px-2 sm:px-1.5 py-1 rounded-[2px] bg-white/[0.04] hover:bg-white/[0.14] font-mono text-[11px] sm:text-[10px] text-slate-300 cursor-pointer transition-colors"
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
                  className="glass-recessed rounded-[3px] p-3.5 border border-white/12 flex flex-col gap-3"
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
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
                              learnAudio.playChord(
                                stepChord.voicings[0].midiNotes,
                                refFrequency,
                                instrument,
                                playMode
                              );
                            }
                          }}
                          className={`min-h-[54px] px-3 py-2 rounded-[2px] border text-left flex items-center justify-between gap-2 active:scale-[0.97] transition-all cursor-pointer ${
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
                            {stepChord.voicings[0]?.midiNotes?.length === 1
                              ? 'Pluck'
                              : playMode === 'arpeggio'
                                ? 'Arp'
                                : 'Strum'}
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
            className="min-h-[42px] px-4 py-2 rounded-[2px] border border-cyan-300/40 bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 font-mono text-xs font-semibold cursor-pointer transition-colors"
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
  playMode = 'strum',
  refFrequency,
  activeRootPc,
  isFavorite = false,
  onToggleFavorite,
  onSyncFavoriteVoicing,
  onSyncRoot,
  onClearSearch,
  onShowFamily,
}) => {
  const [voicingIdx, setVoicingIdx] = useState(0);
  const [showVariations, setShowVariations] = useState(false);

  useEffect(() => {
    setVoicingIdx(0);
    setShowVariations(false);
  }, [chordData.symbol, chordData.rootPc, chordData.quality.id, instrument]);

  const safeIdx = Math.min(voicingIdx, Math.max(0, chordData.voicings.length - 1));
  const activeVoicing = chordData.voicings[safeIdx];
  const isSingleNoteVoicing = activeVoicing?.midiNotes?.length === 1;
  const collapseBassVariations = instrument === 'bass' && chordData.voicings.length > 1;
  const favId = makeFavoriteChordId({
    instrument,
    rootPc: chordData.rootPc,
    qualityId: chordData.quality.id,
  });

  return (
    <article
      aria-label={`Chord Diagram Lookup Result for ${chordData.symbol}`}
      className="glass-panel rounded-[4px] p-4 sm:p-5 border border-cyan-300/35 shadow-[0_8px_32px_rgba(34,211,238,0.12)] flex flex-col md:flex-row items-center md:items-stretch gap-5"
    >
      <div className="glass-recessed rounded-[3px] p-4 flex flex-col items-center justify-center w-full md:w-[230px] shrink-0">
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

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                if (activeVoicing) {
                  learnAudio.playChordStrum(activeVoicing.midiNotes, refFrequency, instrument);
                }
              }}
              className={`min-h-[42px] px-4 py-2 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.96] transition-transform cursor-pointer ${
                playMode === 'strum'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
                  : 'bg-white/[0.08] text-slate-100 border-white/15 hover:bg-white/[0.16]'
              }`}
            >
              {isSingleNoteVoicing ? 'Pluck Root' : 'Strum Chord'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeVoicing) {
                  learnAudio.playSequence(
                    getChordArpeggioMidi(activeVoicing, chordData.quality.intervals),
                    refFrequency,
                    190,
                    null,
                    null,
                    instrument
                  );
                }
              }}
              className={`min-h-[42px] px-3.5 py-2 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.96] transition-colors cursor-pointer ${
                playMode === 'arpeggio'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
                  : 'bg-white/[0.08] text-slate-100 border-white/15 hover:bg-white/[0.16]'
              }`}
            >
              Arpeggio
            </button>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(chordData, safeIdx)}
                aria-pressed={isFavorite}
                className={`min-h-[42px] px-3.5 py-2 rounded-[2px] border font-mono text-xs font-semibold inline-flex items-center gap-1.5 active:scale-[0.96] transition-colors cursor-pointer ${
                  isFavorite
                    ? 'border-amber-300/50 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
                    : 'border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/[0.14]'
                }`}
              >
                <span aria-hidden="true" className={isFavorite ? 'text-amber-300' : 'text-slate-300'}>
                  {isFavorite ? '★' : '☆'}
                </span>
                <span>{isFavorite ? 'Saved' : 'Save'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onShowFamily(chordData)}
              className="min-h-[42px] px-3.5 py-2 rounded-[2px] border border-cyan-300/40 bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 font-mono text-xs font-semibold active:scale-[0.96] transition-colors cursor-pointer"
            >
              Family &amp; Progressions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="glass-recessed rounded-[3px] px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Chord Tones
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-cyan-300">
              {chordData.notes.join(' · ')}
            </div>
          </div>
          <div className="glass-recessed rounded-[3px] px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Formula Degrees
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-white">
              {chordData.quality.degrees.join(' – ')}
            </div>
          </div>
          <div className="glass-recessed rounded-[3px] px-3 py-2.5 col-span-2 sm:col-span-1">
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
            {collapseBassVariations && !showVariations ? (
              <button
                type="button"
                onClick={() => setShowVariations(true)}
                aria-expanded={false}
                className="min-h-[38px] px-3.5 py-1.5 rounded-[2px] border border-cyan-300/35 bg-cyan-400/12 hover:bg-cyan-400/22 text-cyan-200 font-mono text-xs font-semibold transition-colors cursor-pointer"
              >
                More Variations (+{chordData.voicings.length - 1})
              </button>
            ) : (
              <>
                {chordData.voicings.map((v, idx) => (
                  <button
                    key={`${v.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      setVoicingIdx(idx);
                      if (isFavorite && onSyncFavoriteVoicing) {
                        onSyncFavoriteVoicing(favId, idx);
                      }
                      learnAudio.playChord(v.midiNotes, refFrequency, instrument, playMode);
                    }}
                    aria-pressed={idx === safeIdx}
                    className={`min-h-[42px] sm:min-h-[38px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-medium transition-colors cursor-pointer ${
                      idx === safeIdx
                        ? 'bg-white/20 text-white border-white/35'
                        : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
                {collapseBassVariations && (
                  <button
                    type="button"
                    onClick={() => setShowVariations(false)}
                    aria-expanded={true}
                    className="min-h-[38px] px-3 py-1.5 rounded-[2px] border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 font-mono text-xs cursor-pointer transition-colors"
                  >
                    Hide Variations
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {chordData.rootPc !== activeRootPc && (
              <button
                type="button"
                onClick={() => onSyncRoot(chordData.rootPc)}
                className="min-h-[38px] px-3 py-1.5 rounded-[2px] border border-cyan-300/35 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25 font-mono text-xs font-semibold cursor-pointer transition-colors"
              >
                Set Active Key to {chordData.rootName}
              </button>
            )}
            <button
              type="button"
              onClick={onClearSearch}
              className="min-h-[38px] px-3 py-1.5 rounded-[2px] border border-white/12 bg-white/[0.04] text-slate-300 hover:text-white font-mono text-xs cursor-pointer transition-colors"
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
  playMode = 'strum',
  refFrequency,
  activeStrumId,
  isFavorite = false,
  onToggleFavorite,
  onSyncFavoriteVoicing,
  onStrum,
  onShowFamily,
}) => {
  const [voicingIdx, setVoicingIdx] = useState(0);
  const [showVariations, setShowVariations] = useState(false);

  useEffect(() => {
    setVoicingIdx(0);
    setShowVariations(false);
  }, [chordData.rootPc, chordData.quality.id, instrument]);

  const safeIdx = Math.min(voicingIdx, Math.max(0, chordData.voicings.length - 1));
  const activeVoicing = chordData.voicings[safeIdx];
  const cardId = `${chordData.rootPc}-${chordData.quality.id}`;
  const favId = makeFavoriteChordId({
    instrument,
    rootPc: chordData.rootPc,
    qualityId: chordData.quality.id,
  });
  const isStrumActive = activeStrumId === `${cardId}:strum`;
  const isArpActive = activeStrumId === `${cardId}:arpeggio`;
  const isSingleNote = activeVoicing?.midiNotes?.length === 1;
  const isBassWithVariations = instrument === 'bass' && chordData.voicings.length > 1;
  const strumActionLabel = isSingleNote ? 'Pluck' : 'Strum';

  return (
    <article className="glass-panel rounded-[4px] p-2.5 sm:p-4 flex flex-col justify-between gap-2 sm:gap-3 transition-[border-color,transform] duration-200 hover:border-white/25">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-1.5">
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
              {instrument === 'bass' && isSingleNote && !showVariations ? (
                <span className="truncate">Root: {chordData.rootName}</span>
              ) : (
                <>
                  <span className="truncate">{chordData.notes.join(' · ')}</span>
                  <span className="text-slate-500 hidden sm:inline">/</span>
                  <span className="text-slate-400 hidden sm:inline">
                    {chordData.quality.degrees.join('–')}
                  </span>
                </>
              )}
            </div>
          </div>

          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(chordData, safeIdx)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? `Remove ${chordData.symbol} from saved favorites`
                  : `Save ${chordData.symbol} to favorites`
              }
              title={isFavorite ? 'Remove from Practice Favorites' : 'Save to Practice Favorites'}
              className={`min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] rounded-[2px] border font-mono text-sm flex items-center justify-center shrink-0 active:scale-[0.93] cursor-pointer transition-colors ${
                isFavorite
                  ? 'bg-amber-400/20 text-amber-300 border-amber-300/45'
                  : 'bg-white/[0.04] text-slate-400 border-white/12 hover:text-amber-200 hover:border-amber-300/35'
              }`}
            >
              {isFavorite ? '★' : '☆'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 w-full">
          <button
            type="button"
            onClick={() => onShowFamily(chordData)}
            className="order-3 col-span-2 sm:order-1 sm:col-span-1 min-h-[38px] sm:min-h-[36px] px-2 sm:px-2.5 py-1 rounded-[2px] border border-cyan-300/30 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-200 font-mono text-[11px] font-semibold active:scale-[0.96] transition-colors whitespace-nowrap cursor-pointer"
            aria-label={`Show chord family and progressions for ${chordData.symbol}`}
          >
            Family
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeVoicing) {
                onStrum(cardId, activeVoicing.midiNotes, 'strum');
              }
            }}
            className={`order-1 sm:order-2 min-h-[40px] sm:min-h-[36px] px-2 sm:px-2.5 py-1 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.96] transition-[transform,background-color,border-color,color] duration-200 whitespace-nowrap cursor-pointer ${
              isStrumActive
                ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                : playMode === 'strum' && !isArpActive && activeStrumId === null
                  ? 'bg-white/[0.1] text-white border-white/20 hover:bg-white/[0.18]'
                  : 'bg-white/[0.06] text-slate-200 border-white/15 hover:bg-white/[0.16]'
            }`}
            aria-label={`${strumActionLabel} ${chordData.symbol} (${activeVoicing?.label || ''})`}
          >
            {strumActionLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeVoicing) {
                onStrum(
                  cardId,
                  getChordArpeggioMidi(activeVoicing, chordData.quality.intervals),
                  'arpeggio'
                );
              }
            }}
            className={`order-2 sm:order-3 min-h-[40px] sm:min-h-[36px] px-2 sm:px-2.5 py-1 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.96] transition-[transform,background-color,border-color,color] duration-200 whitespace-nowrap cursor-pointer ${
              isArpActive
                ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                : playMode === 'arpeggio'
                  ? 'bg-cyan-400/18 text-cyan-200 border-cyan-300/40 hover:bg-cyan-400/28'
                  : 'bg-white/[0.06] text-slate-200 border-white/15 hover:bg-white/[0.16]'
            }`}
            aria-label={`Arpeggiate ${chordData.symbol} (${activeVoicing?.label || ''})`}
          >
            Arp
          </button>
        </div>
      </div>

      <div className="glass-recessed rounded-[3px] py-2 px-1 sm:py-3 sm:px-2">
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
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] sm:text-[11px] text-slate-300">
          <span className="truncate">{activeVoicing?.label}</span>
          <span className="text-slate-400 shrink-0 tabular-nums">
            {safeIdx + 1}/{chordData.voicings.length}
          </span>
        </div>

        {isBassWithVariations ? (
          showVariations ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {chordData.voicings.map((v, idx) => (
                  <button
                    key={`${v.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      setVoicingIdx(idx);
                      if (isFavorite && onSyncFavoriteVoicing) {
                        onSyncFavoriteVoicing(favId, idx);
                      }
                      learnAudio.playChord(v.midiNotes, refFrequency, instrument, playMode);
                    }}
                    aria-pressed={idx === safeIdx}
                    className={`min-h-[38px] sm:min-h-[34px] px-2 py-1 rounded-[2px] border font-mono text-[10px] font-medium transition-colors cursor-pointer ${
                      idx === safeIdx
                        ? 'bg-white/20 text-white border-white/35'
                        : 'bg-white/[0.04] text-slate-300 border-white/10 hover:text-white hover:bg-white/[0.1]'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowVariations(false)}
                aria-expanded={true}
                className="min-h-[38px] sm:min-h-[34px] px-2.5 py-1 rounded-[2px] border border-white/12 bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 font-mono text-[10px] font-semibold cursor-pointer transition-colors"
              >
                Hide Variations
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowVariations(true)}
              aria-expanded={false}
              className="min-h-[40px] sm:min-h-[36px] px-2.5 py-1 rounded-[2px] border border-cyan-300/30 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-200 font-mono text-[11px] font-semibold cursor-pointer transition-colors"
            >
              More Variations (+{chordData.voicings.length - 1})
            </button>
          )
        ) : (
          chordData.voicings.length > 1 && (
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {chordData.voicings.map((v, idx) => (
                <button
                  key={`${v.label}-${idx}`}
                  type="button"
                  onClick={() => {
                    setVoicingIdx(idx);
                    if (isFavorite && onSyncFavoriteVoicing) {
                      onSyncFavoriteVoicing(favId, idx);
                    }
                    learnAudio.playChord(v.midiNotes, refFrequency, instrument, playMode);
                  }}
                  aria-pressed={idx === safeIdx}
                  className={`min-h-[38px] sm:min-h-[34px] px-2.5 py-1 rounded-[2px] border font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                    idx === safeIdx
                      ? 'bg-white/20 text-white border-white/35'
                      : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-slate-200'
                  }`}
                >
                  Pos {idx + 1}
                </button>
              ))}
            </div>
          )
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
  const chordPlayMode =
    activeLearn.chordPlayMode === 'arpeggio' ? 'arpeggio' : 'strum';
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
  const [favorites, setFavorites] = useState(() => loadFavoriteChords());
  const [showFavoritesTray, setShowFavoritesTray] = useState(false);

  const [metroBpm, setMetroBpm] = useState(DEFAULT_BPM);
  const [metroTimeSigId, setMetroTimeSigId] = useState('4/4');
  const [isMetroPlaying, setIsMetroPlaying] = useState(false);

  const [customSequence, setCustomSequence] = useState(() => loadCustomProgression());
  const [showSequencer, setShowSequencer] = useState(false);
  const [seqWithClick, setSeqWithClick] = useState(true);
  const [seqLoop, setSeqLoop] = useState(true);
  const [isSeqPlaying, setIsSeqPlaying] = useState(false);
  const [activeSeqState, setActiveSeqState] = useState(null);

  const fretboardScrollRef = useRef(null);
  const defaultStepBeats = getTimeSignatureConfig(metroTimeSigId).beats;

  const favoriteIdSet = useMemo(
    () => new Set(favorites.map((entry) => entry.id)),
    [favorites]
  );

  const resolvedSequenceAudioSteps = useMemo(() => {
    return customSequence
      .map((step) => {
        const chordData = getChordVoicings(
          step.rootPc,
          step.qualityId,
          step.preferFlats,
          step.instrument
        );
        if (!chordData || !chordData.voicings.length) return null;
        const safeIdx = Math.min(
          Math.max(0, step.voicingIdx || 0),
          chordData.voicings.length - 1
        );
        return {
          uid: step.uid,
          instrument: step.instrument,
          beats: step.beats,
          midiNotes: chordData.voicings[safeIdx].midiNotes,
        };
      })
      .filter(Boolean);
  }, [customSequence]);

  useEffect(() => {
    if (!isSeqPlaying) return;
    if (resolvedSequenceAudioSteps.length === 0) {
      learnAudio.stopCustomProgression();
      setIsSeqPlaying(false);
      setActiveSeqState(null);
      return;
    }
    learnAudio.updateCustomProgression({
      steps: resolvedSequenceAudioSteps,
      bpm: metroBpm,
      refFrequency,
      playMode: chordPlayMode,
      withClick: seqWithClick,
      loop: seqLoop,
    });
  }, [
    isSeqPlaying,
    resolvedSequenceAudioSteps,
    metroBpm,
    refFrequency,
    chordPlayMode,
    seqWithClick,
    seqLoop,
  ]);

  const handleToggleFavorite = (chordData, voicingIdx = 0) => {
    setFavorites((prev) =>
      toggleFavoriteChord(prev, {
        instrument,
        rootPc: chordData.rootPc,
        qualityId: chordData.quality.id,
        voicingIdx,
        preferFlats: chordData.preferFlats,
      })
    );
  };

  const handleSyncFavoriteVoicing = (favId, nextIdx) => {
    setFavorites((prev) => updateFavoriteChordVoicing(prev, favId, nextIdx));
  };

  const handleRemoveFavorite = (favId) => {
    setFavorites((prev) => removeFavoriteChord(prev, favId));
  };

  const handleClearFavorites = () => {
    saveFavoriteChords([]);
    setFavorites([]);
  };

  const handleAddFavoriteToSequence = (fav) => {
    setCustomSequence((prev) =>
      appendFavoriteToProgression(prev, fav, defaultStepBeats)
    );
    setShowSequencer(true);
  };

  const handleQueueAllFavoritesToSequence = (favList = favorites) => {
    const newSteps = favList
      .map((fav) => createProgressionStep(fav, defaultStepBeats))
      .filter(Boolean);
    if (newSteps.length === 0) return;
    setCustomSequence((prev) => {
      const next = [...prev, ...newSteps];
      saveCustomProgression(next);
      return next;
    });
    setShowSequencer(true);
  };

  const handleRemoveSequenceStep = (uid) => {
    setCustomSequence((prev) => removeProgressionStep(prev, uid));
  };

  const handleMoveSequenceStep = (fromIdx, toIdx) => {
    setCustomSequence((prev) => moveProgressionStep(prev, fromIdx, toIdx));
  };

  const handleDuplicateSequenceStep = (uid) => {
    setCustomSequence((prev) => duplicateProgressionStep(prev, uid));
  };

  const handleChangeSequenceStepBeats = (uid, nextBeats) => {
    setCustomSequence((prev) => updateProgressionStepBeats(prev, uid, nextBeats));
  };

  const handleClearSequence = () => {
    if (isSeqPlaying) {
      learnAudio.stopCustomProgression();
      setIsSeqPlaying(false);
      setActiveSeqState(null);
    }
    setCustomSequence(clearCustomProgression());
  };

  const handleToggleSequencePlay = () => {
    if (isSeqPlaying) {
      learnAudio.stopCustomProgression();
      setIsSeqPlaying(false);
      setActiveSeqState(null);
      return;
    }

    if (resolvedSequenceAudioSteps.length === 0) return;
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    setActiveProgStep(null);
    setActiveStrumId(null);
    setIsMetroPlaying(false);

    const started = learnAudio.startCustomProgression({
      steps: resolvedSequenceAudioSteps,
      bpm: metroBpm,
      refFrequency,
      playMode: chordPlayMode,
      withClick: seqWithClick,
      loop: seqLoop,
      onStepBeat: (beatInfo) => {
        setActiveSeqState(beatInfo);
      },
      onComplete: () => {
        setIsSeqPlaying(false);
        setActiveSeqState(null);
      },
    });
    if (started) {
      setIsSeqPlaying(true);
    }
  };

  const handlePreviewSequenceStep = (
    midiNotes,
    targetRefFreq,
    targetInstrument,
    mode
  ) => {
    setIsSeqPlaying(false);
    setActiveSeqState(null);
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    setActiveProgStep(null);
    setActiveStrumId(null);
    learnAudio.playChord(midiNotes, targetRefFreq, targetInstrument, mode);
  };

  const handlePlayFavoriteChord = (
    cardKey,
    midiNotes,
    mode,
    targetInstrument,
    targetRefFreq
  ) => {
    setIsSeqPlaying(false);
    setActiveSeqState(null);
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    setActiveProgStep(null);
    setActiveStrumId(`${cardKey}:${mode}`);
    learnAudio.playChord(midiNotes, targetRefFreq, targetInstrument, mode);
  };

  const handleInspectFavorite = (fav, chordData) => {
    stopPlaybackState();
    if (fav.instrument !== instrument && onSelectInstrument) {
      onSelectInstrument(fav.instrument);
    }
    onUpdateLearn({
      tab: 'chords',
      rootPc: fav.rootPc,
      chordQuery: chordData.symbol,
      familyModalTarget: null,
    });
  };

  const stopPlaybackState = () => {
    learnAudio.stopAll();
    setIsSeqPlaying(false);
    setActiveSeqState(null);
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

  // Compute supported chord qualities dynamically for the chosen rootPc & instrument
  const filteredChords = useMemo(() => {
    const availableQualities = getChordQualitiesForInstrument(instrument);
    return availableQualities
      .filter((q) => chordCategory === 'All' || q.category === chordCategory)
      .map((q) => getChordVoicings(rootPc, q.id, null, instrument));
  }, [rootPc, chordCategory, instrument]);

  const coreChords = useMemo(
    () => filteredChords.filter((c) => c.quality.tier === 'core'),
    [filteredChords]
  );

  const complexChords = useMemo(
    () => filteredChords.filter((c) => c.quality.tier !== 'core'),
    [filteredChords]
  );

  const quickLookups =
    instrument === 'bass' ? BASS_QUICK_CHORD_LOOKUPS : QUICK_CHORD_LOOKUPS;

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

  useEffect(() => {
    if (activeTab !== 'scales') return;
    const scroller = fretboardScrollRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const targetLeft =
      boxWindow.min <= 0
        ? 0
        : Math.max(0, Math.round((boxWindow.min / 16) * scroller.scrollWidth - 48));
    scroller.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [activeTab, boxFilter, boxWindow.min]);

  const activeProgression = useMemo(
    () => buildProgression(rootPc, progressionId, instrument),
    [rootPc, progressionId, instrument]
  );

  const handleStrum = (cardId, midiNotes, mode = chordPlayMode) => {
    setIsSeqPlaying(false);
    setActiveSeqState(null);
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    setActiveProgStep(null);
    setActiveStrumId(`${cardId}:${mode}`);
    learnAudio.playChord(midiNotes, refFrequency, instrument, mode);
  };

  const handlePlayScale = () => {
    if (isPlayingScale) {
      learnAudio.stopAll();
      setIsPlayingScale(false);
      setPlayingScalePc(null);
      return;
    }
    setIsSeqPlaying(false);
    setActiveSeqState(null);
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
    setIsSeqPlaying(false);
    setActiveSeqState(null);
    setIsPlayingScale(false);
    setPlayingScalePc(null);
    learnAudio.playProgression(
      activeProgression.chords,
      refFrequency,
      900,
      (idx) => setActiveProgStep(idx),
      () => setActiveProgStep(null),
      instrument,
      chordPlayMode
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
        className="glass-panel rounded-[4px] p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4"
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
              className="min-h-[40px] px-3.5 py-1.5 rounded-[2px] border border-white/15 bg-white/[0.08] hover:bg-white/[0.16] text-slate-100 font-mono text-xs font-semibold inline-flex items-center gap-2 active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer max-w-full"
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
              className="grid grid-cols-3 sm:flex items-center gap-1 glass-recessed rounded-[3px] p-1 shrink-0"
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
                    className={`min-h-[40px] px-3 py-1.5 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.97] transition-transform duration-100 cursor-pointer ${
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
              className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 glass-recessed rounded-[3px] p-1 shrink-0"
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
                    className={`min-h-[40px] px-2.5 sm:px-3.5 py-2 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.97] transition-transform duration-100 cursor-pointer ${
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
                  className={`min-h-[44px] min-w-[56px] sm:min-w-0 shrink-0 px-2.5 sm:px-2 py-2 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.96] transition-transform duration-100 whitespace-nowrap cursor-pointer ${
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

      {/* Practice Metronome + Saved Favorite Chords + Custom Sequencer Dock */}
      <PracticeMetronomeBar
        bpm={metroBpm}
        onBpmChange={setMetroBpm}
        timeSigId={metroTimeSigId}
        onTimeSigChange={setMetroTimeSigId}
        isPlaying={isMetroPlaying}
        onPlayingChange={(nextMetro) => {
          if (nextMetro) {
            setIsSeqPlaying(false);
            setActiveSeqState(null);
          }
          setIsMetroPlaying(nextMetro);
        }}
        favoritesCount={favorites.length}
        showFavoritesTray={showFavoritesTray}
        onToggleFavoritesTray={() => setShowFavoritesTray((prev) => !prev)}
        sequenceCount={customSequence.length}
        showSequencer={showSequencer}
        onToggleSequencer={() => setShowSequencer((prev) => !prev)}
      />

      {showFavoritesTray && (
        <FavoriteChordsTray
          favorites={favorites}
          currentInstrument={instrument}
          labelMode={chordLabelMode}
          playMode={chordPlayMode}
          refFrequency={refFrequency}
          activeStrumId={activeStrumId}
          onPlayChord={handlePlayFavoriteChord}
          onAddToSequence={handleAddFavoriteToSequence}
          onQueueAllFavorites={handleQueueAllFavoritesToSequence}
          onRemoveFavorite={handleRemoveFavorite}
          onClearAll={handleClearFavorites}
          onInspectFavorite={handleInspectFavorite}
          onClose={() => setShowFavoritesTray(false)}
        />
      )}

      {showSequencer && (
        <CustomProgressionSequencer
          steps={customSequence}
          favorites={favorites}
          bpm={metroBpm}
          defaultStepBeats={defaultStepBeats}
          playMode={chordPlayMode}
          withClick={seqWithClick}
          loop={seqLoop}
          isPlaying={isSeqPlaying}
          activeState={activeSeqState}
          labelMode={chordLabelMode}
          refFrequency={refFrequency}
          onBpmChange={setMetroBpm}
          onTogglePlay={handleToggleSequencePlay}
          onToggleWithClick={() => setSeqWithClick((prev) => !prev)}
          onToggleLoop={() => setSeqLoop((prev) => !prev)}
          onChangePlayMode={(nextMode) => {
            if (chordPlayMode !== nextMode) {
              onUpdateLearn({ chordPlayMode: nextMode }, { replace: true });
            }
          }}
          onAddFavoriteStep={handleAddFavoriteToSequence}
          onQueueAllFavorites={() => handleQueueAllFavoritesToSequence(favorites)}
          onRemoveStep={handleRemoveSequenceStep}
          onMoveStep={handleMoveSequenceStep}
          onDuplicateStep={handleDuplicateSequenceStep}
          onChangeStepBeats={handleChangeSequenceStepBeats}
          onClearSequence={handleClearSequence}
          onPreviewStep={handlePreviewSequenceStep}
          onBrowseChords={() =>
            onUpdateLearn({ tab: 'chords', chordQuery: '', familyModalTarget: null })
          }
          onClose={() => setShowSequencer(false)}
        />
      )}

      {/* TAB 1: CHORD LIBRARY & DIAGRAM LOOKUP */}
      {activeTab === 'chords' && (
        <section aria-label="Chord Diagrams Library" className="flex flex-col gap-4">
          {/* Chord Diagram Search Bar */}
          <div className="glass-panel rounded-[4px] p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="chord-diagram-search"
                className="font-display font-bold text-base sm:text-lg text-white"
              >
                Chord Diagram Lookup
              </label>
              <span className="font-mono text-xs text-slate-400">
                {instrument === 'bass'
                  ? 'Simple 1-note Major roots · tap More Variations for 5ths, octaves & shells'
                  : 'Type any chord symbol or quality (sus, dim, m7b5, 7#9, 9, 13, m11, 6/9)'}
              </span>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
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
                    strokeLinecap="square"
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
                  placeholder={
                    instrument === 'bass'
                      ? 'Look up bass chord (e.g. G, C#, Am, G5, E7#9)...'
                      : 'Look up chord diagram (e.g. F#dim, Bbsus4, E7#9, Am11, Cdim7)...'
                  }
                  aria-label="Search chord diagram"
                  className="w-full min-h-[48px] sm:min-h-[46px] pl-10 pr-20 py-2.5 rounded-[2px] glass-recessed border border-white/15 focus:border-cyan-300/60 focus:outline-none font-mono text-base sm:text-sm text-white placeholder:text-slate-400 transition-colors"
                />
                {chordQuery && (
                  <button
                    type="button"
                    onClick={() => onUpdateLearn({ chordQuery: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-[2px] bg-white/10 hover:bg-white/20 text-slate-200 font-mono text-xs cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 shrink-0">
                <div
                  role="group"
                  aria-label="Chord Playback Style"
                  className="grid grid-cols-2 sm:flex items-center gap-1 glass-recessed rounded-[3px] p-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (chordPlayMode !== 'strum') {
                        onUpdateLearn({ chordPlayMode: 'strum' }, { replace: true });
                      }
                    }}
                    aria-pressed={chordPlayMode === 'strum'}
                    className={`min-h-[40px] sm:min-h-[38px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      chordPlayMode === 'strum'
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_2px_10px_rgba(34,211,238,0.28)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Strum
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (chordPlayMode !== 'arpeggio') {
                        onUpdateLearn({ chordPlayMode: 'arpeggio' }, { replace: true });
                      }
                    }}
                    aria-pressed={chordPlayMode === 'arpeggio'}
                    className={`min-h-[40px] sm:min-h-[38px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      chordPlayMode === 'arpeggio'
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_2px_10px_rgba(34,211,238,0.28)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Pluck / Arp
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-1.5 glass-recessed rounded-[3px] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (chordLabelMode !== 'fingers') {
                        onUpdateLearn({ chordLabelMode: 'fingers' }, { replace: true });
                      }
                    }}
                    aria-pressed={chordLabelMode === 'fingers'}
                    className={`min-h-[40px] sm:min-h-[38px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
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
                    className={`min-h-[40px] sm:min-h-[38px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      chordLabelMode === 'notes'
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Note Names
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Complex Chord Lookups */}
            <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar pb-0.5 sm:pb-0">
              <span className="font-mono text-[11px] text-slate-400 mr-1 whitespace-nowrap shrink-0">
                {instrument === 'bass' ? 'Try bass shapes:' : 'Try complex:'}
              </span>
              {quickLookups.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    if (chordQuery.trim().toLowerCase() !== sample.toLowerCase()) {
                      onUpdateLearn({ chordQuery: sample });
                    }
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
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
                  playMode={chordPlayMode}
                  refFrequency={refFrequency}
                  activeRootPc={rootPc}
                  isFavorite={favoriteIdSet.has(
                    makeFavoriteChordId({
                      instrument,
                      rootPc: chordSearchResults.exactChord.rootPc,
                      qualityId: chordSearchResults.exactChord.quality.id,
                    })
                  )}
                  onToggleFavorite={handleToggleFavorite}
                  onSyncFavoriteVoicing={handleSyncFavoriteVoicing}
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
                          playMode={chordPlayMode}
                          refFrequency={refFrequency}
                          activeStrumId={activeStrumId}
                          isFavorite={favoriteIdSet.has(
                            makeFavoriteChordId({
                              instrument,
                              rootPc: chordData.rootPc,
                              qualityId: chordData.quality.id,
                            })
                          )}
                          onToggleFavorite={handleToggleFavorite}
                          onSyncFavoriteVoicing={handleSyncFavoriteVoicing}
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
              <div className="glass-panel rounded-[4px] p-6 text-center flex flex-col items-center gap-3">
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
                  className="min-h-[40px] px-4 py-2 rounded-[2px] border border-white/15 bg-white/[0.08] text-white font-mono text-xs font-semibold cursor-pointer hover:bg-white/[0.15]"
                >
                  Reset Search
                </button>
              </div>
            )
          ) : (
            <>
              <div className="glass-panel rounded-[4px] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2">
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
                        className={`min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          active
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowFavoritesTray((prev) => !prev)}
                    aria-pressed={showFavoritesTray}
                    className={`min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      showFavoritesTray
                        ? 'bg-amber-400/20 text-amber-200 border-amber-300/45'
                        : 'bg-white/[0.04] text-amber-200/90 border-amber-300/20 hover:bg-amber-400/12'
                    }`}
                  >
                    <span aria-hidden="true">★</span>
                    <span>Favorites ({favorites.length})</span>
                  </button>
                </div>
                <span className="font-mono text-xs text-slate-400">
                  Showing {filteredChords.length} {instrumentMeta.label} {selectedRootName} diagrams
                  {instrument === 'bass' ? ' · Simple Root + Expandable Variations' : ''}
                </span>
              </div>

              {chordCategory === 'All' ? (
                <div className="flex flex-col gap-5">
                  {/* Primary Major & Core Chords */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                      <h2 className="font-display font-bold text-base sm:text-lg text-white">
                        Major &amp; Core Chords
                      </h2>
                      <span className="font-mono text-[11px] text-cyan-300">
                        Major prioritized first · 7th, Power &amp; Minor ({coreChords.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                      {coreChords.map((chordData) => (
                        <ChordCard
                          key={`${chordData.rootPc}-${chordData.quality.id}`}
                          chordData={chordData}
                          instrument={instrument}
                          labelMode={chordLabelMode}
                          playMode={chordPlayMode}
                          refFrequency={refFrequency}
                          activeStrumId={activeStrumId}
                          isFavorite={favoriteIdSet.has(
                            makeFavoriteChordId({
                              instrument,
                              rootPc: chordData.rootPc,
                              qualityId: chordData.quality.id,
                            })
                          )}
                          onToggleFavorite={handleToggleFavorite}
                          onSyncFavoriteVoicing={handleSyncFavoriteVoicing}
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

                  {/* Complex, Extended, Suspended & Altered Chords */}
                  <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                      <h2 className="font-display font-bold text-base sm:text-lg text-slate-100">
                        Extended, Suspended &amp; Altered Chords
                      </h2>
                      <span className="font-mono text-[11px] text-slate-400">
                        Add9, Maj9, 6/9, Sus, 9th/13th, Dim &amp; Altered ({complexChords.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                      {complexChords.map((chordData) => (
                        <ChordCard
                          key={`${chordData.rootPc}-${chordData.quality.id}`}
                          chordData={chordData}
                          instrument={instrument}
                          labelMode={chordLabelMode}
                          playMode={chordPlayMode}
                          refFrequency={refFrequency}
                          activeStrumId={activeStrumId}
                          isFavorite={favoriteIdSet.has(
                            makeFavoriteChordId({
                              instrument,
                              rootPc: chordData.rootPc,
                              qualityId: chordData.quality.id,
                            })
                          )}
                          onToggleFavorite={handleToggleFavorite}
                          onSyncFavoriteVoicing={handleSyncFavoriteVoicing}
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
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                  {filteredChords.map((chordData) => (
                    <ChordCard
                      key={`${chordData.rootPc}-${chordData.quality.id}`}
                      chordData={chordData}
                      instrument={instrument}
                      labelMode={chordLabelMode}
                      playMode={chordPlayMode}
                      refFrequency={refFrequency}
                      activeStrumId={activeStrumId}
                      isFavorite={favoriteIdSet.has(
                        makeFavoriteChordId({
                          instrument,
                          rootPc: chordData.rootPc,
                          qualityId: chordData.quality.id,
                        })
                      )}
                      onToggleFavorite={handleToggleFavorite}
                      onSyncFavoriteVoicing={handleSyncFavoriteVoicing}
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
              )}
            </>
          )}
        </section>
      )}

      {/* TAB 2: SCALE EXPLORER */}
      {activeTab === 'scales' && (
        <section aria-label="Scale Explorer" className="flex flex-col gap-4">
          {/* Scale Selector & Playback Controls */}
          <div className="glass-panel rounded-[4px] p-4 sm:p-5 flex flex-col gap-4">
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
                  className={`min-h-[44px] px-4 py-2 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap cursor-pointer transition-[transform,background-color,border-color,color] duration-200 ${
                    isPlayingScale
                      ? 'bg-rose-500/25 text-rose-100 border-rose-300/40'
                      : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
                  }`}
                >
                  {isPlayingScale ? 'Stop Scale' : 'Play Ascending Scale'}
                </button>

                <div className="flex items-center gap-1 glass-recessed rounded-[3px] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (scaleLabelMode !== 'notes') {
                        onUpdateLearn({ scaleLabelMode: 'notes' }, { replace: true });
                      }
                    }}
                    aria-pressed={scaleLabelMode === 'notes'}
                    className={`min-h-[36px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
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
                    className={`min-h-[36px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
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
                    className={`min-h-[42px] px-3.5 py-2 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
                    className={`min-h-[54px] p-2 rounded-[3px] border flex flex-col items-center justify-center gap-0.5 active:scale-[0.96] transition-[transform,background-color,border-color,box-shadow] duration-150 cursor-pointer ${
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
          <div className="glass-panel rounded-[4px] p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4">
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
                      className={`min-h-[36px] px-2.5 py-1 rounded-[2px] border font-mono text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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

            <div ref={fretboardScrollRef} className="overflow-x-auto pb-2">
              <div className="min-w-[780px] glass-recessed rounded-[3px] p-3 sm:p-4">
                {/* Fret Numbers Header */}
                <div className="grid grid-cols-[44px_repeat(16,minmax(0,1fr))] items-center gap-1 mb-2">
                  <div className="sticky left-0 z-20 bg-[#0c1426]/95 backdrop-blur-sm py-1 rounded-[2px] font-mono text-[10px] text-slate-400 text-center">
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

                {/* Instrument Strings */}
                <div className="flex flex-col gap-1.5">
                  {fretboardData.rows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[44px_repeat(16,minmax(0,1fr))] items-center gap-1"
                    >
                      <div className="sticky left-0 z-20 bg-[#0c1426]/95 backdrop-blur-sm py-1.5 rounded-[2px] font-mono text-xs font-semibold text-slate-300 text-center">
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
                            className={`relative h-11 sm:h-10 flex items-center justify-center rounded-[2px] ${
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
                                className={`relative z-10 w-9 h-9 sm:w-8 sm:h-8 rounded-[2px] font-mono text-[11px] font-bold flex items-center justify-center active:scale-90 transition-[transform,opacity,background-color,box-shadow] duration-150 cursor-pointer ${
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
                                  className="w-2 h-2 rotate-45 rounded-[1px] bg-white/15 pointer-events-none"
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
            <div className="glass-panel rounded-[4px] p-4 sm:p-5 flex flex-col gap-3">
              <h3 className="font-display font-bold text-base text-white">
                Diatonic Chords in {selectedRootName} {fretboardData.details.scale.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {fretboardData.details.diatonicChords.map((dc) => {
                  const voiced = getChordVoicings(dc.rootPc, dc.qualityId, null, instrument);
                  const singleNote = voiced.voicings[0]?.midiNotes?.length === 1;
                  return (
                    <button
                      key={`${dc.roman}-${dc.symbol}`}
                      type="button"
                      onClick={() => {
                        if (voiced.voicings[0]) {
                          learnAudio.playChord(
                            voiced.voicings[0].midiNotes,
                            refFrequency,
                            instrument,
                            chordPlayMode
                          );
                        }
                      }}
                      className="min-h-[68px] p-3 rounded-[3px] glass-recessed hover:bg-white/[0.1] border border-white/12 flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer"
                    >
                      <span className="font-mono text-[11px] text-cyan-300">
                        {dc.roman}
                      </span>
                      <span className="font-display font-bold text-lg text-white">
                        {dc.symbol}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {singleNote
                          ? 'Tap to Pluck'
                          : chordPlayMode === 'arpeggio'
                            ? 'Tap to Pluck / Arp'
                            : 'Tap to Strum'}
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
          <div className="glass-panel rounded-[4px] p-4 sm:p-5 flex flex-col gap-4">
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

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div
                  role="group"
                  aria-label="Progression Playback Style"
                  className="flex items-center gap-1 glass-recessed rounded-[3px] p-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (chordPlayMode !== 'strum') {
                        onUpdateLearn({ chordPlayMode: 'strum' }, { replace: true });
                      }
                    }}
                    aria-pressed={chordPlayMode === 'strum'}
                    className={`min-h-[38px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      chordPlayMode === 'strum'
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Strum
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (chordPlayMode !== 'arpeggio') {
                        onUpdateLearn({ chordPlayMode: 'arpeggio' }, { replace: true });
                      }
                    }}
                    aria-pressed={chordPlayMode === 'arpeggio'}
                    className={`min-h-[38px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      chordPlayMode === 'arpeggio'
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Pluck / Arp
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePlayProgression}
                  className={`min-h-[44px] px-4 py-2 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer transition-[transform,background-color,border-color,color] duration-200 ${
                    activeProgStep !== null
                      ? 'bg-rose-500/25 text-rose-100 border-rose-300/40'
                      : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
                  }`}
                >
                  {activeProgStep !== null ? 'Stop Progression' : 'Play Progression'}
                </button>
              </div>
            </div>

            {/* Quick Guitar Key Families (G-C-D, C-F-G, D-G-A, etc.) */}
            <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar pb-0.5 sm:pb-0">
              <span className="font-mono text-[11px] text-slate-400 mr-1 whitespace-nowrap shrink-0">
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
                    className={`min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
                    className={`min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
                        learnAudio.playChord(
                          firstVoicing.midiNotes,
                          refFrequency,
                          instrument,
                          chordPlayMode
                        );
                      }
                    }}
                    className={`p-2.5 sm:p-4 rounded-[3px] border text-left flex flex-col gap-2 sm:gap-3 active:scale-[0.98] transition-[transform,background-color,border-color,box-shadow] duration-200 cursor-pointer ${
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
          <div className="glass-panel rounded-[4px] p-4 sm:p-5 flex flex-col gap-3">
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
                    className={`rounded-[3px] p-3 border flex flex-col justify-between gap-2 ${
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
                            learnAudio.playChord(
                              fc.voicings[0].midiNotes,
                              refFrequency,
                              instrument,
                              chordPlayMode
                            );
                          }
                        }}
                        className="flex-1 min-h-[40px] px-2 py-1.5 rounded-[2px] bg-white/[0.08] hover:bg-white/[0.16] border border-white/12 font-mono text-[11px] font-semibold text-white cursor-pointer transition-colors"
                      >
                        {fc.voicings[0]?.midiNotes?.length === 1
                          ? 'Pluck'
                          : chordPlayMode === 'arpeggio'
                            ? 'Arp'
                            : 'Strum'}
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
                        className="min-h-[40px] px-2.5 py-1.5 rounded-[2px] bg-white/[0.04] hover:bg-white/[0.12] border border-white/10 font-mono text-[11px] text-slate-300 cursor-pointer transition-colors"
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
          <div className="glass-panel rounded-[4px] p-4 sm:p-5 flex flex-col gap-3">
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
                    className="min-h-[68px] p-3 rounded-[3px] glass-recessed hover:bg-white/[0.1] border border-white/12 flex flex-col items-start justify-between gap-1 text-left active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer"
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

      {/* TAB 4: THEORY & GUIDES (CIRCLE OF FIFTHS, TABS, NASHVILLE NUMBERS, FUNDAMENTALS) */}
      {activeTab === 'theory' && (
        <TheoryGuidesSection
          instrument={instrument}
          rootPc={rootPc}
          refFrequency={refFrequency}
          playMode={chordPlayMode}
          onSelectRoot={handleSelectRoot}
          onNavigateTab={(nextTab, patch = {}) => {
            stopPlaybackState();
            onUpdateLearn({
              tab: nextTab,
              familyModalTarget: null,
              ...patch,
            });
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'auto' });
            }
          }}
        />
      )}

      <ChordFamilyModal
        target={familyModalTarget}
        instrument={instrument}
        playMode={chordPlayMode}
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
