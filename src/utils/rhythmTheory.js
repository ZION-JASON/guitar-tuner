export const SEQUENCE_RHYTHM_STORAGE_KEY = 'chromatuner.sequenceRhythm.v1';
export const DEFAULT_SEQUENCE_RHYTHM_ID = 'single';

export const RHYTHM_CATEGORIES = [
  'All',
  '4/4 Essentials',
  'Syncopated & Funk',
  '3/4 & 6/8 Compound',
  'Feel & Genre',
];

const ACTION_META = {
  'accent-down': {
    arrow: '↓',
    shortCode: 'D',
    word: 'Down',
    spoken: 'DOWN',
    velocity: 1.18,
    staccatoBeats: null,
  },
  down: {
    arrow: '↓',
    shortCode: 'D',
    word: 'Down',
    spoken: 'Down',
    velocity: 0.94,
    staccatoBeats: null,
  },
  up: {
    arrow: '↑',
    shortCode: 'U',
    word: 'Up',
    spoken: 'Up',
    velocity: 0.78,
    staccatoBeats: null,
  },
  chuck: {
    arrow: '×',
    shortCode: 'X',
    word: 'Chuck',
    spoken: 'Chuck',
    velocity: 0.88,
    staccatoBeats: 0.14,
  },
  bass: {
    arrow: 'B',
    shortCode: 'B',
    word: 'Bass',
    spoken: 'Bass',
    velocity: 1.0,
    staccatoBeats: null,
  },
  rest: {
    arrow: '·',
    shortCode: '-',
    word: 'Miss',
    spoken: '(miss)',
    velocity: 0,
    staccatoBeats: null,
  },
};

function makeSlot(offsetBeats, countLabel, action, extra = {}) {
  const meta = ACTION_META[action] || ACTION_META.down;
  return {
    offsetBeats,
    countLabel,
    action,
    arrow: meta.arrow,
    shortCode: meta.shortCode,
    word: meta.word,
    spoken: extra.spoken || meta.spoken,
    velocity: extra.velocity ?? meta.velocity,
    staccatoBeats: extra.staccatoBeats ?? meta.staccatoBeats,
    swing: Boolean(extra.swing),
  };
}

function finalizeSlots(slots, cycleBeats) {
  const activeIndices = [];
  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i].action !== 'rest') activeIndices.push(i);
  }

  return slots.map((slot, idx) => {
    if (slot.action === 'rest') {
      return { ...slot, index: idx, durationBeats: 0 };
    }
    if (slot.staccatoBeats !== null) {
      return { ...slot, index: idx, durationBeats: slot.staccatoBeats };
    }

    const posInActive = activeIndices.indexOf(idx);
    const nextActiveIdx =
      posInActive >= 0 && posInActive + 1 < activeIndices.length
        ? activeIndices[posInActive + 1]
        : -1;

    const rawGap =
      nextActiveIdx >= 0
        ? slots[nextActiveIdx].offsetBeats - slot.offsetBeats
        : cycleBeats - slot.offsetBeats + (activeIndices[0] >= 0 ? slots[activeIndices[0]].offsetBeats : 0);

    return {
      ...slot,
      index: idx,
      durationBeats: Math.max(0.18, rawGap),
    };
  });
}

export function formatUpDownDescription(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return '';
  return slots.map((s) => s.spoken || s.word).join(' · ');
}

export function formatShortArrowCode(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return '';
  return slots.map((s) => s.shortCode).join(' ');
}

