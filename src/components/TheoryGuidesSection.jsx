import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHROMATIC_NOTES,
  CIRCLE_OF_FIFTHS,
  NASHVILLE_CHARTS,
  buildNashvilleChart,
  getChordVoicings,
  getCircleOfFifthsContext,
  getInstrumentConfig,
  getNoteName,
  shouldPreferFlats,
} from '../utils/musicTheory';
import { getInstrumentMeta } from '../utils/frequencyUtils';
import { learnAudio } from '../utils/audioSynth';
import RhythmTheorySection from './RhythmTheorySection';

const THEORY_TOPICS = [
  { id: 'all', label: 'All Guides' },
  { id: 'circle', label: 'Circle of Fifths' },
  { id: 'rhythm', label: 'Rhythm & Strumming' },
  { id: 'tabs', label: 'How to Read Tabs' },
  { id: 'nashville', label: 'Nashville Numbers' },
  { id: 'fundamentals', label: 'Guitar Theory' },
];

const TAB_EXAMPLES_BY_INSTRUMENT = {
  guitar: {
    title: 'Walkup + Chord Strum + Slide Example (Standard EADGBE)',
    strings: ['e', 'B', 'G', 'D', 'A', 'E'],
    openMidiDesc: [64, 59, 55, 50, 45, 40], // high e -> low E
    steps: [
      {
        label: 'Open Root',
        caption: '0 on bottom E = pluck open low E string',
        frets: [null, null, null, null, null, '0'],
        midi: [40],
      },
      {
        label: 'Hammer-on (0h2)',
        caption: 'h = hammer fret 2 on A string without repicking',
        frets: [null, null, null, null, '0h2', null],
        midi: [45, 47],
      },
      {
        label: 'Melodic Note',
        caption: '0 on D string = open D',
        frets: [null, null, null, '0', null, null],
        midi: [50],
      },
      {
        label: 'Stacked Chord (G)',
        caption: 'Vertical column = strum all listed strings together',
        frets: ['3', '0', '0', '0', '2', '3'],
        midi: [43, 47, 50, 55, 59, 67],
      },
      {
        label: 'Slide Up (3/5)',
        caption: '/ = pick fret 3 on B string, slide smoothly to fret 5',
        frets: [null, '3/5', null, null, null, null],
        midi: [62, 64],
      },
      {
        label: 'Vibrato (3~)',
        caption: '~ = rock finger gently on fret 3 high e for sustain',
        frets: ['3~', null, null, null, null, null],
        midi: [67],
      },
    ],
  },
  bass: {
    title: 'Groove Root-Fifth + Slide Bassline (Standard E-A-D-G)',
    strings: ['G', 'D', 'A', 'E'],
    openMidiDesc: [43, 38, 33, 28],
    steps: [
      {
        label: 'Root (G)',
        caption: '3 on bottom E string = G root',
        frets: [null, null, null, '3'],
        midi: [31],
      },
      {
        label: 'Muted Ghost (x)',
        caption: 'x = rest fretting hand lightly for percussive click',
        frets: [null, null, null, 'x'],
        midi: [31],
      },
      {
        label: 'Fifth (D)',
        caption: '5 on A string = D (the 5th degree)',
        frets: [null, null, '5', null],
        midi: [38],
      },
      {
        label: 'Octave (G)',
        caption: '5 on D string = G octave (2 strings up, 2 frets up)',
        frets: [null, '5', null, null],
        midi: [43],
      },
      {
        label: 'Hammer-on (5h7)',
        caption: 'h = fret 5 hammered cleanly up to fret 7 on G',
        frets: ['5h7', null, null, null],
        midi: [48, 50],
      },
      {
        label: 'Slide Down (7\\5)',
        caption: '\\ = slide finger smoothly down from fret 7 to 5',
        frets: ['7\\5', null, null, null],
        midi: [50, 48],
      },
    ],
  },
  ukulele: {
    title: 'Island Melody + C Major Chord Tab (High-G C-E-A)',
    strings: ['A', 'E', 'C', 'G'],
    openMidiDesc: [69, 64, 60, 67],
    steps: [
      {
        label: 'Open C',
        caption: '0 on C string = open middle C',
        frets: [null, null, '0', null],
        midi: [60],
      },
      {
        label: 'Hammer-on (0h2)',
        caption: 'h = hammer fret 2 on C string',
        frets: [null, null, '0h2', null],
        midi: [60, 62],
      },
      {
        label: 'Open E',
        caption: '0 on E string = open E',
        frets: [null, '0', null, null],
        midi: [64],
      },
      {
        label: 'Stacked C Chord',
        caption: 'Vertical column = strum 0-0-0-3 together',
        frets: ['3', '0', '0', '0'],
        midi: [67, 60, 64, 72],
      },
      {
        label: 'Slide (3/7)',
        caption: '/ = pick fret 3 on A string and slide up to fret 7',
        frets: ['3/7', null, null, null],
        midi: [72, 76],
      },
      {
        label: 'Vibrato (7~)',
        caption: '~ = gentle finger vibrato on fret 7',
        frets: ['7~', null, null, null],
        midi: [76],
      },
    ],
  },
};

const TAB_SYMBOLS = [
  {
    symbol: '0 / 3',
    name: 'Open / Fret Number',
    meaning: '0 plays the string open; any number tells you which fret to press behind the metal wire.',
    demoMidi: [64, 67],
  },
  {
    symbol: 'h',
    name: 'Hammer-On (5h7)',
    meaning: 'Pick the first note (5), then forcefully tap down the next finger onto fret 7 without picking again.',
    demoMidi: [67, 69],
  },
  {
    symbol: 'p',
    name: 'Pull-Off (7p5)',
    meaning: 'With both fingers planted, pick fret 7 then flick/pull off cleanly so fret 5 rings out.',
    demoMidi: [69, 67],
  },
  {
    symbol: '/  \\',
    name: 'Slide Up / Down (5/7)',
    meaning: 'Maintain pressure while gliding your finger up (/) or down (\\) to the target fret.',
    demoMidi: [62, 66],
  },
  {
    symbol: 'b  r',
    name: 'Bend & Release (7b9r7)',
    meaning: 'Push the string across the fretboard until pitch matches fret 9 (+2 frets), then lower back (r).',
    demoMidi: [67, 69, 67],
  },
  {
    symbol: '~ / x',
    name: 'Vibrato & Dead Mute',
    meaning: 'Wiggle pitch gently for singing sustain (~), or lightly touch string without fretting for a rhythmic percussive click (x).',
    demoMidi: [71],
  },
];

