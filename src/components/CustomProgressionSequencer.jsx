import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getChordVoicings } from '../utils/musicTheory';
import { getInstrumentMeta } from '../utils/frequencyUtils';
import {
  clampStepBeats,
  findDragTargetSlotIndex,
  getSequenceDurationSec,
  getSequenceTotalBeats,
  MAX_STEP_BEATS,
  MIN_STEP_BEATS,
  previewProgressionReorder,
} from '../utils/customProgression';
import { clampBpm, MAX_BPM, MIN_BPM } from '../utils/metronome';
import {
  RHYTHM_PATTERNS,
  getRhythmPattern,
  normalizeRhythmId,
} from '../utils/rhythmTheory';
import ChordDiagramSVG from './ChordDiagramSVG';

const QUICK_RHYTHM_IDS = [
  { id: 'single', label: 'Single' },
  { id: 'quarter-downs', label: '4/4 Downs' },
  { id: 'pendulum-strum', label: 'Pendulum' },
  { id: 'rock-eighths', label: 'Rock D-U' },
  { id: 'island-strum', label: 'Island' },
  { id: 'pop-backbeat', label: 'Chuck 2&4' },
  { id: 'sixteenth-full', label: '16th (1e&a)' },
  { id: 'swing-shuffle', label: 'Swing' },
  { id: 'waltz-3-4', label: '3/4 Waltz' },
];

const getMiniSlotTone = (action, isActive) => {
  if (isActive) {
    if (action === 'rest') {
      return 'bg-amber-300/25 border-amber-300 text-amber-100';
    }
    return 'bg-emerald-400 border-emerald-200 text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.45)]';
  }
  switch (action) {
    case 'accent-down':
      return 'bg-cyan-400/18 border-cyan-300/45 text-cyan-100';
    case 'down':
      return 'bg-white/[0.08] border-white/18 text-white';
    case 'up':
      return 'bg-sky-400/12 border-sky-300/30 text-sky-200';
    case 'chuck':
      return 'bg-amber-400/16 border-amber-300/40 text-amber-200';
    case 'bass':
      return 'bg-emerald-400/14 border-emerald-300/35 text-emerald-200';
    case 'rest':
    default:
      return 'bg-slate-950/55 border-white/10 text-slate-500';
  }
};