const RAW_PATTERNS = [
  {
    id: 'single',
    name: 'Single Strum / Hold',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 90,
    level: 'Foundation',
    summary: 'Strums or arpeggiates once cleanly on Beat 1 and lets every string sustain across the chord duration.',
    feelTip: 'Best for practicing clean chord shapes, ear training, and slow transitions before adding strumming motion.',
    inTheoryLibrary: false,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down (Hold)' }),
      makeSlot(1, '2', 'rest', { spoken: '(hold)' }),
      makeSlot(2, '3', 'rest', { spoken: '(hold)' }),
      makeSlot(3, '4', 'rest', { spoken: '(hold)' }),
    ],
  },
  {
    id: 'quarter-downs',
    name: 'Four-on-the-Floor (Quarter Downs)',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 96,
    level: 'Beginner',
    summary: 'One steady downstroke on every beat (1, 2, 3, 4). Locks your wrist to the metronome pulse.',
    feelTip: 'Keep your elbow relaxed and strum on the click. Your hand returns upward silently between every beat.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(1, '2', 'down'),
      makeSlot(2, '3', 'down'),
      makeSlot(3, '4', 'down'),
    ],
  },
  {
    id: 'pendulum-strum',
    name: 'The Pendulum Strum (Constant Motion)',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 92,
    level: 'Essential',
    summary: 'Never stop your wrist! Keep an unbroken Down-Up pendulum on 1 & 2 & 3 & 4 &, letting your pick glide silently past the strings on the air-up misses.',
    feelTip: 'Lock your elbow-wrist swing like a clock pendulum: Down (miss-up) · Down Up · Down (miss-up) · Down Up. Your arm moves identically even during silent beats.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(0.5, '&', 'rest', { spoken: '(air-up)' }),
      makeSlot(1, '2', 'down'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'accent-down', { spoken: 'Down' }),
      makeSlot(2.5, '&', 'rest', { spoken: '(air-up)' }),
      makeSlot(3, '4', 'down'),
      makeSlot(3.5, '&', 'up'),
    ],
  },
  {
    id: 'rock-eighths',
    name: 'Driving 8th-Note Rock (Down-Up)',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 100,
    level: 'Beginner',
    summary: 'Continuous alternating Down-Up pendulum across all eight subdivisions (1 & 2 & 3 & 4 &).',
    feelTip: 'Numbers (1, 2, 3, 4) are ALWAYS Down; "&" offbeats are ALWAYS Up. Lean into beats 1 & 3 for rock drive.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(0.5, '&', 'up'),
      makeSlot(1, '2', 'down'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'accent-down', { spoken: 'Down' }),
      makeSlot(2.5, '&', 'up'),
      makeSlot(3, '4', 'down'),
      makeSlot(3.5, '&', 'up'),
    ],
  },
  {
    id: 'island-strum',
    name: 'Island / Folk Strum',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 96,
    level: 'Essential',
    summary: 'The most versatile acoustic guitar & ukulele groove: skip the "&" of 1 and the downstroke of 3 while keeping your hand moving.',
    feelTip: 'Never freeze your wrist on beat 3—swing past the strings in the air (Down-miss), then catch the Upstroke on "&"!',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(0.5, '&', 'rest'),
      makeSlot(1, '2', 'down'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'rest'),
      makeSlot(2.5, '&', 'up'),
      makeSlot(3, '4', 'down'),
      makeSlot(3.5, '&', 'up'),
    ],
  },
  {
    id: 'pop-backbeat',
    name: 'Acoustic Pop Backbeat (Chuck 2 & 4)',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 92,
    level: 'Intermediate',
    summary: 'Replaces beats 2 and 4 with a crisp percussive muted "Chuck" (palm slap + rake) to imitate a snare drum backbeat.',
    feelTip: 'Rest the fleshy edge of your strumming palm lightly across the strings as your pick brushes down on 2 and 4.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(0.5, '&', 'up'),
      makeSlot(1, '2', 'chuck'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'down'),
      makeSlot(2.5, '&', 'up'),
      makeSlot(3, '4', 'chuck'),
      makeSlot(3.5, '&', 'up'),
    ],
  },
  {
    id: 'palm-mute-rock',
    name: 'Driving Rock Chug & Backbeat Pickup',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 108,
    level: 'Intermediate',
    summary: 'Alternates punchy open chord downbeats with tight muted backbeat chugs and a lifting "&" upstroke before beat 1.',
    feelTip: 'Let beats 1 and 3 ring out full, snap beats 2 and 4 tight against the bridge/palm, and catch the 4-& upstroke into the next bar.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'DOWN' }),
      makeSlot(0.5, '&', 'chuck', { spoken: 'Mute' }),
      makeSlot(1, '2', 'down'),
      makeSlot(1.5, '&', 'chuck', { spoken: 'Mute' }),
      makeSlot(2, '3', 'accent-down', { spoken: 'DOWN' }),
      makeSlot(2.5, '&', 'chuck', { spoken: 'Mute' }),
      makeSlot(3, '4', 'down'),
      makeSlot(3.5, '&', 'up'),
    ],
  },
  {
    id: 'boom-chick',
    name: 'Country / Folk Boom-Chick',
    category: '4/4 Essentials',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 104,
    level: 'Intermediate',
    summary: 'Plucks the low bass root string on beats 1 and 3, answered by bright upper-string Down-Up strums on 2-& and 4-&.',
    feelTip: 'Great for Johnny Cash, acoustic folk, and country rhythm—separates bass weight from sparkling chord treble.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'bass'),
      makeSlot(0.5, '&', 'rest', { spoken: '(let ring)' }),
      makeSlot(1, '2', 'down'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'bass'),
      makeSlot(2.5, '&', 'rest', { spoken: '(let ring)' }),
      makeSlot(3, '4', 'down'),
      makeSlot(3.5, '&', 'up'),
    ],
  },
  {
    id: 'sixteenth-motor',
    name: '16th-Note Wrist Warmer (1 e & a 2 e & a)',
    category: 'Syncopated & Funk',
    timeSig: '4/4',
    cycleBeats: 2,
    recommendedBpm: 76,
    level: 'Intermediate',
    summary: 'Crisp 2-beat alternating 16th-note wrist warmer ("1 e & a 2 e & a") that keeps a loose, even pendulum across full and split-bar chords.',
    feelTip: 'Downs fall on the beat and "&"; Ups fall on "e" and "a". Keep wrist flicks small near the soundhole.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(0.25, 'e', 'up'),
      makeSlot(0.5, '&', 'down'),
      makeSlot(0.75, 'a', 'up'),
      makeSlot(1, '2', 'accent-down', { spoken: 'Down' }),
      makeSlot(1.25, 'e', 'up'),
      makeSlot(1.5, '&', 'down'),
      makeSlot(1.75, 'a', 'up'),
    ],
  },
  {
    id: 'push-syncopation',
    name: 'Syncopated Anticipation ("Push")',
    category: 'Syncopated & Funk',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 94,
    level: 'Intermediate',
    summary: 'Hits strong accents off the beat (on the "&" of 2 and "&" of 3) to create modern pop/indie forward momentum.',
    feelTip: 'Because you miss beat 3 and accent the "&" of 2, listeners feel the groove leaning forward.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(0.5, '&', 'rest'),
      makeSlot(1, '2', 'rest'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'rest'),
      makeSlot(2.5, '&', 'up'),
      makeSlot(3, '4', 'down'),
      makeSlot(3.5, '&', 'rest'),
    ],
  },
  {
    id: 'waltz-3-4',
    name: '3/4 Classic Waltz Groove',
    category: '3/4 & 6/8 Compound',
    timeSig: '3/4',
    cycleBeats: 3,
    recommendedBpm: 108,
    level: 'Beginner',
    summary: 'Three-beat waltz feel ("ONE-two-three"): low bass root on beat 1 followed by two lighter downward chord sweeps.',
    feelTip: 'Set your chord beats to 3 (or 6) in the Sequencer for seamless 3/4 waltz bars.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'bass'),
      makeSlot(1, '2', 'down'),
      makeSlot(2, '3', 'down'),
    ],
  },
  {
    id: 'waltz-lilting',
    name: '3/4 Lilting Acoustic Folk',
    category: '3/4 & 6/8 Compound',
    timeSig: '3/4',
    cycleBeats: 3,
    recommendedBpm: 92,
    level: 'Essential',
    summary: 'Flowing 3/4 acoustic pattern adding buoyant upstrokes on beats 2-& and 3-& (Down · Down Up · Down Up).',
    feelTip: 'Common in modern singer-songwriter ballads in 3/4—keeps the 3-beat sway airy instead of rigid.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
      makeSlot(0.5, '&', 'rest'),
      makeSlot(1, '2', 'down'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'down'),
      makeSlot(2.5, '&', 'up'),
    ],
  },
  {
    id: 'ballad-6-8',
    name: '6/8 Slow Ballad Sway',
    category: '3/4 & 6/8 Compound',
    timeSig: '6/8',
    cycleBeats: 6,
    recommendedBpm: 112,
    level: 'Essential',
    summary: 'Six eighth-note pulses grouped as two strong 3-count waves: Heavy accent on 1, medium pulse on 4 (1-2-3  4-5-6).',
    feelTip: 'Count "ONE two three, FOUR five six". Matches 6/8 songs like slow blues, soul, and acoustic rock ballads.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'DOWN' }),
      makeSlot(1, '2', 'up'),
      makeSlot(2, '3', 'down'),
      makeSlot(3, '4', 'accent-down', { spoken: 'Down (Med)', velocity: 1.04 }),
      makeSlot(4, '5', 'up'),
      makeSlot(5, '6', 'down'),
    ],
  },
  {
    id: 'blues-12-8',
    name: '12/8 Slow Blues / Soul Sway',
    category: '3/4 & 6/8 Compound',
    timeSig: '12/8',
    cycleBeats: 4,
    recommendedBpm: 68,
    level: 'Essential',
    summary: 'Twelve rolling eighth pulses felt as four triplet waves per bar (1 & a · 2 & a · 3 & a · 4 & a).',
    feelTip: 'Lean hard into 1 and 3 with a warm brush across the middle triplet pulses—signature slow blues & Motown feel.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'DOWN' }),
      makeSlot(1 / 3, '&', 'up', { spoken: 'up', velocity: 0.68 }),
      makeSlot(2 / 3, 'a', 'down', { spoken: 'down', velocity: 0.78 }),
      makeSlot(1, '2', 'down', { spoken: 'Down', velocity: 0.88 }),
      makeSlot(1 + 1 / 3, '&', 'up', { spoken: 'up', velocity: 0.68 }),
      makeSlot(1 + 2 / 3, 'a', 'down', { spoken: 'down', velocity: 0.78 }),
      makeSlot(2, '3', 'accent-down', { spoken: 'DOWN', velocity: 1.08 }),
      makeSlot(2 + 1 / 3, '&', 'up', { spoken: 'up', velocity: 0.68 }),
      makeSlot(2 + 2 / 3, 'a', 'down', { spoken: 'down', velocity: 0.78 }),
      makeSlot(3, '4', 'down', { spoken: 'Down', velocity: 0.88 }),
      makeSlot(3 + 1 / 3, '&', 'up', { spoken: 'up', velocity: 0.68 }),
      makeSlot(3 + 2 / 3, 'a', 'down', { spoken: 'down', velocity: 0.82 }),
    ],
  },
  {
    id: 'swing-shuffle',
    name: 'Blues / Swing Triplet Shuffle',
    category: 'Feel & Genre',
    timeSig: '4/4',
    cycleBeats: 2,
    recommendedBpm: 94,
    level: 'Intermediate',
    summary: 'Replaces even straight 8ths with a bouncy 2:1 triplet "long-short" lilt (Down · hold · Up · Down · hold · Up).',
    feelTip: 'Think "HUM-pty DUM-pty"—the Downstroke gets 2/3 of the beat and the Upstroke hops right before the next beat.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'accent-down', { spoken: 'Down (Long)', swing: true }),
      makeSlot(1 / 3, '&', 'rest', { spoken: '(swing)', swing: true }),
      makeSlot(2 / 3, 'a', 'up', { spoken: 'Up (Short)', swing: true }),
      makeSlot(1, '2', 'down', { spoken: 'Down (Long)', swing: true }),
      makeSlot(1 + 1 / 3, '&', 'rest', { spoken: '(swing)', swing: true }),
      makeSlot(1 + 2 / 3, 'a', 'up', { spoken: 'Up (Short)', swing: true }),
    ],
  },
  {
    id: 'bossa-nova',
    name: 'Bossa Nova Syncopated Groove',
    category: 'Feel & Genre',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 110,
    level: 'Groove',
    summary: 'Warm acoustic thumb bass on 1 and 3 with floating syncopated upper-string chord touches on 2-&, 3-&, and 4.',
    feelTip: 'Keep the bass strings warm and legato while your treble chord stabs sit lightly off the beat.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'bass'),
      makeSlot(0.5, '&', 'rest'),
      makeSlot(1, '2', 'rest'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'bass'),
      makeSlot(2.5, '&', 'up'),
      makeSlot(3, '4', 'down'),
      makeSlot(3.5, '&', 'rest'),
    ],
  },
  {
    id: 'country-train',
    name: 'Country Train Beat',
    category: 'Feel & Genre',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 112,
    level: 'Groove',
    summary: 'Brisk railroad groove pairing low thumb bass roots with crisp snappy backbeat chucks and light "&" upstrokes.',
    feelTip: 'Let the low root thump on beats 1 and 3, then snap a sharp muted chuck on 2 and 4 like train wheels on track.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'bass'),
      makeSlot(0.5, '&', 'up'),
      makeSlot(1, '2', 'chuck'),
      makeSlot(1.5, '&', 'up'),
      makeSlot(2, '3', 'bass'),
      makeSlot(2.5, '&', 'up'),
      makeSlot(3, '4', 'chuck'),
      makeSlot(3.5, '&', 'up'),
    ],
  },
  {
    id: 'reggae-skank',
    name: 'Reggae Offbeat Skank',
    category: 'Feel & Genre',
    timeSig: '4/4',
    cycleBeats: 4,
    recommendedBpm: 82,
    level: 'Groove',
    summary: 'Leaves beats 1, 2, 3, and 4 completely open for the bass/kick and fires crisp staccato chord upstrokes strictly on "&".',
    feelTip: 'Release fretting-hand pressure immediately after each "&" upstroke so the chord snaps tight and leaves space.',
    inTheoryLibrary: true,
    slots: [
      makeSlot(0, '1', 'rest', { spoken: '(rest)' }),
      makeSlot(0.5, '&', 'up', { spoken: 'Up (Snap)', staccatoBeats: 0.24, velocity: 0.96 }),
      makeSlot(1, '2', 'rest', { spoken: '(rest)' }),
      makeSlot(1.5, '&', 'up', { spoken: 'Up (Snap)', staccatoBeats: 0.24, velocity: 0.96 }),
      makeSlot(2, '3', 'rest', { spoken: '(rest)' }),
      makeSlot(2.5, '&', 'up', { spoken: 'Up (Snap)', staccatoBeats: 0.24, velocity: 0.96 }),
      makeSlot(3, '4', 'rest', { spoken: '(rest)' }),
      makeSlot(3.5, '&', 'up', { spoken: 'Up (Snap)', staccatoBeats: 0.24, velocity: 0.96 }),
    ],
  },
];

