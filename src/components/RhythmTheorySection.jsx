import React, { useEffect, useMemo, useState } from 'react';
import { getChordVoicings } from '../utils/musicTheory';
import { getInstrumentMeta } from '../utils/frequencyUtils';
import { learnAudio } from '../utils/audioSynth';
import {
  RHYTHM_CATEGORIES,
  RHYTHM_GOLDEN_RULES,
  RHYTHM_SUBDIVISIONS,
  getRhythmPatternsByCategory,
} from '../utils/rhythmTheory';

const DEMO_CHORD_QUALITIES = [
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: '7', label: '7th' },
];

const STROKE_SIGNATURES = [
  {
    id: 'accent-down',
    arrow: '↓',
    code: 'D',
    name: 'Downstroke (Strong / Accent)',
    desc: 'Full sweep from thickest bass string down to thinnest treble string on main beats (1, 2, 3, 4).',
    stroke: { action: 'accent-down', velocity: 1.18, durationBeats: 2, slotIndex: 0 },
  },
  {
    id: 'up',
    arrow: '↑',
    code: 'U',
    name: 'Upstroke',
    desc: 'Lighter upward sweep across the top 3–4 treble strings on "&", "e", or "a" offbeats.',
    stroke: { action: 'up', velocity: 0.82, durationBeats: 2, slotIndex: 1 },
  },
  {
    id: 'chuck',
    arrow: '×',
    code: 'X',
    name: 'Chuck / Muted Slap',
    desc: 'Lightly touch strings with your palm edge as you brush down to create a snare-like percussive snap.',
    stroke: { action: 'chuck', velocity: 0.9, durationBeats: 0.14, slotIndex: 2 },
  },
  {
    id: 'bass',
    arrow: 'B',
    code: 'B',
    name: 'Bass Root Pluck',
    desc: 'Pick only the lowest 1–2 bass strings before answering with upper chord strums (Boom-Chick & Waltz).',
    stroke: { action: 'bass', velocity: 1.0, durationBeats: 2, slotIndex: 0 },
  },
  {
    id: 'rest',
    arrow: '·',
    code: '–',
    name: 'Ghost Stroke (Miss)',
    desc: 'Swing your wrist past the strings without touching them so your pendulum stays locked in rhythm.',
    stroke: null,
  },
];