const NASHVILLE_DECODER = [
  {
    token: '1  4  5',
    title: 'Plain Numbers = Major Chords',
    detail: 'Built on the 1st, 4th, and 5th notes of the Major scale (e.g., in G: 1 = G, 4 = C, 5 = D).',
  },
  {
    token: '2m  3m  6m',
    title: '"m" or "-" = Minor Chords',
    detail: '2, 3, and 6 are naturally minor in a Major key (in G: 2m = Am, 3m = Bm, 6m = Em).',
  },
  {
    token: '1/3  5/7',
    title: 'Slash = Chord Over Bass Note',
    detail: 'Chord number before "/", bass scale-degree after "/" (in G: 1/3 = G/B, 5/7 = D/F#).',
  },
  {
    token: '4  5 (Split)',
    title: 'Underlined = Split Bar',
    detail: 'Two underlined numbers share a single 4/4 measure (2 beats each instead of 4).',
  },
  {
    token: '◇  (Diamond)',
    title: 'Diamond = Hold / Ring Out',
    detail: 'Strum once on beat 1 and let the chord sustain across the entire bar.',
  },
  {
    token: '^  /  *',
    title: 'Push (^) & Choke (*)',
    detail: '^ anticipates the next bar by a half-beat (syncopation); * hits and mutes immediately.',
  },
];

const CHORD_FORMULAS = [
  {
    id: 'major',
    label: 'Major Triad',
    formula: '1 – 3 – 5',
    semitones: '0 · +4 · +7 st',
    mood: 'Bright, settled, consonant home base.',
  },
  {
    id: 'minor',
    label: 'Minor Triad',
    formula: '1 – b3 – 5',
    semitones: '0 · +3 · +7 st',
    mood: 'Lower the 3rd by 1 fret for moody or reflective warmth.',
  },
  {
    id: '5',
    label: 'Power Chord (5)',
    formula: '1 – 5',
    semitones: '0 · +7 st',
    mood: 'No 3rd means neither major nor minor — cuts cleanly with distortion.',
  },
  {
    id: 'sus4',
    label: 'Suspended 4th',
    formula: '1 – 4 – 5',
    semitones: '0 · +5 · +7 st',
    mood: 'Replaces the 3rd with the 4th, creating tension wanting to resolve to 3.',
  },
  {
    id: '7',
    label: 'Dominant 7th',
    formula: '1 – 3 – 5 – b7',
    semitones: '0 · +4 · +7 · +10 st',
    mood: 'Tritone between 3 and b7 pulls strongly back to the 1 chord (V7 → I).',
  },
  {
    id: 'maj7',
    label: 'Major 7th',
    formula: '1 – 3 – 5 – 7',
    semitones: '0 · +4 · +7 · +11 st',
    mood: 'Dreamy, lush jazz & neo-soul color adding the natural 7th.',
  },
  {
    id: 'dim',
    label: 'Diminished Triad',
    formula: '1 – b3 – b5',
    semitones: '0 · +3 · +6 st',
    mood: 'Stacked minor 3rds create suspense that naturally pulls up a half-step.',
  },
];

const CAGED_SHAPES = [
  {
    letter: 'C',
    title: 'C-Shape (Root on A & B Strings)',
    rootStrings: '5A string + 2B string',
    barreRule: 'Play an open C with fingers 2–3–4 and bar behind with finger 1 (e.g., Fret 3 on A = C; Fret 5 = D).',
    nextLetter: 'A',
    rootOffsets: [0, 3, 2, 0, 1, 0],
  },
  {
    letter: 'A',
    title: 'A-Shape (Root on A & G Strings)',
    rootStrings: '5A string + 3G string (+2 frets)',
    barreRule: 'Most common rock & pop barre chord: index finger bars A-string root, ring finger covers D–G–B 2 frets higher.',
    nextLetter: 'G',
    rootOffsets: [-1, 0, 2, 2, 2, 0],
  },
  {
    letter: 'G',
    title: 'G-Shape (Root on Low E, G & High e)',
    rootStrings: '6E string + 3G string + 1e string',
    barreRule: 'Great for country/hendrix chord embellishments and finding melodic double-stops up the neck.',
    nextLetter: 'E',
    rootOffsets: [3, 2, 0, 0, 0, 3],
  },
  {
    letter: 'E',
    title: 'E-Shape (Root on Low E, D & High e)',
    rootStrings: '6E string + 4D string (+2 frets) + 1e',
    barreRule: 'The classic F-major / full 6-string barre shape. Move your low-E root to any fret to play every Major or Minor chord.',
    nextLetter: 'D',
    rootOffsets: [0, 2, 2, 1, 0, 0],
  },
  {
    letter: 'D',
    title: 'D-Shape (Root on D & B Strings)',
    rootStrings: '4D string + 2B string (+3 frets)',
    barreRule: 'Bright upper-register triad shape great for cutting through a mix alongside a bass or rhythm guitar.',
    nextLetter: 'C',
    rootOffsets: [-1, -1, 0, 2, 3, 2],
  },
];