export const RHYTHM_PATTERNS = RAW_PATTERNS.map((pat) => {
  const slots = finalizeSlots(pat.slots, pat.cycleBeats);
  return {
    ...pat,
    slots,
    upDownText: formatUpDownDescription(slots),
    shortCode: formatShortArrowCode(slots),
  };
});

export const RHYTHM_SUBDIVISIONS = [
  {
    id: 'quarter',
    name: 'Quarter Notes',
    ratioLabel: '1 hit per beat',
    countText: '1 · 2 · 3 · 4',
    upDownText: 'Down · Down · Down · Down',
    explanation: 'Matches the metronome click directly. Your hand drops on the click and resets silently in the air.',
    cycleBeats: 4,
    slots: finalizeSlots(
      [
        makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
        makeSlot(1, '2', 'down'),
        makeSlot(2, '3', 'down'),
        makeSlot(3, '4', 'down'),
      ],
      4
    ),
  },
  {
    id: 'eighth',
    name: 'Eighth Notes (8ths)',
    ratioLabel: '2 hits per beat',
    countText: '1 & 2 & 3 & 4 &',
    upDownText: 'Down · Up · Down · Up · Down · Up · Down · Up',
    explanation: 'Splits each beat cleanly in half. Down on every number (1, 2, 3, 4), Up on every "&" offbeat.',
    cycleBeats: 4,
    slots: finalizeSlots(
      [
        makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
        makeSlot(0.5, '&', 'up'),
        makeSlot(1, '2', 'down'),
        makeSlot(1.5, '&', 'up'),
        makeSlot(2, '3', 'down'),
        makeSlot(2.5, '&', 'up'),
        makeSlot(3, '4', 'down'),
        makeSlot(3.5, '&', 'up'),
      ],
      4
    ),
  },
  {
    id: 'triplet',
    name: 'Triplets (3 per beat)',
    ratioLabel: '3 hits per beat',
    countText: '1 & a · 2 & a',
    upDownText: 'Down · Up · Down · Up · Down · Up',
    explanation: 'Three equal pulses per beat. Creates rolling blues, 12/8, 6/8 ballad, and swung shuffle feels.',
    cycleBeats: 2,
    slots: finalizeSlots(
      [
        makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
        makeSlot(1 / 3, '&', 'up'),
        makeSlot(2 / 3, 'a', 'down'),
        makeSlot(1, '2', 'up'),
        makeSlot(1 + 1 / 3, '&', 'down'),
        makeSlot(1 + 2 / 3, 'a', 'up'),
      ],
      2
    ),
  },
  {
    id: 'sixteenth',
    name: 'Sixteenth Notes (Wrist Warmer)',
    ratioLabel: '4 hits per beat',
    countText: '1 e & a · 2 e & a',
    upDownText: 'Down · Up · Down · Up · Down · Up · Down · Up',
    explanation: 'Splits each beat into four quick wrist flicks ("1 e & a"). Beat numbers and "&" are Downstrokes; "e" and "a" are Upstrokes.',
    cycleBeats: 2,
    slots: finalizeSlots(
      [
        makeSlot(0, '1', 'accent-down', { spoken: 'Down' }),
        makeSlot(0.25, 'e', 'up'),
        makeSlot(0.5, '&', 'down'),
        makeSlot(0.75, 'a', 'up'),
        makeSlot(1, '2', 'down'),
        makeSlot(1.25, 'e', 'up'),
        makeSlot(1.5, '&', 'down'),
        makeSlot(1.75, 'a', 'up'),
      ],
      2
    ),
  },
];