const getSlotToneClasses = (action, isActive) => {
  if (isActive) {
    if (action === 'rest') {
      return 'bg-amber-300/25 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(252,211,77,0.35)]';
    }
    return 'bg-emerald-400 border-emerald-200 text-slate-950 shadow-[0_0_14px_rgba(52,211,153,0.45)]';
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

const getSlotGridClass = (count) => {
  if (count === 16) return 'grid grid-cols-4 sm:grid-cols-8 gap-1';
  if (count === 12) return 'grid grid-cols-3 sm:grid-cols-6 gap-1';
  if (count === 8) return 'grid grid-cols-4 sm:grid-cols-8 gap-1';
  if (count === 6) return 'grid grid-cols-3 sm:grid-cols-6 gap-1';
  if (count === 4) return 'grid grid-cols-4 gap-1';
  if (count === 3) return 'grid grid-cols-3 gap-1';
  return 'grid grid-cols-4 sm:grid-cols-8 gap-1';
};

const RhythmTheorySection = ({
  instrument = 'guitar',
  rootPc = 0,
  refFrequency = 440,
  bpm = 96,
  playMode = 'strum',
  activeSequenceRhythmId = 'single',
  onUseRhythmInSequence,
}) => {
  const [category, setCategory] = useState('All');
  const [demoQualityId, setDemoQualityId] = useState('major');
  const [withClick, setWithClick] = useState(true);
  const [activeDemo, setActiveDemo] = useState(null); // { id, slotIndex }

  const instMeta = getInstrumentMeta(instrument);

  const demoChord = useMemo(
    () => getChordVoicings(rootPc, demoQualityId, null, instrument),
    [rootPc, demoQualityId, instrument]
  );

  const demoMidiNotes = useMemo(
    () => demoChord?.voicings?.[0]?.midiNotes || [],
    [demoChord]
  );

  const visiblePatterns = useMemo(
    () => getRhythmPatternsByCategory(category, { includeSingle: false }),
    [category]
  );

  // Keep running demo synced when user tweaks BPM, root chord, instrument, or click live
  useEffect(() => {
    if (!activeDemo) return;
    learnAudio.updateRhythmDemo({
      bpm,
      midiNotes: demoMidiNotes,
      refFrequency,
      instrument,
      playMode,
      withClick,
    });
  }, [activeDemo, bpm, demoMidiNotes, refFrequency, instrument, playMode, withClick]);

  useEffect(() => {
    return () => {
      learnAudio.stopRhythmDemo();
    };
  }, []);

  const handleToggleDemo = (demoId, slots, cycleBeats, preferredBpm) => {
    if (activeDemo?.id === demoId) {
      learnAudio.stopRhythmDemo();
      setActiveDemo(null);
      return;
    }

    const demoBpm = bpm || preferredBpm || 96;
    const started = learnAudio.startRhythmDemo({
      slots,
      cycleBeats,
      bpm: demoBpm,
      midiNotes: demoMidiNotes,
      refFrequency,
      instrument,
      playMode,
      withClick,
      onSlot: ({ slotIndex }) => {
        setActiveDemo({ id: demoId, slotIndex });
      },
    });
    if (started) {
      setActiveDemo({ id: demoId, slotIndex: 0 });
    }
  };

  const handleStopDemo = () => {
    learnAudio.stopRhythmDemo();
    setActiveDemo(null);
  };

  const handleAuditionArticulation = (sig) => {
    if (!sig.stroke || demoMidiNotes.length === 0) return;
    handleStopDemo();
    if (sig.id === 'chuck') {
      learnAudio.startRhythmDemo({
        slots: [{ offsetBeats: 0, countLabel: '×', ...sig.stroke }],
        cycleBeats: 4,
        bpm: 100,
        midiNotes: demoMidiNotes,
        refFrequency,
        instrument,
        playMode: 'strum',
        withClick: false,
      });
      setTimeout(() => learnAudio.stopRhythmDemo(), 320);
      return;
    }
    const dir = sig.id === 'up' ? 'up' : sig.id === 'bass' ? 'bass' : 'down';
    learnAudio.playChordStrum(demoMidiNotes, refFrequency, instrument, {
      direction: dir,
      velocityScale: sig.stroke.velocity,
    });
  };

  return (
    <article
      aria-label="Rhythm Theory, Subdivisions, and Strumming Patterns"
      className="glass-panel rounded-[4px] p-4 sm:p-6 flex flex-col gap-5"
    >
      {/* Header + Live Audition Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg sm:text-xl text-white">
            Rhythm Theory &amp; Strumming Grooves
          </h3>
          <p className="mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
            Learn how beats subdivide, read rhythms in <span className="font-mono text-cyan-300">Down / Up</span> motion, audition any feel on <span className="font-mono text-white font-semibold">{demoChord.symbol}</span>, and send it straight to the Sequence player.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Demo Chord Quality Picker */}
          <div
            role="group"
            aria-label="Rhythm Example Chord Type"
            className="flex items-center gap-1 glass-recessed rounded-[3px] p-1"
          >
            {DEMO_CHORD_QUALITIES.map((q) => {
              const active = demoQualityId === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDemoQualityId(q.id)}
                  className={`min-h-[36px] px-2.5 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setWithClick((prev) => !prev)}
            aria-pressed={withClick}
            className={`min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              withClick
                ? 'bg-cyan-400/18 text-cyan-200 border-cyan-300/45'
                : 'bg-white/[0.05] text-slate-300 border-white/15 hover:bg-white/[0.12]'
            }`}
          >
            Click: {withClick ? 'On' : 'Off'}
          </button>

          {activeDemo && (
            <button
              type="button"
              onClick={handleStopDemo}
              className="min-h-[40px] px-3.5 py-1.5 rounded-[2px] border border-rose-300/45 bg-rose-500/25 text-rose-100 font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
            >
              Stop Demo
            </button>
          )}
        </div>
      </div>

      {/* 1. Core Rhythm Mechanics ("Up Down Up Down" & Pendulum Arm Law) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {RHYTHM_GOLDEN_RULES.map((rule) => (
          <div
            key={rule.title}
            className="glass-recessed rounded-[3px] p-3.5 border border-white/10 flex flex-col gap-1"
          >
            <div className="font-mono text-xs font-bold text-cyan-300">
              {rule.title}
            </div>
            <p className="font-sans text-xs text-slate-300 leading-relaxed">
              {rule.summary}
            </p>
          </div>
        ))}
      </div>

      {/* 2. Stroke Types Key (Tap to hear Down vs Up vs Chuck vs Bass) */}
      <div className="glass-recessed rounded-[3px] p-3.5 sm:p-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display font-bold text-sm sm:text-base text-white">
            How We Describe Strums (&ldquo;Down / Up / Chuck&rdquo;)
          </h4>
          <span className="font-mono text-[11px] text-cyan-300">
            Tap any stroke card to hear how it sounds on {demoChord.symbol} ({instMeta.shortLabel})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {STROKE_SIGNATURES.map((sig) => {
            const interactive = Boolean(sig.stroke);
            const Tag = interactive ? 'button' : 'div';
            return (
              <Tag
                key={sig.id}
                {...(interactive
                  ? {
                      type: 'button',
                      onClick: () => handleAuditionArticulation(sig),
                    }
                  : {})}
                className={`rounded-[2px] p-2.5 border text-left flex flex-col gap-1 transition-colors ${
                  interactive
                    ? 'bg-white/[0.04] hover:bg-white/[0.1] border-white/12 hover:border-cyan-300/45 cursor-pointer'
                    : 'bg-slate-950/45 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-cyan-300">
                    {sig.arrow} {sig.code}
                  </span>
                  {interactive && (
                    <span className="font-mono text-[10px] text-slate-400">
                      Hear
                    </span>
                  )}
                </div>
                <div className="font-display font-semibold text-xs text-white">
                  {sig.name}
                </div>
                <p className="font-sans text-[11px] text-slate-300 leading-snug">
                  {sig.desc}
                </p>
              </Tag>
            );
          })}
        </div>
      </div>

      {/* 3. Beat Subdivisions Interactive Lab */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display font-bold text-base text-white">
            Note Subdivisions &amp; Counting ({bpm} BPM)
          </h4>
          <span className="font-mono text-[11px] text-slate-400">
            Same steady tempo · faster subdivisions divide each beat
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RHYTHM_SUBDIVISIONS.map((sub) => {
            const demoKey = `sub-${sub.id}`;
            const isPlaying = activeDemo?.id === demoKey;
            return (
              <div
                key={sub.id}
                className={`glass-recessed rounded-[3px] p-3.5 border flex flex-col justify-between gap-2.5 ${
                  isPlaying ? 'border-emerald-300/60' : 'border-white/12'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-display font-bold text-base text-white">
                        {sub.name}
                      </span>
                      <span className="font-mono text-[11px] text-cyan-300">
                        {sub.ratioLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 font-sans text-xs text-slate-300">
                      {sub.explanation}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleToggleDemo(demoKey, sub.slots, sub.cycleBeats, bpm)
                    }
                    className={`min-h-[38px] px-3 py-1 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      isPlaying
                        ? 'bg-rose-500/25 text-rose-100 border-rose-300/50'
                        : 'bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 border-cyan-300/40'
                    }`}
                  >
                    {isPlaying ? 'Stop' : 'Hear'}
                  </button>
                </div>

                {/* Live Beat Count + Down/Up Grid */}
                <div className={getSlotGridClass(sub.slots.length)}>
                  {sub.slots.map((slot, sIdx) => {
                    const slotActive = isPlaying && activeDemo.slotIndex === sIdx;
                    return (
                      <div
                        key={`${sub.id}-slot-${sIdx}`}
                        className={`rounded-[2px] border py-1.5 px-1 flex flex-col items-center justify-center leading-tight transition-colors ${getSlotToneClasses(
                          slot.action,
                          slotActive
                        )}`}
                      >
                        <span className="font-mono text-[10px] opacity-80">
                          {slot.countLabel}
                        </span>
                        <span className="font-display font-bold text-sm">
                          {slot.arrow}
                        </span>
                        <span className="font-mono text-[10px] font-bold">
                          {slot.shortCode}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="font-mono text-[11px] text-slate-300">
                  Say it: <span className="text-cyan-200">{sub.upDownText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Different Types of Rhythms & Playable Examples */}
      <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h4 className="font-display font-bold text-base sm:text-lg text-white">
              Essential Rhythm Styles &amp; Strumming Patterns
            </h4>
            <p className="font-sans text-xs text-slate-300">
              Preview any groove on <span className="font-mono text-white font-semibold">{demoChord.symbol}</span>, or click <span className="font-mono text-cyan-300">Use in Sequence</span> to play your saved chords in that exact rhythm.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter Rhythm Categories"
            className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar py-0.5 pr-0.5 sm:py-0 sm:pr-0"
          >
            {RHYTHM_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(cat)}
                  className={`min-h-[38px] px-3 py-1 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-white/20 text-white border-white/35'
                      : 'bg-white/[0.04] text-slate-300 border-white/12 hover:bg-white/[0.1]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {visiblePatterns.map((pat) => {
            const demoKey = `pat-${pat.id}`;
            const isPlaying = activeDemo?.id === demoKey;
            const isSelectedInSeq = activeSequenceRhythmId === pat.id;

            return (
              <div
                key={pat.id}
                className={`glass-recessed rounded-[3px] p-3.5 sm:p-4 border flex flex-col justify-between gap-3 transition-colors ${
                  isPlaying
                    ? 'border-emerald-300/75 shadow-[0_0_20px_rgba(52,211,153,0.18)]'
                    : isSelectedInSeq
                      ? 'border-cyan-300/60'
                      : 'border-white/12'
                }`}
              >
                {/* Card Header */}
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h5 className="font-display font-bold text-base text-white">
                        {pat.name}
                      </h5>
                      <span className="font-mono text-[11px] text-cyan-300">
                        {pat.timeSig} · {pat.recommendedBpm} BPM · {pat.level}
                      </span>
                    </div>
                    <p className="mt-1 font-sans text-xs text-slate-300 leading-relaxed">
                      {pat.summary}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleDemo(
                          demoKey,
                          pat.slots,
                          pat.cycleBeats,
                          pat.recommendedBpm
                        )
                      }
                      aria-label={`${isPlaying ? 'Stop' : 'Play'} ${pat.name} example`}
                      className={`min-h-[38px] px-3 py-1.5 rounded-[2px] border font-mono text-[11px] sm:text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        isPlaying
                          ? 'bg-rose-500/25 text-rose-100 border-rose-300/50'
                          : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_2px_10px_rgba(34,211,238,0.24)] hover:bg-cyan-300'
                      }`}
                    >
                      {isPlaying ? 'Stop' : 'Play Example'}
                    </button>

                    {onUseRhythmInSequence && (
                      <button
                        type="button"
                        onClick={() => {
                          handleStopDemo();
                          onUseRhythmInSequence(pat);
                        }}
                        className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-[2px] border font-mono text-[11px] sm:text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          isSelectedInSeq
                            ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/50 hover:bg-emerald-400/30'
                            : 'bg-white/[0.06] text-slate-100 border-white/18 hover:bg-cyan-400/20 hover:border-cyan-300/45 hover:text-cyan-100'
                        }`}
                      >
                        {isSelectedInSeq ? (
                          'Active in Seq →'
                        ) : (
                          <>
                            <span className="sm:hidden">Use in Seq →</span>
                            <span className="hidden sm:inline">Use in Sequence →</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Beat & Strum Step Grid */}
                <div className={getSlotGridClass(pat.slots.length)}>
                  {pat.slots.map((slot, sIdx) => {
                    const slotActive = isPlaying && activeDemo.slotIndex === sIdx;
                    return (
                      <div
                        key={`${pat.id}-slot-${sIdx}`}
                        className={`rounded-[2px] border py-1.5 px-1 flex flex-col items-center justify-center leading-tight transition-colors ${getSlotToneClasses(
                          slot.action,
                          slotActive
                        )}`}
                      >
                        <span className="font-mono text-[10px] opacity-80">
                          {slot.countLabel}
                        </span>
                        <span className="font-display font-bold text-sm">
                          {slot.arrow}
                        </span>
                        <span className="font-mono text-[10px] font-bold">
                          {slot.shortCode}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Spoken "Up Down Up Down" Notation & Feel Tip */}
                <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
                  <div className="font-mono text-xs text-cyan-200">
                    <span className="text-slate-400">Pattern: </span>
                    {pat.upDownText}
                  </div>
                  <p className="font-sans text-[11px] text-slate-400 leading-snug">
                    Tip: {pat.feelTip}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
};

export default RhythmTheorySection;