const CustomProgressionSequencer = ({
  steps = [],
  favorites = [],
  bpm = 90,
  defaultStepBeats = 4,
  playMode = 'strum',
  rhythmId = 'single',
  withClick = true,
  loop = true,
  isPlaying = false,
  activeState = null,
  labelMode = 'fingers',
  refFrequency = 440,
  onBpmChange,
  onTogglePlay,
  onToggleWithClick,
  onToggleLoop,
  onChangePlayMode,
  onChangeRhythm,
  onChangeStepRhythm,
  onOpenRhythmGuide,
  onAddFavoriteStep,
  onQueueAllFavorites,
  onRemoveStep,
  onMoveStep,
  onDuplicateStep,
  onChangeStepBeats,
  onClearSequence,
  onPreviewStep,
  onBrowseChords,
  onClose,
}) => {
  const [dragUi, setDragUi] = useState(null);

  const cardRefs = useRef(new Map());
  const dragSessionRef = useRef(null);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef(null);
  const prevUserSelectRef = useRef('');

  const resolvedSteps = useMemo(() => {
    return steps
      .map((step, originalIndex) => {
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
        const voicing = chordData.voicings[safeIdx];
        return {
          step,
          originalIndex,
          chordData,
          voicing,
          instMeta: getInstrumentMeta(step.instrument),
        };
      })
      .filter(Boolean);
  }, [steps]);

  const resolvedStepsRef = useRef(resolvedSteps);
  resolvedStepsRef.current = resolvedSteps;

  const onMoveStepRef = useRef(onMoveStep);
  onMoveStepRef.current = onMoveStep;

  useEffect(() => {
    return () => {
      if (dragSessionRef.current?.cleanup) {
        dragSessionRef.current.cleanup(true);
      }
      if (suppressTimerRef.current) {
        clearTimeout(suppressTimerRef.current);
      }
    };
  }, []);

  const resolvedFavorites = useMemo(() => {
    return favorites
      .map((fav) => {
        const chordData = getChordVoicings(
          fav.rootPc,
          fav.qualityId,
          fav.preferFlats,
          fav.instrument
        );
        if (!chordData || !chordData.voicings.length) return null;
        return {
          fav,
          chordData,
          instMeta: getInstrumentMeta(fav.instrument),
        };
      })
      .filter(Boolean);
  }, [favorites]);

  const totalBeats = useMemo(() => getSequenceTotalBeats(steps), [steps]);
  const loopSec = useMemo(() => getSequenceDurationSec(steps, bpm), [steps, bpm]);
  const sequencePattern = useMemo(() => getRhythmPattern(rhythmId), [rhythmId]);
  const liveDisplayPattern = useMemo(() => {
    if (isPlaying && activeState?.rhythmId) {
      return getRhythmPattern(activeState.rhythmId);
    }
    return sequencePattern;
  }, [isPlaying, activeState?.rhythmId, sequencePattern]);

  const displaySteps = useMemo(() => {
    if (!dragUi) return resolvedSteps;
    return previewProgressionReorder(
      resolvedSteps,
      dragUi.fromDisplayIdx,
      dragUi.targetDisplayIdx
    );
  }, [resolvedSteps, dragUi]);

  const draggedStepData = useMemo(() => {
    if (!dragUi) return null;
    return resolvedSteps.find((item) => item.step.uid === dragUi.uid) || null;
  }, [resolvedSteps, dragUi]);

  const beginPendingDrag = (e, stepUid, displayIdx, fromHandle = false) => {
    if (resolvedStepsRef.current.length < 2 || !onMoveStepRef.current) return;
    if (dragSessionRef.current) return;

    if (fromHandle) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();
    } else {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.target?.closest?.('[data-no-drag="true"]')) return;
    }

    const sourceEl = cardRefs.current.get(stepUid);
    if (!sourceEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const slotRects = resolvedStepsRef.current.map((item, i) => {
      const el = cardRefs.current.get(item.step.uid);
      const rect = el ? el.getBoundingClientRect() : sourceRect;
      return {
        index: i,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });

    const session = {
      pointerId: e.pointerId,
      uid: stepUid,
      fromDisplayIdx: displayIdx,
      targetDisplayIdx: displayIdx,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - sourceRect.left,
      offsetY: e.clientY - sourceRect.top,
      cardWidth: sourceRect.width,
      cardHeight: sourceRect.height,
      startScrollX: typeof window !== 'undefined' ? window.scrollX : 0,
      startScrollY: typeof window !== 'undefined' ? window.scrollY : 0,
      slotRects,
      threshold: fromHandle ? 3 : 6,
      activated: false,
      cleanup: null,
    };

    const cleanup = (cancelled = false) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);

      if (session.activated) {
        if (typeof document !== 'undefined') {
          document.body.style.userSelect = prevUserSelectRef.current || '';
        }
        if (!cancelled && session.targetDisplayIdx !== session.fromDisplayIdx) {
          const list = resolvedStepsRef.current;
          const fromOrig = list[session.fromDisplayIdx]?.originalIndex ?? session.fromDisplayIdx;
          const toOrig = list[session.targetDisplayIdx]?.originalIndex ?? session.targetDisplayIdx;
          if (fromOrig !== toOrig && onMoveStepRef.current) {
            onMoveStepRef.current(fromOrig, toOrig);
          }
        }
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = setTimeout(() => {
          suppressClickRef.current = false;
        }, 60);
      }

      dragSessionRef.current = null;
      setDragUi(null);
    };

    const handlePointerMove = (ev) => {
      if (ev.pointerId !== session.pointerId) return;

      const dist = Math.hypot(ev.clientX - session.startX, ev.clientY - session.startY);
      if (!session.activated) {
        if (dist < session.threshold) return;
        session.activated = true;
        suppressClickRef.current = true;
        if (typeof document !== 'undefined') {
          prevUserSelectRef.current = document.body.style.userSelect || '';
          document.body.style.userSelect = 'none';
        }
      }

      if (ev.cancelable) {
        ev.preventDefault();
      }

      const adjX = ev.clientX + ((typeof window !== 'undefined' ? window.scrollX : 0) - session.startScrollX);
      const adjY = ev.clientY + ((typeof window !== 'undefined' ? window.scrollY : 0) - session.startScrollY);
      const hitIdx = findDragTargetSlotIndex(session.slotRects, adjX, adjY);
      if (hitIdx >= 0) {
        session.targetDisplayIdx = hitIdx;
      }

      setDragUi({
        uid: session.uid,
        fromDisplayIdx: session.fromDisplayIdx,
        targetDisplayIdx: session.targetDisplayIdx,
        clientX: ev.clientX,
        clientY: ev.clientY,
        offsetX: session.offsetX,
        offsetY: session.offsetY,
        cardWidth: session.cardWidth,
        cardHeight: session.cardHeight,
      });
    };

    const handlePointerUp = (ev) => {
      if (ev.pointerId !== session.pointerId) return;
      cleanup(false);
    };

    const handlePointerCancel = (ev) => {
      if (ev.pointerId !== session.pointerId) return;
      cleanup(true);
    };

    const handleKeyDown = (ev) => {
      if (ev.key === 'Escape') {
        cleanup(true);
      }
    };

    session.cleanup = cleanup;
    dragSessionRef.current = session;

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);
  };

  const handleHandleKeyDown = (e, originalIndex) => {
    if (!onMoveStep) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (originalIndex > 0) {
        e.preventDefault();
        onMoveStep(originalIndex, originalIndex - 1);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (originalIndex < steps.length - 1) {
        e.preventDefault();
        onMoveStep(originalIndex, originalIndex + 1);
      }
    }
  };

  return (
    <section
      aria-label="Custom Chord Progression Rhythm Sequencer"
      className="glass-panel rounded-[4px] p-3.5 sm:p-5 border border-cyan-300/35 flex flex-col gap-4"
    >
      {/* Top Header & Transport */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="font-display font-bold text-base sm:text-lg text-white">
              Custom Rhythm Sequencer
            </h2>
            {resolvedSteps.length > 0 && (
              <span className="font-mono text-xs text-cyan-300 tabular-nums">
                {resolvedSteps.length} {resolvedSteps.length === 1 ? 'chord' : 'chords'} ·{' '}
                {totalBeats} {totalBeats === 1 ? 'beat' : 'beats'} · {loopSec.toFixed(1)}s{' '}
                {loop ? 'loop' : 'pass'}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-sans text-xs text-slate-300">
            Drag chords (or use the ⋮⋮ handle / ◀ ▶) to reorder, set beats per chord, and practice with synced beat clicks.
          </p>
        </div>

        {/* Transport & Rhythm Options */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Quick Tempo Synced with Practice Metronome */}
          <div className="flex items-center gap-1 glass-recessed rounded-[3px] p-1">
            <button
              type="button"
              onClick={() => onBpmChange && onBpmChange(clampBpm(bpm - 5))}
              disabled={bpm <= MIN_BPM}
              aria-label="Decrease sequence BPM by 5"
              className="min-h-[38px] sm:min-h-[34px] px-2 rounded-[2px] font-mono text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
            >
              -5
            </button>
            <span className="px-2 font-mono text-xs font-semibold text-white tabular-nums whitespace-nowrap">
              {bpm} BPM
            </span>
            <button
              type="button"
              onClick={() => onBpmChange && onBpmChange(clampBpm(bpm + 5))}
              disabled={bpm >= MAX_BPM}
              aria-label="Increase sequence BPM by 5"
              className="min-h-[38px] sm:min-h-[34px] px-2 rounded-[2px] font-mono text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
            >
              +5
            </button>
          </div>

          {/* Click Track Toggle */}
          <button
            type="button"
            onClick={onToggleWithClick}
            aria-pressed={withClick}
            className={`min-h-[40px] sm:min-h-[38px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              withClick
                ? 'bg-cyan-400/18 text-cyan-200 border-cyan-300/50 hover:bg-cyan-400/28'
                : 'bg-white/[0.05] text-slate-400 border-white/14 hover:text-slate-200'
            }`}
          >
            Click: {withClick ? 'On' : 'Off'}
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={onToggleLoop}
            aria-pressed={loop}
            className={`min-h-[40px] sm:min-h-[38px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              loop
                ? 'bg-white/20 text-white border-white/35'
                : 'bg-white/[0.05] text-slate-400 border-white/14 hover:text-slate-200'
            }`}
          >
            Loop: {loop ? 'On' : 'Off'}
          </button>

          {/* Playback Style */}
          {onChangePlayMode && (
            <div
              role="group"
              aria-label="Sequence Playback Style"
              className="flex items-center gap-1 glass-recessed rounded-[3px] p-1"
            >
              <button
                type="button"
                onClick={() => onChangePlayMode('strum')}
                aria-pressed={playMode === 'strum'}
                className={`min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  playMode === 'strum'
                    ? 'bg-white/20 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Strum
              </button>
              <button
                type="button"
                onClick={() => onChangePlayMode('arpeggio')}
                aria-pressed={playMode === 'arpeggio'}
                className={`min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  playMode === 'arpeggio'
                    ? 'bg-white/20 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Arp
              </button>
            </div>
          )}

          {/* Primary Play / Stop CTA */}
          <button
            type="button"
            onClick={() => onTogglePlay && onTogglePlay(resolvedSteps)}
            disabled={resolvedSteps.length === 0}
            className={`min-h-[42px] sm:min-h-[40px] px-4 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-[transform,background-color,border-color,color] duration-150 ${
              isPlaying
                ? 'bg-rose-500/25 text-rose-100 border-rose-400/55 hover:bg-rose-500/35'
                : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_2px_12px_rgba(34,211,238,0.28)] hover:bg-cyan-300'
            }`}
          >
            {isPlaying ? 'Stop Sequence' : 'Play Sequence'}
          </button>

          {resolvedSteps.length > 0 && onClearSequence && (
            <button
              type="button"
              onClick={onClearSequence}
              className="min-h-[40px] sm:min-h-[38px] px-3 py-1.5 rounded-[2px] border border-rose-400/35 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] sm:min-h-[38px] px-3 py-1.5 rounded-[2px] border border-white/18 bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
            >
              Hide
            </button>
          )}
        </div>
      </div>

      {/* Sequence Rhythm Selector & Live "Down / Up" Groove Strip */}
      <div className="glass-recessed rounded-[3px] p-3 sm:p-3.5 border border-white/12 flex flex-col gap-2.5 min-w-0">
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <label
                htmlFor="sequence-rhythm-select"
                className="font-mono text-xs font-semibold text-cyan-300 whitespace-nowrap shrink-0"
              >
                Rhythm Groove:
              </label>
              <div className="relative flex-1 min-w-0 sm:max-w-md">
                <select
                  id="sequence-rhythm-select"
                  value={sequencePattern.id}
                  onChange={(e) => onChangeRhythm && onChangeRhythm(e.target.value)}
                  className="appearance-none w-full min-w-0 min-h-[38px] pl-2.5 pr-7 py-1 rounded-[2px] border border-white/20 bg-slate-950/90 text-white font-mono text-xs font-semibold cursor-pointer focus:border-cyan-300 focus:outline-none"
                >
                  {RHYTHM_PATTERNS.map((pat) => (
                    <option key={pat.id} value={pat.id}>
                      {pat.name} ({pat.timeSig}) — {pat.shortCode}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  data-smooth-svg="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="square"
                  />
                </svg>
              </div>
            </div>

            {onOpenRhythmGuide && (
              <button
                type="button"
                onClick={onOpenRhythmGuide}
                className="self-start sm:self-auto min-h-[38px] px-3 py-1 rounded-[2px] border border-cyan-300/35 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-200 font-mono text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Rhythm Guide →
              </button>
            )}
          </div>

          {/* Quick 1-Tap Popular Rhythms */}
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_RHYTHM_IDS.map((preset) => {
              const active = sequencePattern.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeRhythm && onChangeRhythm(preset.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-[2px] border font-mono text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : 'bg-white/[0.04] text-slate-300 border-white/12 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live "Down / Up" Visual Stroke Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-2 border-t border-white/10 min-w-0">
          <div
            className={
              liveDisplayPattern.slots.length === 16
                ? 'grid grid-cols-4 sm:grid-cols-8 gap-1'
                : liveDisplayPattern.slots.length === 12
                  ? 'grid grid-cols-3 sm:grid-cols-6 gap-1'
                  : liveDisplayPattern.slots.length === 8
                    ? 'grid grid-cols-4 sm:grid-cols-8 gap-1'
                    : 'flex flex-wrap items-center gap-1'
            }
          >
            {liveDisplayPattern.slots.map((slot, sIdx) => {
              const slotActive = isPlaying && activeState?.slotIndex === sIdx;
              return (
                <div
                  key={`seq-slot-${liveDisplayPattern.id}-${sIdx}`}
                  className={`min-w-[38px] rounded-[2px] border px-1.5 py-1 flex flex-col items-center justify-center leading-tight transition-colors ${getMiniSlotTone(
                    slot.action,
                    slotActive
                  )}`}
                >
                  <span className="font-mono text-[9px] opacity-80">{slot.countLabel}</span>
                  <span className="font-display font-bold text-xs">{slot.arrow}</span>
                  <span className="font-mono text-[9px] font-bold">{slot.shortCode}</span>
                </div>
              );
            })}
          </div>

          <div className="font-mono text-[11px] text-cyan-200 leading-relaxed min-w-0">
            <span className="text-slate-400">Strum: </span>
            {liveDisplayPattern.upDownText}
          </div>
        </div>
      </div>

      {/* Sequence Steps Timeline */}
      {resolvedSteps.length === 0 ? (
        <div className="glass-recessed rounded-[3px] p-4 sm:p-5 text-center flex flex-col items-center gap-2.5">
          <p className="font-sans text-xs sm:text-sm text-slate-200">
            Your custom progression sequence is empty.
          </p>
          <p className="font-mono text-[11px] text-slate-400 max-w-lg">
            {resolvedFavorites.length > 0
              ? 'Tap any saved chord below to add it to your rhythm loop, or queue all your saved chords at once.'
              : 'Star ☆ chords in the Chord Library to save them, then queue them here to practice timed chord changes.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            {resolvedFavorites.length > 0 && onQueueAllFavorites && (
              <button
                type="button"
                onClick={onQueueAllFavorites}
                className="min-h-[40px] px-3.5 py-1.5 rounded-[2px] border border-cyan-300/50 bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 font-mono text-xs font-semibold cursor-pointer transition-colors"
              >
                Load All Saved Chords ({resolvedFavorites.length})
              </button>
            )}
            {resolvedFavorites.length === 0 && onBrowseChords && (
              <button
                type="button"
                onClick={onBrowseChords}
                className="min-h-[40px] px-3.5 py-1.5 rounded-[2px] border border-cyan-300/50 bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 font-mono text-xs font-semibold cursor-pointer transition-colors"
              >
                Browse Chord Library
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5 ${
            dragUi ? 'select-none' : ''
          }`}
        >
          {displaySteps.map(({ step, originalIndex, chordData, voicing, instMeta }, displayIdx) => {
            const isBeingDragged = dragUi?.uid === step.uid;
            const isActiveStep = !dragUi && isPlaying && activeState?.stepIndex === originalIndex;
            const activeBeatIdx = isActiveStep ? activeState?.beatIndex ?? 0 : -1;
            const stepBeats = clampStepBeats(step.beats);
            const canDrag = resolvedSteps.length > 1;

            return (
              <article
                key={step.uid}
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(step.uid, el);
                  } else {
                    cardRefs.current.delete(step.uid);
                  }
                }}
                draggable={false}
                onPointerDown={(e) => beginPendingDrag(e, step.uid, displayIdx, false)}
                className={`rounded-[3px] p-2.5 sm:p-3 border flex flex-col justify-between gap-2 transition-[background-color,border-color,box-shadow,opacity] duration-150 ${
                  isBeingDragged
                    ? 'border-dashed border-2 border-cyan-300/80 bg-cyan-400/10 shadow-[inset_0_0_20px_rgba(34,211,238,0.14)]'
                    : isActiveStep
                      ? 'bg-emerald-400/14 border-emerald-300/80 shadow-[0_0_20px_rgba(52,211,153,0.22)]'
                      : canDrag
                        ? 'glass-recessed border-white/14 sm:cursor-grab'
                        : 'glass-recessed border-white/14'
                }`}
              >
                <div
                  className={`flex flex-col justify-between gap-2 flex-1 ${
                    isBeingDragged ? 'opacity-20 pointer-events-none' : ''
                  }`}
                >
                  {/* Drag Handle + Step Number + Live Beat LEDs + Remove */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        data-drag-handle="true"
                        disabled={!canDrag}
                        onPointerDown={(e) => beginPendingDrag(e, step.uid, displayIdx, true)}
                        onKeyDown={(e) => handleHandleKeyDown(e, originalIndex)}
                        aria-label={`Drag to reorder step ${displayIdx + 1} (${chordData.symbol}), or use arrow keys`}
                        title={canDrag ? 'Drag to reorder chord' : 'Add another chord to reorder'}
                        className={`touch-none min-h-[34px] px-1.5 rounded-[2px] border flex items-center gap-1 shrink-0 transition-colors ${
                          canDrag
                            ? 'border-white/14 bg-white/[0.04] hover:bg-white/[0.12] hover:border-cyan-300/45 text-slate-300 hover:text-cyan-200 cursor-grab active:cursor-grabbing'
                            : 'border-transparent bg-transparent text-slate-400 cursor-default'
                        }`}
                      >
                        {canDrag && (
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 12 16"
                            fill="currentColor"
                            className="w-2.5 h-3.5 opacity-80 shrink-0"
                          >
                            <rect x="2.2" y="1.8" width="2.5" height="2.5" />
                            <rect x="7.2" y="1.8" width="2.5" height="2.5" />
                            <rect x="2.2" y="6.8" width="2.5" height="2.5" />
                            <rect x="7.2" y="6.8" width="2.5" height="2.5" />
                            <rect x="2.2" y="11.8" width="2.5" height="2.5" />
                            <rect x="7.2" y="11.8" width="2.5" height="2.5" />
                          </svg>
                        )}
                        <span
                          className={`font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                            isActiveStep ? 'text-emerald-300' : 'text-cyan-300'
                          }`}
                        >
                          {String(displayIdx + 1).padStart(2, '0')}
                        </span>
                      </button>

                      <div
                        aria-hidden="true"
                        className="flex items-center gap-1 overflow-hidden"
                      >
                        {Array.from({ length: Math.min(8, stepBeats) }).map((_, bIdx) => {
                          const isBeatLit = isActiveStep && activeBeatIdx === bIdx;
                          const isPastBeat = isActiveStep && bIdx < activeBeatIdx;
                          return (
                            <span
                              key={`led-${step.uid}-${bIdx}`}
                              className={`w-2 h-1.5 rounded-[1px] transition-transform duration-75 ${
                                isBeatLit
                                  ? 'bg-emerald-300 scale-115 shadow-[0_0_6px_rgba(110,231,183,0.9)]'
                                  : isPastBeat
                                    ? 'bg-emerald-300/50'
                                    : 'bg-white/20'
                              }`}
                            />
                          );
                        })}
                        {stepBeats > 8 && (
                          <span className="font-mono text-[9px] text-slate-400">
                            +{stepBeats - 8}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={() => onRemoveStep(step.uid)}
                      aria-label={`Remove step ${displayIdx + 1} (${chordData.symbol})`}
                      className="min-h-[34px] min-w-[34px] rounded-[2px] border border-white/14 bg-white/[0.04] hover:bg-rose-500/20 hover:border-rose-300/50 text-slate-300 hover:text-rose-200 font-mono text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      title="Remove step"
                    >
                      ×
                    </button>
                  </div>

                  {/* Clickable Chord Title & Diagram Preview */}
                  <button
                    type="button"
                    draggable={false}
                    onClick={() => {
                      if (suppressClickRef.current) return;
                      if (onPreviewStep) {
                        onPreviewStep(voicing.midiNotes, refFrequency, step.instrument, playMode);
                      }
                    }}
                    className={`text-left rounded-[2px] bg-slate-950/45 hover:bg-slate-950/65 p-2 flex flex-col gap-1.5 active:scale-[0.98] transition-[transform,background-color] ${
                      canDrag ? 'cursor-pointer sm:cursor-grab' : 'cursor-pointer'
                    }`}
                    aria-label={`Audition ${chordData.symbol} (${instMeta.shortLabel})`}
                  >
                    <div className="flex flex-col items-start gap-0.5 min-w-0">
                      <span className="font-display font-bold text-base sm:text-lg text-white leading-tight break-words">
                        {chordData.symbol}
                      </span>
                      <span className="font-mono text-[10px] text-cyan-300 uppercase truncate">
                        {instMeta.shortLabel}
                      </span>
                    </div>
                    <ChordDiagramSVG
                      voicing={voicing}
                      rootPc={chordData.rootPc}
                      labelMode={labelMode}
                      compact
                      preferFlats={chordData.preferFlats}
                      instrumentLabel={step.instrument}
                    />
                    <span className="font-mono text-[10px] text-slate-400 text-center truncate w-full">
                      {voicing?.label}
                    </span>
                  </button>

                  {/* Beats Duration Stepper */}
                  <div
                    data-no-drag="true"
                    className="flex items-center justify-between gap-1 rounded-[2px] bg-white/[0.04] border border-white/12 p-0.5"
                  >
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={() => onChangeStepBeats(step.uid, stepBeats - 1)}
                      disabled={stepBeats <= MIN_STEP_BEATS}
                      aria-label={`Decrease beats for step ${displayIdx + 1}`}
                      className="min-h-[34px] min-w-[32px] rounded-[2px] font-mono text-xs font-bold text-slate-200 hover:bg-white/[0.1] disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      −
                    </button>
                    <span className="font-mono text-[11px] font-semibold text-slate-200 tabular-nums">
                      {stepBeats} {stepBeats === 1 ? 'beat' : 'beats'}
                    </span>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={() => onChangeStepBeats(step.uid, stepBeats + 1)}
                      disabled={stepBeats >= MAX_STEP_BEATS}
                      aria-label={`Increase beats for step ${displayIdx + 1}`}
                      className="min-h-[34px] min-w-[32px] rounded-[2px] font-mono text-xs font-bold text-slate-200 hover:bg-white/[0.1] disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {/* Per-Chord Optional Rhythm Override */}
                  {onChangeStepRhythm && (
                    <div data-no-drag="true" className="relative">
                      <select
                        data-no-drag="true"
                        aria-label={`Rhythm pattern for step ${displayIdx + 1} (${chordData.symbol})`}
                        value={normalizeRhythmId(step.rhythmId, { allowInherit: true })}
                        onChange={(e) => onChangeStepRhythm(step.uid, e.target.value)}
                        className={`appearance-none w-full min-h-[34px] pl-2 pr-6 py-1 rounded-[2px] border font-mono text-[10px] font-semibold cursor-pointer focus:border-cyan-300 focus:outline-none ${
                          step.rhythmId && step.rhythmId !== 'inherit'
                            ? 'border-cyan-300/50 bg-cyan-400/12 text-cyan-100'
                            : 'border-white/12 bg-slate-950/75 text-slate-300'
                        }`}
                      >
                        <option value="inherit">Rhythm: Use Sequence</option>
                        {RHYTHM_PATTERNS.map((pat) => (
                          <option key={`step-r-${pat.id}`} value={pat.id}>
                            {pat.name} ({pat.shortCode})
                          </option>
                        ))}
                      </select>
                      <svg
                        aria-hidden="true"
                        data-smooth-svg="true"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      >
                        <path
                          d="M4 6l4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="square"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Reorder & Duplicate Controls */}
                  <div data-no-drag="true" className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={() => onMoveStep(originalIndex, originalIndex - 1)}
                      disabled={originalIndex === 0}
                      aria-label={`Move step ${displayIdx + 1} left`}
                      className="min-h-[34px] rounded-[2px] border border-white/14 bg-white/[0.04] hover:bg-white/[0.12] text-slate-200 font-mono text-xs disabled:opacity-30 cursor-pointer transition-colors"
                      title="Move earlier"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={() => onDuplicateStep(step.uid)}
                      aria-label={`Duplicate step ${displayIdx + 1}`}
                      className="min-h-[34px] rounded-[2px] border border-white/14 bg-white/[0.04] hover:bg-white/[0.12] text-slate-300 hover:text-white font-mono text-[10px] font-semibold cursor-pointer transition-colors"
                      title="Repeat chord"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      data-no-drag="true"
                      onClick={() => onMoveStep(originalIndex, originalIndex + 1)}
                      disabled={originalIndex === resolvedSteps.length - 1}
                      aria-label={`Move step ${displayIdx + 1} right`}
                      className="min-h-[34px] rounded-[2px] border border-white/14 bg-white/[0.04] hover:bg-white/[0.12] text-slate-200 font-mono text-xs disabled:opacity-30 cursor-pointer transition-colors"
                      title="Move later"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Quick-Append Saved Chords Picker */}
      {resolvedFavorites.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-slate-300">
              Tap a saved chord to append ({defaultStepBeats}{' '}
              {defaultStepBeats === 1 ? 'beat' : 'beats'} each):
            </span>
            {onQueueAllFavorites && (
              <button
                type="button"
                onClick={onQueueAllFavorites}
                className="min-h-[34px] px-2.5 py-1 rounded-[2px] border border-cyan-300/45 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-200 font-mono text-[11px] font-semibold cursor-pointer transition-colors"
              >
                + Append All ({resolvedFavorites.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar py-0.5 pr-0.5 sm:py-0 sm:pr-0">
            {resolvedFavorites.map(({ fav, chordData, instMeta }) => (
              <button
                key={`pick-${fav.id}`}
                type="button"
                onClick={() => onAddFavoriteStep && onAddFavoriteStep(fav)}
                className="min-h-[40px] px-3 py-1.5 rounded-[2px] border border-amber-300/35 bg-amber-400/10 hover:bg-amber-400/22 text-amber-100 font-mono text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 active:scale-[0.97] cursor-pointer transition-colors"
              >
                <span aria-hidden="true" className="text-cyan-300">
                  +
                </span>
                <span>{chordData.symbol}</span>
                <span className="text-[10px] text-slate-400">{instMeta.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Drag Ghost Overlay */}
      {dragUi &&
        draggedStepData &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: dragUi.cardWidth,
              height: dragUi.cardHeight,
              transform: `translate3d(${dragUi.clientX - dragUi.offsetX}px, ${
                dragUi.clientY - dragUi.offsetY
              }px, 0) scale(1.02)`,
              pointerEvents: 'none',
              zIndex: 70,
            }}
            className="rounded-[3px] p-2.5 sm:p-3 border-2 border-cyan-300 bg-slate-900/95 backdrop-blur-md shadow-[0_20px_44px_rgba(2,6,23,0.8)] flex flex-col justify-between gap-2 select-none"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-mono text-[11px] font-bold text-cyan-300 tabular-nums">
                Move → #{String(dragUi.targetDisplayIdx + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10px] text-slate-300 uppercase">
                {draggedStepData.instMeta.shortLabel}
              </span>
            </div>

            <div className="rounded-[2px] bg-slate-950/60 p-2 flex flex-col gap-1.5 flex-1 justify-center">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="font-display font-bold text-base sm:text-lg text-white truncate">
                  {draggedStepData.chordData.symbol}
                </span>
                <span className="font-mono text-[10px] text-cyan-300 tabular-nums shrink-0">
                  {clampStepBeats(draggedStepData.step.beats)}{' '}
                  {clampStepBeats(draggedStepData.step.beats) === 1 ? 'beat' : 'beats'}
                </span>
              </div>
              <ChordDiagramSVG
                voicing={draggedStepData.voicing}
                rootPc={draggedStepData.chordData.rootPc}
                labelMode={labelMode}
                compact
                preferFlats={draggedStepData.chordData.preferFlats}
                instrumentLabel={draggedStepData.step.instrument}
              />
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};

export default CustomProgressionSequencer;