export const RHYTHM_GOLDEN_RULES = [
  {
    title: '01. The Pendulum Arm Law',
    summary:
      'Your strumming hand never stops moving up and down like a clock pendulum. Even when a pattern says "(miss)" (a ghost stroke), your wrist still glides past the strings so your timing never slips.',
  },
  {
    title: '02. Numbers = Down, "&" = Up',
    summary:
      'In 8th-note grooves ("1 & 2 & 3 & 4 &"), downbeats (1, 2, 3, 4) are always Downstrokes (↓), and "&" offbeats are always Upstrokes (↑). In 16ths ("1 e & a"), 1 and & are Down while e and a are Up.',
  },
  {
    title: '03. Dynamics & Muted Chucks',
    summary:
      'A robot strums every hit equally; great rhythm contrasts soft upstrokes on the top 3–4 strings with strong beat-1 roots and percussive "Chuck" (×) slaps on beats 2 & 4.',
  },
];

const PATTERN_BY_ID = new Map(RHYTHM_PATTERNS.map((p) => [p.id, p]));
const LEGACY_RHYTHM_ALIASES = new Map([
  ['sixteenth-full', 'sixteenth-motor'],
  ['sixteenth-pop', 'sixteenth-motor'],
  ['funk-pocket', 'sixteenth-motor'],
]);