const MODE_CHEATSHEET = [
  { id: 'major', name: 'Ionian (Major)', degree: '1', colorNote: 'Natural 4 & 7', vibe: 'Bright, classic, resolved' },
  { id: 'dorian', name: 'Dorian', degree: '2', colorNote: 'b3, natural 6, b7', vibe: 'Funky, soulful minor (Santana / Miles)' },
  { id: 'phrygian', name: 'Phrygian', degree: '3', colorNote: 'b2, b3, b6, b7', vibe: 'Exotic Spanish / metal tension' },
  { id: 'lydian', name: 'Lydian', degree: '4', colorNote: '#4 (bright tritone)', vibe: 'Floating, cinematic film-score lift' },
  { id: 'mixolydian', name: 'Mixolydian', degree: '5', colorNote: 'Natural 3 + b7', vibe: 'Classic rock, blues-rock & jam groove' },
  { id: 'natural_minor', name: 'Aeolian (Rel. Minor)', degree: '6', colorNote: 'b3, b6, b7', vibe: 'Emotional natural minor home base' },
];

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeAnnularSector = (cx, cy, innerR, outerR, startDeg, endDeg) => {
  const p1 = polarToCartesian(cx, cy, outerR, endDeg);
  const p2 = polarToCartesian(cx, cy, outerR, startDeg);
  const p3 = polarToCartesian(cx, cy, innerR, startDeg);
  const p4 = polarToCartesian(cx, cy, innerR, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
};

const TheoryGuidesSection = ({
  instrument = 'guitar',
  rootPc = 0,
  refFrequency = 440,
  bpm = 96,
  playMode = 'strum',
  topicFilter: controlledTopicFilter,
  onTopicFilterChange,
  activeSequenceRhythmId = 'single',
  onUseRhythmInSequence,
  onSelectRoot,
  onNavigateTab,
}) => {
  const [internalTopicFilter, setInternalTopicFilter] = useState('all');
  const topicFilter = controlledTopicFilter !== undefined ? controlledTopicFilter : internalTopicFilter;
  const setTopicFilter = (nextTopic) => {
    if (onTopicFilterChange) {
      onTopicFilterChange(nextTopic);
    } else {
      setInternalTopicFilter(nextTopic);
    }
  };
  const [theorySubTab, setTheorySubTab] = useState('fretboard');
  const [nashvilleChartId, setNashvilleChartId] = useState('pop_anthem');
  const [selectedCagedLetter, setSelectedCagedLetter] = useState('E');
  const [activeTabStepIdx, setActiveTabStepIdx] = useState(null);
  const [isPlayingTabExample, setIsPlayingTabExample] = useState(false);
  const [activeNnsBarIdx, setActiveNnsBarIdx] = useState(null);
  const [activeCofScaleIdx, setActiveCofScaleIdx] = useState(null);

  const timersRef = useRef([]);
  const instMeta = getInstrumentMeta(instrument);
  const instConfig = getInstrumentConfig(instrument);
  const preferFlats = shouldPreferFlats(rootPc);
  const selectedRootName = getNoteName(rootPc, preferFlats);

  const circleCtx = useMemo(
    () => getCircleOfFifthsContext(rootPc, instrument),
    [rootPc, instrument]
  );

  const nashvilleChart = useMemo(
    () => buildNashvilleChart(rootPc, nashvilleChartId, instrument),
    [rootPc, nashvilleChartId, instrument]
  );

  const tabExample = useMemo(
    () => TAB_EXAMPLES_BY_INSTRUMENT[instrument] || TAB_EXAMPLES_BY_INSTRUMENT.guitar,
    [instrument]
  );

  const majorScaleSteps = useMemo(() => {
    const intervals = [0, 2, 4, 5, 7, 9, 11];
    const stepTags = ['W', 'W', 'H', 'W', 'W', 'W', 'H'];
    return intervals.map((semi, idx) => {
      const pc = (rootPc + semi) % 12;
      return {
        degree: idx + 1,
        pc,
        name: getNoteName(pc, preferFlats),
        midi: instConfig.scaleOctaveBase + rootPc + semi,
        nextStep: stepTags[idx],
      };
    });
  }, [rootPc, preferFlats, instConfig.scaleOctaveBase]);

  const clearScheduledTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearScheduledTimers();
    };
  }, []);

  useEffect(() => {
    clearScheduledTimers();
    setIsPlayingTabExample(false);
    setActiveTabStepIdx(null);
    setActiveNnsBarIdx(null);
    setActiveCofScaleIdx(null);
  }, [instrument, rootPc, nashvilleChartId]);

  const handlePlayTabExample = () => {
    if (isPlayingTabExample) {
      clearScheduledTimers();
      learnAudio.stopAll();
      setIsPlayingTabExample(false);
      setActiveTabStepIdx(null);
      return;
    }

    clearScheduledTimers();
    learnAudio.stopAll();
    setActiveNnsBarIdx(null);
    setActiveCofScaleIdx(null);
    setIsPlayingTabExample(true);

    tabExample.steps.forEach((step, idx) => {
      const tId = setTimeout(() => {
        setActiveTabStepIdx(idx);
        if (step.midi.length > 2) {
          learnAudio.playChord(step.midi, refFrequency, instrument, 'strum');
        } else if (step.midi.length === 2) {
          learnAudio.playSequence(step.midi, refFrequency, 180, null, null, instrument);
        } else if (step.midi.length === 1) {
          learnAudio.playPluckedNote(step.midi[0], refFrequency, 0, null, 0.58, instrument);
        }
      }, idx * 620);
      timersRef.current.push(tId);
    });

    const endId = setTimeout(() => {
      setIsPlayingTabExample(false);
      setActiveTabStepIdx(null);
    }, tabExample.steps.length * 620 + 200);
    timersRef.current.push(endId);
  };

  const handlePlayNashvilleChart = () => {
    if (activeNnsBarIdx !== null) {
      clearScheduledTimers();
      learnAudio.stopAll();
      setActiveNnsBarIdx(null);
      return;
    }

    clearScheduledTimers();
    setIsPlayingTabExample(false);
    setActiveTabStepIdx(null);
    setActiveCofScaleIdx(null);

    const playableChords = nashvilleChart.bars.map((b) => b.chordData);
    setActiveNnsBarIdx(0);
    learnAudio.playProgression(
      playableChords,
      refFrequency,
      900,
      (idx) => setActiveNnsBarIdx(idx),
      () => setActiveNnsBarIdx(null),
      instrument,
      playMode
    );
  };

  const handlePlayFullOctaveScale = () => {
    if (activeCofScaleIdx !== null) {
      clearScheduledTimers();
      learnAudio.stopAll();
      setActiveCofScaleIdx(null);
      return;
    }

    clearScheduledTimers();
    learnAudio.stopAll();
    setIsPlayingTabExample(false);
    setActiveTabStepIdx(null);
    setActiveNnsBarIdx(null);

    const midiSequence = circleCtx.fullOctaveScale.map((n) => n.midi);
    learnAudio.playSequence(
      midiSequence,
      refFrequency,
      300,
      (idx) => setActiveCofScaleIdx(idx),
      () => setActiveCofScaleIdx(null),
      instrument
    );
  };

  const showSection = (id) => topicFilter === 'all' || topicFilter === id;

  return (
    <section aria-label="Music Theory, Tabs, Circle of Fifths, and Nashville Numbers" className="flex flex-col gap-5">
      {/* Sub-Navigation Filter */}
      <div className="glass-panel rounded-[4px] p-3.5 sm:p-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display font-bold text-base sm:text-lg text-white">
            Theory, Tabs &amp; Studio Guides
          </h2>
          <p className="font-sans text-xs text-slate-300">
            Synced to <span className="font-mono text-cyan-300 font-semibold">{selectedRootName}</span> · {instMeta.label}
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter Theory Guide Topics"
          className="flex items-center gap-1.5 overflow-x-auto lg:overflow-visible lg:grid lg:grid-cols-6 no-scrollbar py-0.5 pr-0.5 lg:py-0 lg:pr-0"
        >
          {THEORY_TOPICS.map((topic) => {
            const active = topicFilter === topic.id;
            return (
              <button
                key={topic.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTopicFilter(topic.id)}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-[2px] border font-mono text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                  active
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_2px_12px_rgba(34,211,238,0.28)]'
                    : 'bg-white/[0.05] text-slate-300 border-white/12 hover:bg-white/[0.12] hover:text-white'
                }`}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. INTERACTIVE CIRCLE OF FIFTHS */}
      {showSection('circle') && (
        <article
          aria-label="Interactive Circle of Fifths"
          className="glass-panel rounded-[4px] p-4 sm:p-6 flex flex-col gap-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-white">
                Interactive Circle of Fifths
              </h3>
              <p className="mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
                Tap any wedge to transpose the app, hear its tonic chord, and map out neighboring IV, V, and Relative Minor chords.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] shrink-0">
              <span className="text-cyan-300 font-semibold">■ I Tonic</span>
              <span className="text-emerald-300 font-semibold">■ IV Subdominant (-1 step)</span>
              <span className="text-amber-300 font-semibold">■ V Dominant (+1 step)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,420px)_1fr] gap-5 items-center">
            {/* Left Interactive Wheel */}
            <div className="glass-recessed rounded-[3px] p-3 sm:p-4 flex flex-col items-center gap-2">
              <div className="w-full flex items-center justify-between font-mono text-[11px] text-slate-400 px-1">
                <span>← Counter-Clockwise (+♭ / IV)</span>
                <span>Clockwise (+♯ / V) →</span>
              </div>

              <svg
                viewBox="0 0 360 360"
                data-smooth-svg="true"
                className="w-full max-w-[360px] h-auto select-none"
                role="img"
                aria-label={`Circle of Fifths wheel centered on ${circleCtx.entry.majorLabel} Major`}
              >
                {CIRCLE_OF_FIFTHS.map((node, idx) => {
                  const startDeg = idx * 30 - 15;
                  const endDeg = idx * 30 + 15;
                  const midDeg = idx * 30;
                  const isActive = idx === circleCtx.activeIdx;
                  const isIV = idx === circleCtx.subdominantIdx;
                  const isV = idx === circleCtx.dominantIdx;

                  let outerFill = 'rgba(255,255,255,0.05)';
                  let outerStroke = 'rgba(255,255,255,0.14)';
                  let outerTextFill = '#e2e8f0';

                  if (isActive) {
                    outerFill = 'rgba(34,211,238,0.88)';
                    outerStroke = '#67e8f9';
                    outerTextFill = '#020617';
                  } else if (isIV) {
                    outerFill = 'rgba(52,211,153,0.24)';
                    outerStroke = 'rgba(110,231,183,0.75)';
                    outerTextFill = '#a7f3d0';
                  } else if (isV) {
                    outerFill = 'rgba(251,191,36,0.24)';
                    outerStroke = 'rgba(252,211,77,0.75)';
                    outerTextFill = '#fde68a';
                  }

                  const innerFill = isActive
                    ? 'rgba(34,211,238,0.28)'
                    : 'rgba(15,23,42,0.55)';
                  const innerTextFill = isActive ? '#a5f3fc' : '#94a3b8';

                  const majorPos = polarToCartesian(180, 180, 134, midDeg);
                  const sigPos = polarToCartesian(180, 180, 157, midDeg);
                  const minorPos = polarToCartesian(180, 180, 86, midDeg);
                  const sigText =
                    node.accidentalsCount === 0
                      ? '0'
                      : node.accidentalType === 'sharp'
                        ? `${node.accidentalsCount}♯`
                        : node.accidentalType === 'flat'
                          ? `${node.accidentalsCount}♭`
                          : '6♯/♭';

                  return (
                    <g key={node.position}>
                      {/* Outer Major Wedge */}
                      <path
                        d={describeAnnularSector(180, 180, 108, 170, startDeg, endDeg)}
                        fill={outerFill}
                        stroke={outerStroke}
                        strokeWidth={isActive || isIV || isV ? 1.8 : 1}
                        className="cursor-pointer transition-opacity hover:opacity-90"
                        onClick={() => {
                          if (onSelectRoot) onSelectRoot(node.rootPc);
                          const chord = getChordVoicings(
                            node.rootPc,
                            'major',
                            node.preferFlats,
                            instrument
                          );
                          if (chord.voicings[0]) {
                            learnAudio.playChord(
                              chord.voicings[0].midiNotes,
                              refFrequency,
                              instrument,
                              playMode
                            );
                          }
                        }}
                      />
                      <text
                        x={majorPos.x}
                        y={majorPos.y + 4}
                        textAnchor="middle"
                        fontSize={node.majorLabel.length > 3 ? '11' : '14'}
                        fontWeight="700"
                        fill={outerTextFill}
                        className="pointer-events-none font-display"
                      >
                        {node.majorLabel}
                      </text>
                      <text
                        x={sigPos.x}
                        y={sigPos.y + 3}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="600"
                        fill={isActive ? '#0f172a' : '#94a3b8'}
                        className="pointer-events-none font-mono"
                      >
                        {sigText}
                      </text>

                      {/* Inner Relative Minor Wedge */}
                      <path
                        d={describeAnnularSector(180, 180, 62, 108, startDeg, endDeg)}
                        fill={innerFill}
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="1"
                        className="cursor-pointer transition-opacity hover:opacity-90"
                        onClick={() => {
                          if (onSelectRoot) onSelectRoot(node.rootPc);
                          const chord = getChordVoicings(
                            node.relMinorPc,
                            'minor',
                            node.preferFlats,
                            instrument
                          );
                          if (chord.voicings[0]) {
                            learnAudio.playChord(
                              chord.voicings[0].midiNotes,
                              refFrequency,
                              instrument,
                              playMode
                            );
                          }
                        }}
                      />
                      <text
                        x={minorPos.x}
                        y={minorPos.y + 3.5}
                        textAnchor="middle"
                        fontSize={node.relMinorLabel.length > 4 ? '7.5' : '9.5'}
                        fontWeight="600"
                        fill={innerTextFill}
                        className="pointer-events-none font-mono"
                      >
                        {node.relMinorLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Center Hub */}
                <circle
                  cx="180"
                  cy="180"
                  r="56"
                  fill="rgba(12,20,38,0.92)"
                  stroke="rgba(34,211,238,0.45)"
                  strokeWidth="1.5"
                />
                <text
                  x="180"
                  y="168"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#67e8f9"
                  className="font-mono"
                >
                  ACTIVE KEY
                </text>
                <text
                  x="180"
                  y="190"
                  textAnchor="middle"
                  fontSize="18"
                  fontWeight="700"
                  fill="#ffffff"
                  className="font-display"
                >
                  {circleCtx.entry.majorLabel}
                </text>
                <text
                  x="180"
                  y="207"
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="#94a3b8"
                  className="font-mono"
                >
                  Rel: {circleCtx.entry.relMinorLabel}
                </text>
              </svg>
            </div>

            {/* Right Key Inspector & Practical Rules */}
            <div className="flex flex-col gap-3.5">
              <div className="glass-recessed rounded-[3px] p-3.5 flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display font-bold text-lg text-white">
                    {circleCtx.entry.majorLabel} Major / {circleCtx.entry.relMinorLabel}
                  </span>
                  <span className="font-mono text-xs text-cyan-300 font-semibold">
                    {circleCtx.entry.signatureLabel}
                  </span>
                </div>
                <p className="font-sans text-xs text-slate-400">
                  Diatonic IV–I–V–vi neighbor chords for {circleCtx.entry.majorLabel} Major and full 8-note octave scale below.
                </p>
              </div>

              {/* Closest Chord Neighbors: IV - I - V - vi */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {circleCtx.primaryChords.map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => {
                      if (item.chord.voicings[0]) {
                        learnAudio.playChord(
                          item.chord.voicings[0].midiNotes,
                          refFrequency,
                          instrument,
                          playMode
                        );
                      }
                    }}
                    className="min-h-[72px] p-2.5 rounded-[3px] glass-recessed hover:bg-white/[0.1] border border-white/12 flex flex-col items-start justify-between gap-1 text-left active:scale-[0.97] cursor-pointer transition-colors"
                  >
                    <span className="font-mono text-[10px] text-cyan-300 font-semibold">
                      {item.role}
                    </span>
                    <span className="font-display font-bold text-lg text-white">
                      {item.chord.symbol}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      NNS #{item.num} · Tap to hear
                    </span>
                  </button>
                ))}
              </div>

              <div className="glass-recessed rounded-[3px] p-3.5 flex flex-col gap-1.5 font-sans text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong className="text-white">1. Instant Songwriting Compass:</strong> Pick any key (<span className="font-mono text-white font-semibold">I</span>). Its neighbor counter-clockwise is <span className="text-emerald-300 font-semibold">IV ({circleCtx.ivEntry.majorLabel})</span>, clockwise is <span className="text-amber-300 font-semibold">V ({circleCtx.vEntry.majorLabel})</span>, and inner ring is <span className="text-cyan-300 font-semibold">vi ({circleCtx.entry.relMinorLabel})</span>.
                </p>
                <p>
                  <strong className="text-white">2. Memorize Key Signatures:</strong> Moving clockwise adds 1 sharp in order (<span className="font-mono text-slate-200">F–C–G–D–A–E–B</span>). Moving counter-clockwise adds 1 flat (<span className="font-mono text-slate-200">B–E–A–D–G–C–F</span>).
                </p>
                <p>
                  <strong className="text-white">3. Smooth Key Changes:</strong> Adjacent keys on the wheel share 6 out of 7 notes, making modulations sound seamless.
                </p>
              </div>

              {onNavigateTab && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('chords')}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-[2px] border border-cyan-300/40 bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-200 font-mono text-xs font-semibold cursor-pointer transition-colors"
                  >
                    View {circleCtx.entry.majorLabel} Chords
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('scales')}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-[2px] border border-white/15 bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 font-mono text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Open {circleCtx.entry.majorLabel} Scale Fretboard
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Full 8-Note Major Scale (Including Next Octave) Directly Under Circle of Fifths */}
          <div
            aria-label={`Full ${circleCtx.entry.majorLabel} Major Scale to Next Octave`}
            className="glass-recessed rounded-[3px] p-3.5 sm:p-4 flex flex-col gap-3 border border-white/10"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-display font-bold text-sm sm:text-base text-white">
                  Full {circleCtx.entry.majorLabel} Major Scale (to Next Octave):{' '}
                  <span className="font-mono text-cyan-300">
                    {circleCtx.fullOctaveScale
                      .map((n) => (n.isOctave ? `${n.name} (next octave)` : n.name))
                      .join(', ')}
                  </span>
                </div>
                <p className="mt-0.5 font-sans text-xs text-slate-400">
                  Formula W–W–H–W–W–W–H completes at degree 8 one full octave (+12 semitones) above the root. Tap any note to hear it.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePlayFullOctaveScale}
                className={`min-h-[40px] px-4 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  activeCofScaleIdx !== null
                    ? 'bg-rose-500/25 text-rose-100 border-rose-300/45'
                    : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_3px_14px_rgba(34,211,238,0.26)]'
                }`}
              >
                {activeCofScaleIdx !== null ? 'Stop Scale' : 'Play Full Scale ↑'}
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {circleCtx.fullOctaveScale.map((n, idx) => {
                const isActive = activeCofScaleIdx === idx;
                return (
                  <button
                    key={`cof-full-scale-${n.degree}`}
                    type="button"
                    onClick={() =>
                      learnAudio.playPluckedNote(
                        n.midi,
                        refFrequency,
                        0,
                        null,
                        0.58,
                        instrument
                      )
                    }
                    className={`min-h-[66px] p-2 rounded-[2px] border flex flex-col items-center justify-center gap-0.5 active:scale-[0.97] cursor-pointer transition-all ${
                      isActive
                        ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.45)]'
                        : n.isOctave || n.degree === 1
                          ? 'bg-cyan-400/15 hover:bg-cyan-400/25 border-cyan-300/45 text-white'
                          : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/12 text-white'
                    }`}
                  >
                    <span
                      className={`font-mono text-[10px] font-semibold ${
                        isActive ? 'text-slate-900' : 'text-cyan-300'
                      }`}
                    >
                      {n.isOctave ? '8 (8ve)' : `Deg ${n.degree}`}
                    </span>
                    <span className="font-display font-bold text-lg leading-tight">
                      {n.name}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        isActive
                          ? 'text-slate-900 font-semibold'
                          : n.isOctave
                            ? 'text-cyan-200 font-semibold'
                            : 'text-amber-300'
                      }`}
                    >
                      {n.isOctave ? (
                        <>
                          <span className="sm:hidden">Next 8ve</span>
                          <span className="hidden sm:inline">Next Octave</span>
                        </>
                      ) : (
                        `step: ${n.stepLabel}`
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </article>
      )}

      {/* 2. RHYTHM THEORY, SUBDIVISIONS & STRUMMING PATTERNS */}
      {showSection('rhythm') && (
        <RhythmTheorySection
          instrument={instrument}
          rootPc={rootPc}
          refFrequency={refFrequency}
          bpm={bpm}
          playMode={playMode}
          activeSequenceRhythmId={activeSequenceRhythmId}
          onUseRhythmInSequence={onUseRhythmInSequence}
        />
      )}

      {/* 3. HOW TO READ TABS */}
      {showSection('tabs') && (
        <article
          aria-label="How to Read Guitar, Bass, and Ukulele Tabs"
          className="glass-panel rounded-[4px] p-4 sm:p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-white">
                How to Read {instMeta.label} Tabs (Tablature)
              </h3>
              <p className="mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
                Unlike standard sheet music, TAB draws your instrument&apos;s strings horizontally as viewed looking down at your lap.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePlayTabExample}
              className={`min-h-[42px] px-4 py-2 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                isPlayingTabExample
                  ? 'bg-rose-500/25 text-rose-100 border-rose-300/45'
                  : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
              }`}
            >
              {isPlayingTabExample ? 'Stop TAB Demo' : 'Play Example TAB'}
            </button>
          </div>

          {/* 4 Core Rules of Tablature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="glass-recessed rounded-[3px] p-3">
              <div className="font-mono text-xs font-bold text-cyan-300">
                01. Top Line = Thinnest String
              </div>
              <p className="mt-1 font-sans text-xs text-slate-300">
                The top line is the highest-pitched string ({tabExample.strings[0]}); the bottom line is the thickest string ({tabExample.strings[tabExample.strings.length - 1]}).
              </p>
            </div>
            <div className="glass-recessed rounded-[3px] p-3">
              <div className="font-mono text-xs font-bold text-cyan-300">
                02. Numbers = Frets
              </div>
              <p className="mt-1 font-sans text-xs text-slate-300">
                <span className="font-mono text-white font-semibold">0</span> = open string, <span className="font-mono text-white font-semibold">3</span> = 3rd fret. Numbers tell you where to press, not which finger to use.
              </p>
            </div>
            <div className="glass-recessed rounded-[3px] p-3">
              <div className="font-mono text-xs font-bold text-cyan-300">
                03. Left → Right = Melody
              </div>
              <p className="mt-1 font-sans text-xs text-slate-300">
                Read horizontally from left to right. Notes placed one after another are picked one by one.
              </p>
            </div>
            <div className="glass-recessed rounded-[3px] p-3">
              <div className="font-mono text-xs font-bold text-cyan-300">
                04. Stacked = Strum Chord
              </div>
              <p className="mt-1 font-sans text-xs text-slate-300">
                Numbers lined up vertically in the same column are strummed or plucked at the exact same moment.
              </p>
            </div>
          </div>

          {/* Interactive Playable TAB Staff */}
          <div className="glass-recessed rounded-[3px] p-3.5 sm:p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-white">
                {tabExample.title}
              </span>
              <span className="font-mono text-[11px] text-cyan-300">
                Tap any column below to play that step
              </span>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="min-w-[560px] grid grid-cols-[52px_repeat(6,minmax(0,1fr))] gap-1 items-stretch">
                {/* String Labels Column */}
                <div className="flex flex-col justify-between py-2 pr-2 border-r-2 border-white/25">
                  {tabExample.strings.map((sLabel, sIdx) => (
                    <div
                      key={`tab-str-${sLabel}-${sIdx}`}
                      className="h-7 flex items-center justify-end font-mono text-xs font-bold text-cyan-300"
                    >
                      {sLabel} |
                    </div>
                  ))}
                  <div className="h-6 flex items-center justify-end font-mono text-[10px] text-slate-400">
                    STEP
                  </div>
                </div>

                {/* Clickable TAB Columns */}
                {tabExample.steps.map((step, colIdx) => {
                  const isActive = activeTabStepIdx === colIdx;
                  return (
                    <button
                      key={`tab-col-${colIdx}`}
                      type="button"
                      onClick={() => {
                        setActiveTabStepIdx(colIdx);
                        if (step.midi.length > 2) {
                          learnAudio.playChord(step.midi, refFrequency, instrument, 'strum');
                        } else if (step.midi.length === 2) {
                          learnAudio.playSequence(step.midi, refFrequency, 180, null, null, instrument);
                        } else if (step.midi.length === 1) {
                          learnAudio.playPluckedNote(
                            step.midi[0],
                            refFrequency,
                            0,
                            null,
                            0.58,
                            instrument
                          );
                        }
                      }}
                      className={`rounded-[2px] py-2 px-1 flex flex-col justify-between transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-400/20 ring-1 ring-emerald-300/75'
                          : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      {step.frets.map((val, rowIdx) => (
                        <div
                          key={`cell-${colIdx}-${rowIdx}`}
                          className="relative h-7 flex items-center justify-center"
                        >
                          <div
                            aria-hidden="true"
                            className="absolute inset-x-0 h-[1.5px] bg-white/20"
                          />
                          {val !== null && (
                            <span
                              className={`relative z-10 px-1.5 py-0.5 rounded-[2px] font-mono text-xs font-bold ${
                                isActive
                                  ? 'bg-emerald-400 text-slate-950'
                                  : 'bg-[#0f172a] text-white border border-white/20'
                              }`}
                            >
                              {val}
                            </span>
                          )}
                        </div>
                      ))}
                      <span
                        className={`h-6 flex items-center justify-center font-mono text-[10px] font-semibold truncate px-1 ${
                          isActive ? 'text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTabStepIdx !== null && tabExample.steps[activeTabStepIdx] && (
              <div className="rounded-[2px] bg-white/[0.05] border border-cyan-300/30 px-3 py-2 font-mono text-xs text-cyan-200">
                Step {activeTabStepIdx + 1} ({tabExample.steps[activeTabStepIdx].label}):{' '}
                <span className="text-slate-200 font-sans">
                  {tabExample.steps[activeTabStepIdx].caption}
                </span>
              </div>
            )}
          </div>

          {/* Essential TAB Symbols Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {TAB_SYMBOLS.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => {
                  if (item.demoMidi.length > 1) {
                    learnAudio.playSequence(item.demoMidi, refFrequency, 175, null, null, instrument);
                  } else {
                    learnAudio.playPluckedNote(item.demoMidi[0], refFrequency, 0, null, 0.55, instrument);
                  }
                }}
                className="glass-recessed rounded-[3px] p-3 border border-white/10 hover:border-cyan-300/40 hover:bg-white/[0.06] text-left flex flex-col gap-1 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-cyan-300">
                    {item.symbol}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">Tap to hear</span>
                </div>
                <div className="font-display font-semibold text-sm text-white">
                  {item.name}
                </div>
                <p className="font-sans text-xs text-slate-300 leading-relaxed">
                  {item.meaning}
                </p>
              </button>
            ))}
          </div>
        </article>
      )}

      {/* 3. HOW THE NASHVILLE NUMBER SYSTEM WORKS */}
      {showSection('nashville') && (
        <article
          aria-label="How the Nashville Number System Works"
          className="glass-panel rounded-[4px] p-4 sm:p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-white">
                How the Nashville Number System Works
              </h3>
              <p className="mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
                Session players write chord functions (<span className="font-mono text-cyan-300">1 – 4 – 5 – 6m</span>) instead of fixed letter names so a band can transpose a song to any singer&apos;s key in seconds.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePlayNashvilleChart}
              className={`min-h-[42px] px-4 py-2 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeNnsBarIdx !== null
                  ? 'bg-rose-500/25 text-rose-100 border-rose-300/45'
                  : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
              }`}
            >
              {activeNnsBarIdx !== null ? 'Stop NNS Chart' : `Play Chart in ${nashvilleChart.keyName}`}
            </button>
          </div>

          {/* Interactive Chart Selector + Key Switcher */}
          <div className="glass-recessed rounded-[3px] p-3.5 sm:p-4 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {NASHVILLE_CHARTS.map((chart) => {
                  const active = chart.id === nashvilleChartId;
                  return (
                    <button
                      key={chart.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setNashvilleChartId(chart.id)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold cursor-pointer transition-colors ${
                        active
                          ? 'bg-white/20 text-white border-white/35'
                          : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1]'
                      }`}
                    >
                      {chart.name}
                    </button>
                  );
                })}
              </div>
              <span className="font-mono text-[11px] text-cyan-300">
                Key of {nashvilleChart.keyName} · {nashvilleChart.feel}
              </span>
            </div>

            <p className="font-sans text-xs text-slate-300">
              {nashvilleChart.summary}
            </p>

            {/* Live 4-Bar Nashville Chart Translating to Active Key */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {nashvilleChart.bars.map((bar, idx) => {
                const isBarActive = activeNnsBarIdx === idx;
                return (
                  <button
                    key={`${nashvilleChart.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (bar.chordData.voicings[0]) {
                        learnAudio.playChord(
                          bar.chordData.voicings[0].midiNotes,
                          refFrequency,
                          instrument,
                          playMode
                        );
                      }
                    }}
                    className={`min-h-[108px] rounded-[3px] p-3 border text-left flex flex-col justify-between gap-1.5 active:scale-[0.97] transition-all cursor-pointer ${
                      isBarActive
                        ? 'bg-emerald-400/20 border-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.3)]'
                        : 'bg-slate-950/45 hover:bg-slate-950/65 border-white/12'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                      <span className="text-slate-400">BAR {idx + 1}</span>
                      {bar.mark && (
                        <span className="text-amber-300 font-semibold">{bar.mark}</span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display font-bold text-2xl sm:text-3xl text-cyan-300 tabular-nums">
                        {bar.nashville}
                      </span>
                      <span className="font-display font-bold text-lg sm:text-xl text-white">
                        {bar.displaySymbol}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 truncate">
                      {bar.chordData.notes.join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nashville Notation Cheat Sheet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {NASHVILLE_DECODER.map((item) => (
              <div
                key={item.token}
                className="glass-recessed rounded-[3px] p-3 border border-white/10 flex flex-col gap-1"
              >
                <div className="font-mono text-sm font-bold text-cyan-300">
                  {item.token}
                </div>
                <div className="font-display font-semibold text-sm text-white">
                  {item.title}
                </div>
                <p className="font-sans text-xs text-slate-300 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* 4. ESSENTIAL GUITAR & FRETBOARD MUSIC THEORY */}
      {showSection('fundamentals') && (
        <article
          aria-label="Essential Guitar Music Theory"
          className="glass-panel rounded-[4px] p-4 sm:p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-white">
                Essential {instMeta.label} &amp; Fretboard Theory
              </h3>
              <p className="mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
                Core principles that unlock chord building, movable neck shapes, and modes.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Core Theory Topics"
              className="flex items-center gap-1 glass-recessed rounded-[3px] p-1 overflow-x-auto no-scrollbar py-0.5 pr-0.5 sm:py-1 sm:pr-1 shrink-0"
            >
              {[
                { id: 'fretboard', label: 'Fretboard & Steps' },
                { id: 'formulas', label: 'Chord Formulas' },
                { id: 'caged', label: 'CAGED Shapes' },
                { id: 'modes', label: 'Rel. Minor & Modes' },
              ].map((sub) => {
                const active = theorySubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTheorySubTab(sub.id)}
                    className={`min-h-[38px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>

          {theorySubTab === 'fretboard' && (
            <div className="flex flex-col gap-4">
              <div className="glass-recessed rounded-[3px] p-3.5 sm:p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-display font-bold text-base text-white">
                    The 12-Note Chromatic Alphabet (1 Fret = 1 Half-Step)
                  </h4>
                  <span className="font-mono text-xs text-amber-300 font-semibold">
                    No ♯/♭ between B→C and E→F
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                  {CHROMATIC_NOTES.map((note) => {
                    const isHalfStepGap = [4, 11].includes(note.index);
                    const isRoot = note.index === rootPc;
                    return (
                      <button
                        key={`chrom-${note.index}`}
                        type="button"
                        onClick={() =>
                          learnAudio.playPluckedNote(
                            instConfig.scaleOctaveBase + note.index,
                            refFrequency,
                            0,
                            null,
                            0.55,
                            instrument
                          )
                        }
                        className={`min-h-[48px] p-1.5 rounded-[2px] border flex flex-col items-center justify-center font-mono text-xs font-semibold cursor-pointer transition-colors ${
                          isRoot
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                            : isHalfStepGap
                              ? 'bg-amber-400/15 text-amber-200 border-amber-300/35 hover:bg-amber-400/25'
                              : 'bg-white/[0.05] text-slate-200 border-white/10 hover:bg-white/[0.12]'
                        }`}
                      >
                        <span>{preferFlats ? note.flatName : note.name}</span>
                        <span className="text-[9px] opacity-75">
                          {isHalfStepGap ? '→ ½st' : `+${note.index}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="glass-recessed rounded-[3px] p-3.5 sm:p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-display font-bold text-base text-white">
                    Major Scale Formula in {selectedRootName}: W – W – H – W – W – W – H
                  </h4>
                  <span className="font-mono text-[11px] text-cyan-300">
                    W = 2 frets · H = 1 fret
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {majorScaleSteps.map((step) => (
                    <button
                      key={`maj-step-${step.degree}`}
                      type="button"
                      onClick={() =>
                        learnAudio.playPluckedNote(
                          step.midi,
                          refFrequency,
                          0,
                          null,
                          0.55,
                          instrument
                        )
                      }
                      className="min-h-[58px] p-2 rounded-[2px] bg-white/[0.05] hover:bg-cyan-400/18 border border-white/12 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
                    >
                      <span className="font-mono text-[10px] text-cyan-300">
                        Deg {step.degree}
                      </span>
                      <span className="font-display font-bold text-base text-white">
                        {step.name}
                      </span>
                      <span className="font-mono text-[10px] text-amber-300">
                        next: {step.nextStep}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="glass-recessed rounded-[3px] p-3">
                  <div className="font-mono text-xs font-bold text-cyan-300">
                    12th Fret Octave Reset
                  </div>
                  <p className="mt-1 font-sans text-xs text-slate-300">
                    Every open string repeats one full octave higher at fret 12 (the double-dot marker), so frets 13–24 mirror frets 1–12.
                  </p>
                </div>
                <div className="glass-recessed rounded-[3px] p-3">
                  <div className="font-mono text-xs font-bold text-cyan-300">
                    The Guitar B-String Shift
                  </div>
                  <p className="mt-1 font-sans text-xs text-slate-300">
                    Guitar strings are tuned in 4ths (5 frets apart) except G→B, which is a Major 3rd (4 frets). Shapes moving onto the B string shift up +1 fret.
                  </p>
                </div>
                <div className="glass-recessed rounded-[3px] p-3">
                  <div className="font-mono text-xs font-bold text-cyan-300">
                    Instant Octave Finder
                  </div>
                  <p className="mt-1 font-sans text-xs text-slate-300">
                    From E or A strings (on Guitar &amp; Bass), skip 1 string thinner and move 2 frets toward the body to find the exact same note one octave higher.
                  </p>
                </div>
              </div>
            </div>
          )}

          {theorySubTab === 'formulas' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CHORD_FORMULAS.map((item) => {
                const chord = getChordVoicings(rootPc, item.id, preferFlats, instrument);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (chord.voicings[0]) {
                        learnAudio.playChord(
                          chord.voicings[0].midiNotes,
                          refFrequency,
                          instrument,
                          playMode
                        );
                      }
                    }}
                    className="glass-recessed rounded-[3px] p-3.5 border border-white/12 hover:border-cyan-300/45 hover:bg-white/[0.06] text-left flex flex-col justify-between gap-2 active:scale-[0.98] cursor-pointer transition-all"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display font-bold text-lg text-white">
                        {chord.symbol} ({item.label})
                      </span>
                      <span className="font-mono text-xs font-bold text-cyan-300 shrink-0">
                        {item.formula}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-emerald-300">
                      Notes: {chord.notes.join(' · ')} ({item.semitones})
                    </div>
                    <p className="font-sans text-xs text-slate-300 leading-relaxed">
                      {item.mood}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {theorySubTab === 'caged' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center gap-2">
                {CAGED_SHAPES.map((shape) => {
                  const active = shape.letter === selectedCagedLetter;
                  return (
                    <button
                      key={shape.letter}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedCagedLetter(shape.letter)}
                      className={`min-h-[42px] px-4 py-1.5 rounded-[2px] border font-display font-bold text-base cursor-pointer transition-colors ${
                        active
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                          : 'bg-white/[0.05] text-white border-white/12 hover:bg-white/[0.12]'
                      }`}
                    >
                      {shape.letter}-Shape
                    </button>
                  );
                })}
              </div>

              {(() => {
                const activeShape =
                  CAGED_SHAPES.find((s) => s.letter === selectedCagedLetter) || CAGED_SHAPES[0];
                return (
                  <div className="glass-recessed rounded-[3px] p-4 flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-display font-bold text-lg text-white">
                        {activeShape.title}
                      </h4>
                      <span className="font-mono text-xs text-cyan-300 font-semibold">
                        Connects up-neck into → {activeShape.nextLetter}-Shape
                      </span>
                    </div>
                    <div className="font-mono text-xs text-emerald-300">
                      Root Landmarks: {activeShape.rootStrings} · Pattern: [
                      {activeShape.rootOffsets.map((f) => (f < 0 ? 'x' : f)).join(' ')}]
                    </div>
                    <p className="font-sans text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {activeShape.barreRule}
                    </p>
                    <p className="font-sans text-xs text-slate-400">
                      Tip: The word <span className="font-mono text-white font-semibold">C–A–G–E–D</span> gives you the exact ascending order up the fretboard for any chord. (Example: C Major = Open C at fret 0 → A-shape at fret 3 → G-shape at fret 5 → E-shape at fret 8 → D-shape at fret 10.)
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {theorySubTab === 'modes' && (
            <div className="flex flex-col gap-3">
              <div className="glass-recessed rounded-[3px] p-3.5 font-sans text-xs sm:text-sm text-slate-300">
                <strong className="text-white">The Relative Major / Minor Rule:</strong>{' '}
                Every Major key shares its exact 7 notes with its <span className="text-cyan-300 font-semibold">Relative Minor (6th degree / 3 frets lower)</span>. For {circleCtx.entry.majorLabel} Major, its relative minor is <span className="text-cyan-300 font-semibold">{circleCtx.entry.relMinorLabel}</span>. Modes simply shift which of those 7 notes feels like &ldquo;home.&rdquo;
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {MODE_CHEATSHEET.map((m) => (
                  <div
                    key={m.id}
                    className="glass-recessed rounded-[3px] p-3 border border-white/10 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="text-cyan-300 font-bold">Degree {m.degree}</span>
                        <span className="text-amber-300">{m.colorNote}</span>
                      </div>
                      <div className="mt-0.5 font-display font-bold text-base text-white">
                        {m.name}
                      </div>
                      <p className="mt-1 font-sans text-xs text-slate-300">{m.vibe}</p>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('scales', { scaleId: m.id })}
                        className="min-h-[36px] px-3 py-1 rounded-[2px] bg-white/[0.06] hover:bg-cyan-400/18 border border-white/12 font-mono text-[11px] font-semibold text-cyan-200 cursor-pointer transition-colors"
                      >
                        Explore {selectedRootName} {m.name} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      )}
    </section>
  );
};

export default TheoryGuidesSection;