export function getRhythmPattern(id = DEFAULT_SEQUENCE_RHYTHM_ID) {
  const mappedId = LEGACY_RHYTHM_ALIASES.get(id) || id;
  return PATTERN_BY_ID.get(mappedId) || PATTERN_BY_ID.get(DEFAULT_SEQUENCE_RHYTHM_ID);
}

export function normalizeRhythmId(id, { allowInherit = false } = {}) {
  if (allowInherit && (id === 'inherit' || id === null || id === undefined || id === '')) {
    return 'inherit';
  }
  if (typeof id === 'string') {
    const mappedId = LEGACY_RHYTHM_ALIASES.get(id) || id;
    if (PATTERN_BY_ID.has(mappedId)) {
      return mappedId;
    }
  }
  return allowInherit ? 'inherit' : DEFAULT_SEQUENCE_RHYTHM_ID;
}

export function getRhythmPatternsByCategory(category = 'All', { includeSingle = false } = {}) {
  return RHYTHM_PATTERNS.filter((p) => {
    if (!includeSingle && !p.inTheoryLibrary) return false;
    return category === 'All' || p.category === category;
  });
}

/**
 * Expands a rhythm pattern to cover any step duration (`stepBeats`, 1..16 beats).
 * Tiles full pattern cycles cleanly and truncates safely on split bars (e.g., 2 beats).
 */
export function expandRhythmEventsForStep(patternId, stepBeats = 4) {
  const safeBeats = Math.max(1, Math.min(16, Number(stepBeats) || 4));
  const pattern = getRhythmPattern(patternId);
  const cycleBeats = Math.max(1, pattern.cycleBeats || 4);

  if (pattern.id === 'single') {
    const firstSlot = pattern.slots[0];
    return [
      {
        ...firstSlot,
        offsetBeats: 0,
        durationBeats: safeBeats,
        slotIndex: 0,
        cycleIndex: 0,
      },
    ];
  }

  const events = [];
  const totalCycles = Math.ceil(safeBeats / cycleBeats);

  for (let cycleIdx = 0; cycleIdx < totalCycles; cycleIdx += 1) {
    const cycleOffset = cycleIdx * cycleBeats;
    for (let sIdx = 0; sIdx < pattern.slots.length; sIdx += 1) {
      const slot = pattern.slots[sIdx];
      const absOffset = cycleOffset + slot.offsetBeats;
      if (absOffset >= safeBeats - 1e-6) break;

      const remainingStepBeats = safeBeats - absOffset;
      const clampedDuration =
        slot.action === 'rest'
          ? 0
          : Math.max(0.16, Math.min(slot.durationBeats || remainingStepBeats, remainingStepBeats));

      events.push({
        ...slot,
        offsetBeats: absOffset,
        durationBeats: clampedDuration,
        slotIndex: sIdx,
        cycleIndex: cycleIdx,
      });
    }
  }

  return events;
}

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

export function loadSequenceRhythmId(storageOverride = null) {
  const storage = getSafeStorage(storageOverride);
  if (!storage) return DEFAULT_SEQUENCE_RHYTHM_ID;
  try {
    const raw = storage.getItem(SEQUENCE_RHYTHM_STORAGE_KEY);
    return normalizeRhythmId(raw, { allowInherit: false });
  } catch {
    return DEFAULT_SEQUENCE_RHYTHM_ID;
  }
}

export function saveSequenceRhythmId(rhythmId, storageOverride = null) {
  const storage = getSafeStorage(storageOverride);
  const normalized = normalizeRhythmId(rhythmId, { allowInherit: false });
  if (!storage) return normalized;
  try {
    storage.setItem(SEQUENCE_RHYTHM_STORAGE_KEY, normalized);
  } catch {
    // ignore storage quota failures
  }
  return normalized;
}
