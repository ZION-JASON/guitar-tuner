export const CHROMATIC_NOTES = [
  { index: 0, name: 'C', label: 'C', flatName: 'C' },
  { index: 1, name: 'C#', label: 'C# / Db', flatName: 'Db' },
  { index: 2, name: 'D', label: 'D', flatName: 'D' },
  { index: 3, name: 'D#', label: 'D# / Eb', flatName: 'Eb' },
  { index: 4, name: 'E', label: 'E', flatName: 'E' },
  { index: 5, name: 'F', label: 'F', flatName: 'F' },
  { index: 6, name: 'F#', label: 'F# / Gb', flatName: 'Gb' },
  { index: 7, name: 'G', label: 'G', flatName: 'G' },
  { index: 8, name: 'G#', label: 'G# / Ab', flatName: 'Ab' },
  { index: 9, name: 'A', label: 'A', flatName: 'A' },
  { index: 10, name: 'A#', label: 'A# / Bb', flatName: 'Bb' },
  { index: 11, name: 'B', label: 'B', flatName: 'B' },
];

export const INTERVAL_LABELS = [
  { semitones: 0, degree: 'R', short: 'P1', name: 'Root (Unison)' },
  { semitones: 1, degree: 'b2', short: 'm2', name: 'Minor 2nd' },
  { semitones: 2, degree: '2', short: 'M2', name: 'Major 2nd' },
  { semitones: 3, degree: 'b3', short: 'm3', name: 'Minor 3rd' },
  { semitones: 4, degree: '3', short: 'M3', name: 'Major 3rd' },
  { semitones: 5, degree: '4', short: 'P4', name: 'Perfect 4th' },
  { semitones: 6, degree: 'b5', short: 'TT', name: 'Tritone (b5/#4)' },
  { semitones: 7, degree: '5', short: 'P5', name: 'Perfect 5th' },
  { semitones: 8, degree: 'b6', short: 'm6', name: 'Minor 6th' },
  { semitones: 9, degree: '6', short: 'M6', name: 'Major 6th' },
  { semitones: 10, degree: 'b7', short: 'm7', name: 'Minor 7th' },
  { semitones: 11, degree: '7', short: 'M7', name: 'Major 7th' },
];

// Standard EADGBE open string MIDI values (String 6 -> String 1)
export const STANDARD_OPEN_MIDI = [40, 45, 50, 55, 59, 64];
export const STANDARD_STRING_LABELS = ['6E', '5A', '4D', '3G', '2B', '1E'];

export const INSTRUMENT_CONFIGS = {
  guitar: {
    id: 'guitar',
    label: 'Guitar',
    openMidi: STANDARD_OPEN_MIDI,
    stringLabels: STANDARD_STRING_LABELS,
    scaleOctaveBase: 48,
  },
  bass: {
    id: 'bass',
    label: 'Bass',
    openMidi: [28, 33, 38, 43],
    stringLabels: ['4E', '3A', '2D', '1G'],
    scaleOctaveBase: 36,
  },
  ukulele: {
    id: 'ukulele',
    label: 'Ukulele',
    openMidi: [67, 60, 64, 69],
    stringLabels: ['4G', '3C', '2E', '1A'],
    scaleOctaveBase: 60,
  },
};

export function getInstrumentConfig(instrumentId = 'guitar') {
  return INSTRUMENT_CONFIGS[instrumentId] || INSTRUMENT_CONFIGS.guitar;
}

export function getNoteName(pc, preferFlats = false) {
  const normalized = ((pc % 12) + 12) % 12;
  const entry = CHROMATIC_NOTES[normalized];
  return preferFlats ? entry.flatName : entry.name;
}

export function shouldPreferFlats(rootPc) {
  // F (5), Bb (10), Eb (3), Ab (8), Db (1), Gb (6) conventionally use flats
  return [1, 3, 5, 6, 8, 10].includes(((rootPc % 12) + 12) % 12);
}

// All 25 chord qualities are supported across Guitar, Bass Guitar, and Ukulele.
export const BASS_EXCLUDED_QUALITY_IDS = new Set();

export function isChordQualitySupportedForInstrument(qualityId, instrumentId = 'guitar') {
  if (instrumentId === 'bass') {
    return !BASS_EXCLUDED_QUALITY_IDS.has(qualityId);
  }
  return true;
}

export function mapQualityForInstrument(qualityId, instrumentId = 'guitar') {
  if (instrumentId === 'bass' && BASS_EXCLUDED_QUALITY_IDS.has(qualityId)) {
    return '5';
  }
  return qualityId;
}

export function getChordQualitiesForInstrument(instrumentId = 'guitar') {
  if (instrumentId === 'bass') {
    return CHORD_QUALITIES.filter((q) => !BASS_EXCLUDED_QUALITY_IDS.has(q.id));
  }
  return CHORD_QUALITIES;
}

// Ordered to prioritize Major chords first, followed by core 7th/Power/Minor chords,
// with suspended, extended, and altered complex chords placed at the bottom.
export const CHORD_QUALITIES = [
  {
    id: 'major',
    name: 'Major',
    symbol: '',
    category: 'Triads',
    tier: 'core',
    intervals: [0, 4, 7],
    degrees: ['1', '3', '5'],
    description: 'Bright, stable foundational triad.',
  },
  {
    id: 'maj7',
    name: 'Major 7th',
    symbol: 'maj7',
    category: 'Sevenths',
    tier: 'core',
    intervals: [0, 4, 7, 11],
    degrees: ['1', '3', '5', '7'],
    description: 'Lush, warm jazz/neo-soul tonic chord.',
  },
  {
    id: '6',
    name: 'Major 6th',
    symbol: '6',
    category: 'Extended',
    tier: 'core',
    intervals: [0, 4, 7, 9],
    degrees: ['1', '3', '5', '6'],
    description: 'Vintage swing and acoustic major color chord.',
  },
  {
    id: '7',
    name: 'Dominant 7th',
    symbol: '7',
    category: 'Sevenths',
    tier: 'core',
    intervals: [0, 4, 7, 10],
    degrees: ['1', '3', '5', 'b7'],
    description: 'Bluesy, tension-rich V7 chord driving resolution.',
  },
  {
    id: '5',
    name: 'Power (5)',
    symbol: '5',
    category: 'Triads',
    tier: 'core',
    intervals: [0, 7],
    degrees: ['1', '5'],
    description: 'Neutral root-fifth dyad ideal for rock & riffs.',
  },
  {
    id: 'minor',
    name: 'Minor',
    symbol: 'm',
    category: 'Triads',
    tier: 'core',
    intervals: [0, 3, 7],
    degrees: ['1', 'b3', '5'],
    description: 'Melancholic triad with a lowered third.',
  },
  {
    id: 'm7',
    name: 'Minor 7th',
    symbol: 'm7',
    category: 'Sevenths',
    tier: 'core',
    intervals: [0, 3, 7, 10],
    degrees: ['1', 'b3', '5', 'b7'],
    description: 'Smooth minor seventh used across jazz, funk, and R&B.',
  },
  {
    id: 'm6',
    name: 'Minor 6th',
    symbol: 'm6',
    category: 'Extended',
    tier: 'core',
    intervals: [0, 3, 7, 9],
    degrees: ['1', 'b3', '5', '6'],
    description: 'Dorian-flavored minor chord with a bright major 6th.',
  },
  {
    id: 'add9',
    name: 'Add9',
    symbol: 'add9',
    category: 'Extended',
    tier: 'complex',
    intervals: [0, 4, 7, 2],
    degrees: ['1', '3', '5', '9'],
    description: 'Shimmering triad with an added ninth and no seventh.',
  },
  {
    id: 'maj9',
    name: 'Major 9th',
    symbol: 'maj9',
    category: 'Extended',
    tier: 'complex',
    intervals: [0, 4, 7, 11, 2],
    degrees: ['1', '3', '5', '7', '9'],
    description: 'Expressive open major ninth chord.',
  },
  {
    id: '6_9',
    name: 'Major 6/9',
    symbol: '6/9',
    category: 'Extended',
    tier: 'complex',
    intervals: [0, 4, 7, 9, 2],
    degrees: ['1', '3', '5', '6', '9'],
    description: 'Smooth bossa nova and jazz tonic triad with 6th and 9th.',
  },
  {
    id: 'sus2',
    name: 'Sus2',
    symbol: 'sus2',
    category: 'Suspended',
    tier: 'complex',
    intervals: [0, 2, 7],
    degrees: ['1', '2', '5'],
    description: 'Open, airy voicing replacing the 3rd with the 2nd.',
  },
  {
    id: 'sus4',
    name: 'Sus4',
    symbol: 'sus4',
    category: 'Suspended',
    tier: 'complex',
    intervals: [0, 5, 7],
    degrees: ['1', '4', '5'],
    description: 'Tense suspended voicing resolving naturally to major.',
  },
  {
    id: '7sus4',
    name: '7sus4',
    symbol: '7sus4',
    category: 'Suspended',
    tier: 'complex',
    intervals: [0, 5, 7, 10],
    degrees: ['1', '4', '5', 'b7'],
    description: 'Floating dominant suspension common in soul and fusion.',
  },
  {
    id: '9',
    name: 'Dominant 9th',
    symbol: '9',
    category: 'Extended',
    tier: 'complex',
    intervals: [0, 4, 7, 10, 2],
    degrees: ['1', '3', '5', 'b7', '9'],
    description: 'Funk, blues, and R&B dominant voicing with a warm 9th.',
  },
  {
    id: '13',
    name: 'Dominant 13th',
    symbol: '13',
    category: 'Extended',
    tier: 'complex',
    intervals: [0, 4, 7, 10, 9],
    degrees: ['1', '3', '5', 'b7', '13'],
    description: 'Lush jazz dominant voicing adding the natural 13th on top.',
  },
  {
    id: 'm9',
    name: 'Minor 9th',
    symbol: 'm9',
    category: 'Extended',
    tier: 'complex',
    intervals: [0, 3, 7, 10, 2],
    degrees: ['1', 'b3', '5', 'b7', '9'],
    description: 'Rich neo-soul and jazz minor extended voicing.',
  },
  {
    id: 'm11',
    name: 'Minor 11th',
    symbol: 'm11',
    category: 'Extended',
    tier: 'complex',
    intervals: [0, 3, 7, 10, 5],
    degrees: ['1', 'b3', '5', 'b7', '11'],
    description: 'Open, modal minor voicing with a suspended 11th color.',
  },
  {
    id: 'm_maj7',
    name: 'Minor Maj7',
    symbol: 'm(maj7)',
    category: 'Altered / Dim',
    tier: 'complex',
    intervals: [0, 3, 7, 11],
    degrees: ['1', 'b3', '5', '7'],
    description: 'Cinematic James Bond minor chord with a natural 7th.',
  },
  {
    id: 'dim',
    name: 'Diminished',
    symbol: 'dim',
    category: 'Altered / Dim',
    tier: 'complex',
    intervals: [0, 3, 6],
    degrees: ['1', 'b3', 'b5'],
    description: 'Tight, tense diminished triad with stacked minor thirds.',
  },
  {
    id: 'dim7',
    name: 'Diminished 7th',
    symbol: 'dim7',
    category: 'Altered / Dim',
    tier: 'complex',
    intervals: [0, 3, 6, 9],
    degrees: ['1', 'b3', 'b5', 'bb7'],
    description: 'Symmetrical passing chord every 3 frets.',
  },
  {
    id: 'm7b5',
    name: 'Half-Dim (m7b5)',
    symbol: 'm7b5',
    category: 'Altered / Dim',
    tier: 'complex',
    intervals: [0, 3, 6, 10],
    degrees: ['1', 'b3', 'b5', 'b7'],
    description: 'Essential ii chord in minor ii-V-i progressions.',
  },
  {
    id: 'aug',
    name: 'Augmented',
    symbol: 'aug',
    category: 'Altered / Dim',
    tier: 'complex',
    intervals: [0, 4, 8],
    degrees: ['1', '3', '#5'],
    description: 'Symmetrical raised-fifth chord creating suspense.',
  },
  {
    id: '7sharp9',
    name: 'Dom 7#9 (Hendrix)',
    symbol: '7#9',
    category: 'Altered / Dim',
    tier: 'complex',
    intervals: [0, 4, 7, 10, 3],
    degrees: ['1', '3', '5', 'b7', '#9'],
    description: 'Iconic rock & blues altered chord blending M3 and #9.',
  },
  {
    id: '7b9',
    name: 'Dom 7b9',
    symbol: '7b9',
    category: 'Altered / Dim',
    tier: 'complex',
    intervals: [0, 4, 7, 10, 1],
    degrees: ['1', '3', '5', 'b7', 'b9'],
    description: 'Dramatic jazz altered dominant resolving to minor or major.',
  },
];

// Curated open cowboy voicings (indexed by `${rootPc}:${qualityId}`)
// frets: [6E, 5A, 4D, 3G, 2B, 1E], -1 = muted, 0 = open
const OPEN_VOICINGS = {
  '0:major': [{ label: 'Open C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] }],
  '2:major': [{ label: 'Open D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] }],
  '4:major': [{ label: 'Open E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] }],
  '7:major': [{ label: 'Open G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] }],
  '9:major': [{ label: 'Open A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] }],

  '2:minor': [{ label: 'Open Dm', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] }],
  '4:minor': [{ label: 'Open Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] }],
  '9:minor': [{ label: 'Open Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] }],

  '0:7': [{ label: 'Open C7', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] }],
  '2:7': [{ label: 'Open D7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] }],
  '4:7': [{ label: 'Open E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] }],
  '7:7': [{ label: 'Open G7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] }],
  '9:7': [{ label: 'Open A7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] }],
  '11:7': [{ label: 'Open B7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] }],

  '0:maj7': [{ label: 'Open Cmaj7', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] }],
  '2:maj7': [{ label: 'Open Dmaj7', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1] }],
  '4:maj7': [{ label: 'Open Emaj7', frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] }],
  '5:maj7': [{ label: 'Open Fmaj7', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] }],
  '7:maj7': [{ label: 'Open Gmaj7', frets: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3] }],
  '9:maj7': [{ label: 'Open Amaj7', frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] }],

  '2:m7': [{ label: 'Open Dm7', frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] }],
  '4:m7': [{ label: 'Open Em7', frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] }],
  '9:m7': [{ label: 'Open Am7', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] }],

  '2:sus2': [{ label: 'Open Dsus2', frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] }],
  '9:sus2': [{ label: 'Open Asus2', frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] }],
  '2:sus4': [{ label: 'Open Dsus4', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] }],
  '4:sus4': [{ label: 'Open Esus4', frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] }],
  '9:sus4': [{ label: 'Open Asus4', frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] }],

  '0:add9': [{ label: 'Open Cadd9', frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] }],
  '7:add9': [{ label: 'Open Gadd9', frets: [3, 2, 0, 2, 0, 3], fingers: [2, 1, 0, 3, 0, 4] }],
  '4:9': [{ label: 'Open E9', frets: [0, 2, 0, 1, 0, 2], fingers: [0, 2, 0, 1, 0, 3] }],
  '4:m_maj7': [{ label: 'Open Em(maj7)', frets: [0, 2, 1, 0, 0, 0], fingers: [0, 2, 1, 0, 0, 0] }],
  '9:m_maj7': [{ label: 'Open Am(maj7)', frets: [-1, 0, 2, 1, 1, 0], fingers: [0, 0, 3, 1, 2, 0] }],
  '11:dim': [{ label: 'Open Bdim', frets: [-1, 2, 3, 4, 3, -1], fingers: [0, 1, 2, 4, 3, 0] }],
  '4:5': [{ label: 'Open E5', frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0] }],
  '9:5': [{ label: 'Open A5', frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0] }],
  '2:5': [{ label: 'Open D5', frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 2, 0] }],
};

// Movable shape templates (offsets relative to `rootFret` where `null` = muted)
// rootString: 6 (E=4), 5 (A=9), or 4 (D=2)
const MOVABLE_SHAPES = {
  major: [
    { label: 'E-Shape Barre', rootString: 6, offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barre: { fretOffset: 0, from: 0, to: 5 } },
    { label: 'A-Shape Barre', rootString: 5, offsets: [null, 0, 2, 2, 2, 0], fingers: [0, 1, 2, 3, 4, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  minor: [
    { label: 'Em-Shape Barre', rootString: 6, offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], barre: { fretOffset: 0, from: 0, to: 5 } },
    { label: 'Am-Shape Barre', rootString: 5, offsets: [null, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  '5': [
    { label: '6th-String Power', rootString: 6, offsets: [0, 2, 2, null, null, null], fingers: [1, 3, 4, 0, 0, 0] },
    { label: '5th-String Power', rootString: 5, offsets: [null, 0, 2, 2, null, null], fingers: [0, 1, 3, 4, 0, 0] },
  ],
  sus2: [
    { label: 'A-Shape Sus2', rootString: 5, offsets: [null, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
    { label: 'D-Shape Sus2', rootString: 4, offsets: [null, null, 0, 2, 3, 0], fingers: [0, 0, 1, 2, 4, 1], barre: { fretOffset: 0, from: 2, to: 5 } },
  ],
  sus4: [
    { label: 'E-Shape Sus4', rootString: 6, offsets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1], barre: { fretOffset: 0, from: 0, to: 5 } },
    { label: 'A-Shape Sus4', rootString: 5, offsets: [null, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  '7': [
    { label: 'E7-Shape Barre', rootString: 6, offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barre: { fretOffset: 0, from: 0, to: 5 } },
    { label: 'A7-Shape Barre', rootString: 5, offsets: [null, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  maj7: [
    { label: '6th-String Maj7', rootString: 6, offsets: [0, null, 1, 1, 0, null], fingers: [1, 0, 3, 4, 2, 0] },
    { label: '5th-String Maj7', rootString: 5, offsets: [null, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  m7: [
    { label: 'Em7-Shape Barre', rootString: 6, offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barre: { fretOffset: 0, from: 0, to: 5 } },
    { label: 'Am7-Shape Barre', rootString: 5, offsets: [null, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  '7sus4': [
    { label: 'E-Shape 7sus4', rootString: 6, offsets: [0, 2, 0, 2, 0, 0], fingers: [1, 2, 1, 3, 1, 1], barre: { fretOffset: 0, from: 0, to: 5 } },
    { label: 'A-Shape 7sus4', rootString: 5, offsets: [null, 0, 2, 0, 3, 0], fingers: [0, 1, 2, 1, 4, 1], barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  '6': [
    { label: '6th-String Maj6', rootString: 6, offsets: [0, null, -1, 1, 0, null], fingers: [2, 0, 1, 4, 3, 0], minRootFret: 2 },
    { label: '5th-String Maj6', rootString: 5, offsets: [null, 0, 2, 2, 2, 2], fingers: [0, 1, 2, 2, 2, 2] },
  ],
  m6: [
    { label: '6th-String m6', rootString: 6, offsets: [0, null, -1, 0, 0, null], fingers: [2, 0, 1, 3, 4, 0], minRootFret: 2 },
    { label: '5th-String m6', rootString: 5, offsets: [null, 0, 2, 2, 1, 2], fingers: [0, 1, 2, 3, 1, 4] },
  ],
  add9: [
    { label: '6th-String Add9', rootString: 6, offsets: [0, 2, 4, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barre: { fretOffset: 0, from: 0, to: 5 } },
    { label: '5th-String Add9', rootString: 5, offsets: [null, 0, -1, -3, 0, null], fingers: [0, 3, 2, 1, 4, 0], minRootFret: 4 },
  ],
  m9: [
    { label: '5th-String m9', rootString: 5, offsets: [null, 0, -2, 0, 0, null], fingers: [0, 2, 1, 3, 4, 0], minRootFret: 3 },
    { label: '6th-String m9', rootString: 6, offsets: [0, 2, 0, 0, 0, 2], fingers: [1, 3, 1, 1, 1, 4], barre: { fretOffset: 0, from: 0, to: 5 } },
  ],
  maj9: [
    { label: '5th-String Maj9', rootString: 5, offsets: [null, 0, -1, 1, 0, null], fingers: [0, 2, 1, 4, 3, 0], minRootFret: 2 },
    { label: '6th-String Maj9', rootString: 6, offsets: [0, -1, 1, 1, null, null], fingers: [2, 1, 3, 4, 0, 0], minRootFret: 2 },
  ],
  dim: [
    { label: '5th-String Dim', rootString: 5, offsets: [null, 0, 1, 2, 1, null], fingers: [0, 1, 2, 4, 3, 0], minRootFret: 1 },
    { label: '6th-String Dim', rootString: 6, offsets: [0, 1, 2, 0, null, null], fingers: [1, 2, 3, 1, 0, 0], minRootFret: 1 },
    { label: '4th-String Dim', rootString: 4, offsets: [null, null, 0, 1, 3, 1], fingers: [0, 0, 1, 2, 4, 3], minRootFret: 1 },
  ],
  m7b5: [
    { label: '6th-String m7b5', rootString: 6, offsets: [0, null, 0, 0, -1, null], fingers: [2, 0, 3, 4, 1, 0], minRootFret: 2 },
    { label: '5th-String m7b5', rootString: 5, offsets: [null, 0, 1, 0, 1, null], fingers: [0, 1, 3, 2, 4, 0] },
  ],
  dim7: [
    { label: '6th-String Dim7', rootString: 6, offsets: [0, null, -1, 0, -1, null], fingers: [2, 0, 1, 3, 1, 0], minRootFret: 2 },
    { label: '5th-String Dim7', rootString: 5, offsets: [null, 0, 1, -1, 1, null], fingers: [0, 2, 3, 1, 4, 0], minRootFret: 2 },
  ],
  aug: [
    { label: '6th-String Aug', rootString: 6, offsets: [0, -1, -2, -3, null, null], fingers: [4, 3, 2, 1, 0, 0], minRootFret: 3 },
    { label: '5th-String Aug', rootString: 5, offsets: [null, 0, -1, -2, -2, null], fingers: [0, 4, 3, 1, 2, 0], minRootFret: 2 },
  ],
  m_maj7: [
    { label: '5th-String m(maj7)', rootString: 5, offsets: [null, 0, 2, 1, 1, null], fingers: [0, 1, 4, 2, 3, 0], minRootFret: 1 },
    { label: '6th-String m(maj7)', rootString: 6, offsets: [0, null, 1, 0, 0, null], fingers: [1, 0, 4, 2, 3, 0], minRootFret: 1 },
  ],
  '9': [
    { label: '5th-String Dom9', rootString: 5, offsets: [null, 0, -1, 0, 0, 0], fingers: [0, 2, 1, 3, 3, 3], minRootFret: 2 },
    { label: '6th-String Dom9', rootString: 6, offsets: [0, -1, 0, -1, null, null], fingers: [2, 1, 3, 1, 0, 0], minRootFret: 2 },
  ],
  '13': [
    { label: '6th-String Dom13', rootString: 6, offsets: [0, null, 0, 1, 2, null], fingers: [1, 0, 2, 3, 4, 0], minRootFret: 1 },
    { label: '5th-String Dom13', rootString: 5, offsets: [null, 0, 2, 0, 2, 2], fingers: [0, 1, 3, 1, 4, 4], minRootFret: 1, barre: { fretOffset: 0, from: 1, to: 5 } },
  ],
  m11: [
    { label: '5th-String m11', rootString: 5, offsets: [null, 0, 0, 0, 1, null], fingers: [0, 1, 1, 1, 2, 0], minRootFret: 1 },
    { label: '6th-String m11', rootString: 6, offsets: [0, null, 0, 0, -2, null], fingers: [2, 0, 3, 4, 1, 0], minRootFret: 3 },
  ],
  '6_9': [
    { label: '5th-String 6/9', rootString: 5, offsets: [null, 0, -1, -1, 0, 0], fingers: [0, 2, 1, 1, 3, 4], minRootFret: 2 },
    { label: '6th-String 6/9', rootString: 6, offsets: [0, -1, -1, -1, 0, null], fingers: [2, 1, 1, 1, 3, 0], minRootFret: 2 },
  ],
  '7sharp9': [
    { label: '5th-String 7#9 (Hendrix)', rootString: 5, offsets: [null, 0, -1, 0, 1, null], fingers: [0, 2, 1, 3, 4, 0], minRootFret: 2 },
  ],
  '7b9': [
    { label: '5th-String 7b9', rootString: 5, offsets: [null, 0, -1, 0, -1, null], fingers: [0, 2, 1, 3, 1, 0], minRootFret: 2 },
    { label: '4th-String 7b9', rootString: 4, offsets: [null, null, 0, -1, 1, -1], fingers: [0, 0, 3, 1, 4, 2], minRootFret: 2 },
  ],
};

// Curated open Ukulele voicings (G4-C4-E4-A4)
const UKE_OPEN_VOICINGS = {
  '0:major': [{ label: 'Open C', frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3] }],
  '2:major': [{ label: 'Open D', frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0] }],
  '4:major': [{ label: 'Open E', frets: [1, 4, 0, 2], fingers: [1, 4, 0, 2] }],
  '5:major': [{ label: 'Open F', frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0] }],
  '7:major': [{ label: 'Open G', frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2] }],
  '9:major': [{ label: 'Open A', frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0] }],
  '10:major': [{ label: 'Bb Barre', frets: [3, 2, 1, 1], fingers: [3, 2, 1, 1] }],

  '0:minor': [{ label: 'Cm Position', frets: [0, 3, 3, 3], fingers: [0, 1, 2, 3] }],
  '2:minor': [{ label: 'Open Dm', frets: [2, 2, 1, 0], fingers: [2, 3, 1, 0] }],
  '4:minor': [{ label: 'Open Em', frets: [0, 4, 3, 2], fingers: [0, 3, 2, 1] }],
  '5:minor': [{ label: 'Open Fm', frets: [1, 0, 1, 3], fingers: [1, 0, 2, 4] }],
  '7:minor': [{ label: 'Open Gm', frets: [0, 2, 3, 1], fingers: [0, 2, 3, 1] }],
  '9:minor': [{ label: 'Open Am', frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0] }],

  '0:7': [{ label: 'Open C7', frets: [0, 0, 0, 1], fingers: [0, 0, 0, 1] }],
  '2:7': [{ label: 'Open D7', frets: [2, 2, 2, 3], fingers: [1, 1, 1, 2] }],
  '4:7': [{ label: 'Open E7', frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3] }],
  '5:7': [{ label: 'Open F7', frets: [2, 3, 1, 3], fingers: [2, 3, 1, 4] }],
  '7:7': [{ label: 'Open G7', frets: [0, 2, 1, 2], fingers: [0, 2, 1, 3] }],
  '9:7': [{ label: 'Open A7', frets: [0, 1, 0, 0], fingers: [0, 1, 0, 0] }],
  '11:7': [{ label: 'B7 Position', frets: [2, 3, 2, 2], fingers: [1, 2, 1, 1] }],

  '0:maj7': [{ label: 'Open Cmaj7', frets: [0, 0, 0, 2], fingers: [0, 0, 0, 2] }],
  '5:maj7': [{ label: 'Open Fmaj7', frets: [2, 4, 1, 3], fingers: [2, 4, 1, 3] }],
  '7:maj7': [{ label: 'Open Gmaj7', frets: [0, 2, 2, 2], fingers: [0, 1, 2, 3] }],
  '9:maj7': [{ label: 'Open Amaj7', frets: [1, 1, 0, 0], fingers: [1, 2, 0, 0] }],

  '2:m7': [{ label: 'Open Dm7', frets: [2, 2, 1, 3], fingers: [2, 3, 1, 4] }],
  '4:m7': [{ label: 'Open Em7', frets: [0, 2, 0, 2], fingers: [0, 1, 0, 2] }],
  '9:m7': [{ label: 'Open Am7', frets: [0, 0, 0, 0], fingers: [0, 0, 0, 0] }],

  '0:sus4': [{ label: 'Open Csus4', frets: [0, 0, 1, 3], fingers: [0, 0, 1, 3] }],
  '7:sus4': [{ label: 'Open Gsus4', frets: [0, 2, 3, 3], fingers: [0, 1, 2, 3] }],
  '7:sus2': [{ label: 'Open Gsus2', frets: [0, 2, 3, 0], fingers: [0, 1, 2, 0] }],
  '9:sus4': [{ label: 'Open Asus4', frets: [2, 2, 0, 0], fingers: [1, 2, 0, 0] }],
  '2:sus2': [{ label: 'Open Dsus2', frets: [2, 2, 0, 0], fingers: [1, 2, 0, 0] }],
  '0:6': [{ label: 'Open C6', frets: [0, 0, 0, 0], fingers: [0, 0, 0, 0] }],
  '9:dim7': [{ label: 'Adim7 Open', frets: [2, 3, 2, 3], fingers: [1, 3, 2, 4] }],
};

// Curated Bass 4-string chord voicings (E1-A1-D2-G2)
// Idiomatic bass voicings: 10th Shells (mute A, root on E, 3rd/b3 on G), upper-register triads,
// Root-5th-Octave Power shapes, and Dom7/Maj7/m7/m6 shells respecting the Low-Interval Limit.
const BASS_OPEN_VOICINGS = {
  // All 12 Major roots default to 1 simple Root Note (easy low-neck frets 0-4);
  // connecting bass shapes (Root + 5th, Root + Octave, 10th Shell, Upper Triad) live in variations.
  '0:major': [
    { label: 'Root Note (C)', frets: [-1, 3, -1, -1], fingers: [0, 3, 0, 0] },
    { label: 'Root + 5th', frets: [-1, 3, 5, -1], fingers: [0, 1, 3, 0] },
    { label: 'Root + Octave', frets: [-1, 3, -1, 5], fingers: [0, 1, 0, 3] },
    { label: '10th Shell (A-Root)', frets: [-1, 3, 2, 0], fingers: [0, 3, 2, 0] },
    { label: '10th Shell (E-Root)', frets: [8, -1, 10, 9], fingers: [1, 0, 3, 2] },
  ],
  '1:major': [
    { label: 'Root Note (C#/Db)', frets: [-1, 4, -1, -1], fingers: [0, 4, 0, 0] },
    { label: 'Root + 5th', frets: [-1, 4, 6, -1], fingers: [0, 1, 3, 0] },
    { label: 'Root + Octave', frets: [-1, 4, -1, 6], fingers: [0, 1, 0, 3] },
  ],
  '2:major': [
    { label: 'Root Note (Open D)', frets: [-1, -1, 0, -1], fingers: [0, 0, 0, 0] },
    { label: 'Root + 5th', frets: [-1, -1, 0, 2], fingers: [0, 0, 0, 2] },
    { label: 'Root + Octave', frets: [-1, 5, -1, 7], fingers: [0, 1, 0, 3] },
    { label: 'Upper Triad (A-Root)', frets: [-1, 5, 4, 2], fingers: [0, 4, 3, 1] },
    { label: '10th Shell (E-Root)', frets: [10, -1, 12, 11], fingers: [1, 0, 3, 2] },
  ],
  '3:major': [
    { label: 'Root Note (Eb/D#)', frets: [-1, -1, 1, -1], fingers: [0, 0, 1, 0] },
    { label: 'Root + 5th', frets: [-1, -1, 1, 3], fingers: [0, 0, 1, 3] },
    { label: 'Root + Octave', frets: [-1, 6, -1, 8], fingers: [0, 1, 0, 3] },
  ],
  '4:major': [
    { label: 'Root Note (Open E)', frets: [0, -1, -1, -1], fingers: [0, 0, 0, 0] },
    { label: 'Root + 5th', frets: [0, 2, -1, -1], fingers: [0, 1, 0, 0] },
    { label: 'Root + Octave', frets: [0, -1, 2, -1], fingers: [0, 0, 2, 0] },
    { label: '10th Shell (Open E)', frets: [0, -1, 2, 1], fingers: [0, 0, 2, 1] },
    { label: 'Upper Triad (A-Root)', frets: [-1, 7, 6, 4], fingers: [0, 4, 3, 1] },
  ],
  '5:major': [
    { label: 'Root Note (F)', frets: [1, -1, -1, -1], fingers: [1, 0, 0, 0] },
    { label: 'Root + 5th', frets: [1, 3, -1, -1], fingers: [1, 3, 0, 0] },
    { label: 'Root + Octave', frets: [1, -1, 3, -1], fingers: [1, 0, 3, 0] },
    { label: '10th Shell (E-Root)', frets: [1, -1, 3, 2], fingers: [1, 0, 3, 2] },
    { label: 'Upper Triad (A-Root)', frets: [-1, 8, 7, 5], fingers: [0, 4, 3, 1] },
  ],
  '6:major': [
    { label: 'Root Note (F#/Gb)', frets: [2, -1, -1, -1], fingers: [1, 0, 0, 0] },
    { label: 'Root + 5th', frets: [2, 4, -1, -1], fingers: [1, 3, 0, 0] },
    { label: 'Root + Octave', frets: [2, -1, 4, -1], fingers: [1, 0, 3, 0] },
  ],
  '7:major': [
    { label: 'Root Note (G)', frets: [3, -1, -1, -1], fingers: [2, 0, 0, 0] },
    { label: 'Root + 5th', frets: [3, 5, -1, -1], fingers: [1, 3, 0, 0] },
    { label: 'Root + Octave', frets: [3, -1, 5, -1], fingers: [1, 0, 3, 0] },
    { label: '10th Shell (E-Root)', frets: [3, -1, 5, 4], fingers: [1, 0, 3, 2] },
    { label: 'Upper Triad (A-Root)', frets: [-1, 10, 9, 7], fingers: [0, 4, 3, 1] },
  ],
  '8:major': [
    { label: 'Root Note (G#/Ab)', frets: [4, -1, -1, -1], fingers: [2, 0, 0, 0] },
    { label: 'Root + 5th', frets: [4, 6, -1, -1], fingers: [1, 3, 0, 0] },
    { label: 'Root + Octave', frets: [4, -1, 6, -1], fingers: [1, 0, 3, 0] },
  ],
  '9:major': [
    { label: 'Root Note (Open A)', frets: [-1, 0, -1, -1], fingers: [0, 0, 0, 0] },
    { label: 'Root + 5th', frets: [-1, 0, 2, -1], fingers: [0, 0, 1, 0] },
    { label: 'Root + Octave', frets: [-1, 0, -1, 2], fingers: [0, 0, 0, 2] },
    { label: '10th Shell (E-Root)', frets: [5, -1, 7, 6], fingers: [1, 0, 3, 2] },
    { label: 'Upper Triad (A-Root)', frets: [-1, 12, 11, 9], fingers: [0, 4, 3, 1] },
  ],
  '10:major': [
    { label: 'Root Note (Bb/A#)', frets: [-1, 1, -1, -1], fingers: [0, 1, 0, 0] },
    { label: 'Root + 5th', frets: [-1, 1, 3, -1], fingers: [0, 1, 3, 0] },
    { label: 'Root + Octave', frets: [-1, 1, -1, 3], fingers: [0, 1, 0, 3] },
  ],
  '11:major': [
    { label: 'Root Note (B)', frets: [-1, 2, -1, -1], fingers: [0, 1, 0, 0] },
    { label: 'Root + 5th', frets: [-1, 2, 4, -1], fingers: [0, 1, 3, 0] },
    { label: 'Root + Octave', frets: [-1, 2, -1, 4], fingers: [0, 1, 0, 3] },
    { label: '10th Shell (E-Root)', frets: [7, -1, 9, 8], fingers: [1, 0, 3, 2] },
  ],
  '0:minor': [
    { label: 'Cm Upper Triad (A-Root)', frets: [-1, 3, 1, 0], fingers: [0, 3, 1, 0] },
    { label: 'Cm 10th Shell (E-Root)', frets: [8, -1, 10, 8], fingers: [1, 0, 3, 1] },
  ],
  '2:minor': [
    { label: 'Dm Upper Triad (A-Root)', frets: [-1, 5, 3, 2], fingers: [0, 4, 2, 1] },
    { label: 'Dm 10th Shell (E-Root)', frets: [10, -1, 12, 10], fingers: [1, 0, 3, 1] },
  ],
  '4:minor': [
    { label: 'Open Em 10th Shell', frets: [0, -1, 2, 0], fingers: [0, 0, 1, 0] },
    { label: 'Em Upper Triad (A-Root)', frets: [-1, 7, 5, 4], fingers: [0, 4, 2, 1] },
  ],
  '5:minor': [
    { label: 'Fm 10th Shell (E-Root)', frets: [1, -1, 3, 1], fingers: [1, 0, 3, 1] },
    { label: 'Fm Upper Triad (A-Root)', frets: [-1, 8, 6, 5], fingers: [0, 4, 2, 1] },
  ],
  '7:minor': [
    { label: 'Gm 10th Shell (E-Root)', frets: [3, -1, 5, 3], fingers: [1, 0, 3, 1] },
    { label: 'Gm Upper Triad (A-Root)', frets: [-1, 10, 8, 7], fingers: [0, 4, 2, 1] },
  ],
  '9:minor': [
    { label: 'Am 10th Shell (E-Root)', frets: [5, -1, 7, 5], fingers: [1, 0, 3, 1] },
    { label: 'Am Upper Triad (A-Root)', frets: [-1, 12, 10, 9], fingers: [0, 4, 2, 1] },
  ],
  '11:minor': [
    { label: 'Bm 10th Shell (E-Root)', frets: [7, -1, 9, 7], fingers: [1, 0, 3, 1] },
  ],
  '0:maj7': [
    { label: 'Cmaj7 Shell (A-Root)', frets: [-1, 3, 2, 4], fingers: [0, 2, 1, 3] },
    { label: 'Cmaj7 Shell (E-Root)', frets: [8, -1, 9, 9], fingers: [1, 0, 2, 3] },
  ],
  '7:7': [
    { label: 'G7 Shell (E-Root)', frets: [3, -1, 3, 4], fingers: [1, 0, 2, 3] },
  ],
  '0:7': [
    { label: 'C7 Shell (A-Root)', frets: [-1, 3, 2, 3], fingers: [0, 3, 1, 2] },
    { label: 'C7 Shell (E-Root)', frets: [8, -1, 8, 9], fingers: [1, 0, 2, 3] },
  ],
  '4:m7': [
    { label: 'Open Em7 Shell', frets: [0, -1, 0, 0], fingers: [0, 0, 0, 0] },
  ],
  '9:m7': [
    { label: 'Am7 Shell (E-Root)', frets: [5, -1, 5, 5], fingers: [1, 0, 2, 3] },
  ],
  '2:m7': [
    { label: 'Dm7 Shell (A-Root)', frets: [-1, 5, 3, 5], fingers: [0, 3, 1, 4] },
  ],
  '0:m7': [
    { label: 'Cm7 Shell (A-Root)', frets: [-1, 3, 1, 3], fingers: [0, 3, 1, 4] },
  ],
  '4:5': [
    { label: 'Open E5 Dyad (R+5)', frets: [0, 2, -1, -1], fingers: [0, 1, 0, 0] },
    { label: 'Open E5 Power (R-5-8)', frets: [0, 2, 2, -1], fingers: [0, 1, 2, 0] },
    { label: 'E5 Dyad (A-Root)', frets: [-1, 7, 9, -1], fingers: [0, 1, 3, 0] },
  ],
  '9:5': [
    { label: 'Open A5 Dyad (R+5)', frets: [-1, 0, 2, -1], fingers: [0, 0, 1, 0] },
    { label: 'Open A5 Power (R-5-8)', frets: [-1, 0, 2, 2], fingers: [0, 0, 1, 2] },
    { label: 'A5 Power (E-Root)', frets: [5, 7, 7, -1], fingers: [1, 3, 4, 0] },
  ],
  '2:5': [
    { label: 'Open D5 Dyad (R+5)', frets: [-1, -1, 0, 2], fingers: [0, 0, 0, 1] },
    { label: 'D5 Power (A-Root)', frets: [-1, 5, 7, 7], fingers: [0, 1, 3, 4] },
  ],
  '7:5': [
    { label: 'G5 Dyad (R+5)', frets: [3, 5, -1, -1], fingers: [1, 3, 0, 0] },
    { label: 'G5 Power (R-5-8)', frets: [3, 5, 5, -1], fingers: [1, 3, 4, 0] },
    { label: 'Open G5 Shell', frets: [3, -1, 0, 0], fingers: [1, 0, 0, 0] },
  ],
  '0:5': [
    { label: 'C5 Dyad (R+5)', frets: [-1, 3, 5, -1], fingers: [0, 1, 3, 0] },
    { label: 'C5 Power (A-Root)', frets: [-1, 3, 5, 5], fingers: [0, 1, 3, 4] },
    { label: 'C5 Power (E-Root)', frets: [8, 10, 10, -1], fingers: [1, 3, 4, 0] },
  ],
};

// Movable 4-string Bass shell shapes (R-8-10th, R-5-8 Power, R-b7-10th, R-M7-10th)
const BASS_MOVABLE_SHAPES = {
  major: [
    { label: '10th Shell (E-Root)', rootString: 4, offsets: [0, null, 2, 1], fingers: [1, 0, 3, 2], minRootFret: 0 },
    { label: 'Upper Triad (A-Root)', rootString: 3, offsets: [null, 0, -1, -3], fingers: [0, 4, 3, 1], minRootFret: 3 },
  ],
  minor: [
    { label: 'Minor 10th Shell (E-Root)', rootString: 4, offsets: [0, null, 2, 0], fingers: [1, 0, 3, 1], minRootFret: 0 },
    { label: 'Minor Upper Triad (A-Root)', rootString: 3, offsets: [null, 0, -2, -3], fingers: [0, 4, 2, 1], minRootFret: 3 },
  ],
  '5': [
    { label: 'R-5-8 Power (E-Root)', rootString: 4, offsets: [0, 2, 2, null], fingers: [1, 3, 4, 0], minRootFret: 0 },
    { label: 'R-5-8 Power (A-Root)', rootString: 3, offsets: [null, 0, 2, 2], fingers: [0, 1, 3, 4], minRootFret: 0 },
  ],
  '7': [
    { label: 'Dom7 Shell (E-Root)', rootString: 4, offsets: [0, null, 0, 1], fingers: [1, 0, 2, 3], minRootFret: 1 },
    { label: 'Dom7 Shell (A-Root)', rootString: 3, offsets: [null, 0, -1, 0], fingers: [0, 3, 1, 2], minRootFret: 3 },
  ],
  maj7: [
    { label: 'Maj7 Shell (E-Root)', rootString: 4, offsets: [0, null, 1, 1], fingers: [1, 0, 2, 3], minRootFret: 1 },
    { label: 'Maj7 Shell (A-Root)', rootString: 3, offsets: [null, 0, -1, 1], fingers: [0, 2, 1, 4], minRootFret: 3 },
  ],
  m7: [
    { label: 'Min7 Shell (E-Root)', rootString: 4, offsets: [0, null, 0, 0], fingers: [1, 0, 2, 3], minRootFret: 0 },
    { label: 'Min7 Shell (A-Root)', rootString: 3, offsets: [null, 0, -2, 0], fingers: [0, 3, 1, 4], minRootFret: 3 },
  ],
  m6: [
    { label: 'Min6 Shell (E-Root)', rootString: 4, offsets: [0, null, -1, 0], fingers: [2, 0, 1, 3], minRootFret: 1 },
    { label: 'Min6 Shell (A-Root)', rootString: 3, offsets: [null, 0, -2, -1], fingers: [0, 3, 1, 2], minRootFret: 3 },
  ],
  m_maj7: [
    { label: 'm(maj7) Shell (E-Root)', rootString: 4, offsets: [0, null, 1, 0], fingers: [1, 0, 3, 2], minRootFret: 0 },
    { label: 'm(maj7) Shell (A-Root)', rootString: 3, offsets: [null, 0, -2, 1], fingers: [0, 3, 1, 4], minRootFret: 3 },
  ],
  sus4: [
    { label: 'Sus4 Shell (E-Root)', rootString: 4, offsets: [0, null, 2, 2], fingers: [1, 0, 3, 4], minRootFret: 0 },
    { label: 'Sus4 Shell (A-Root)', rootString: 3, offsets: [null, 0, 0, 2], fingers: [0, 1, 1, 3], minRootFret: 3 },
  ],
  sus2: [
    { label: 'Sus2 Shell (E-Root)', rootString: 4, offsets: [0, 2, null, -1], fingers: [2, 4, 0, 1], minRootFret: 1 },
    { label: 'Sus2 Triad (A-Root)', rootString: 3, offsets: [null, 0, 2, -3], fingers: [0, 2, 4, 1], minRootFret: 3 },
  ],
  '7sus4': [
    { label: '7sus4 Shell (E-Root)', rootString: 4, offsets: [0, null, 0, 2], fingers: [1, 0, 2, 4], minRootFret: 1 },
    { label: '7sus4 Shell (A-Root)', rootString: 3, offsets: [null, 0, 0, 0], fingers: [0, 1, 1, 1], minRootFret: 3 },
  ],
  '6': [
    { label: 'Maj6 Shell (E-Root)', rootString: 4, offsets: [0, null, -1, 1], fingers: [2, 0, 1, 3], minRootFret: 2 },
    { label: 'Maj6 Shell (A-Root)', rootString: 3, offsets: [null, 0, -1, -1], fingers: [0, 2, 1, 1], minRootFret: 3 },
  ],
};

function computeWindow(frets) {
  const pressed = frets.filter((f) => f > 0);
  if (pressed.length === 0) return { startFret: 1 };
  const minF = Math.min(...pressed);
  const maxF = Math.max(...pressed);
  if (maxF <= 4) return { startFret: 1 };
  return { startFret: minF };
}

function getRootFretForString(rootPc, rootString, minRootFret = 0, openMidi = STANDARD_OPEN_MIDI) {
  const idx = openMidi.length - rootString;
  const openPc =
    idx >= 0 && idx < openMidi.length
      ? ((openMidi[idx] % 12) + 12) % 12
      : rootString === 6
        ? 4
        : rootString === 5
          ? 9
          : 2;
  let fret = ((rootPc - openPc) % 12 + 12) % 12;
  while (fret < minRootFret) {
    fret += 12;
  }
  return fret;
}

function assignFourStringFingers(frets) {
  const pressed = frets.filter((f) => f > 0);
  if (pressed.length === 0) return { fingers: [0, 0, 0, 0], barre: null };

  const minPressed = Math.min(...pressed);
  const distinctPressed = [...new Set(pressed)].sort((a, b) => a - b);

  // Check if lowest fret can be barred cleanly (multiple strings on minPressed, no open string blocking middle)
  const minIndices = frets
    .map((f, idx) => (f === minPressed ? idx : -1))
    .filter((idx) => idx >= 0);

  let barre = null;
  const fretToFinger = new Map();

  if (minIndices.length >= 2) {
    const firstIdx = minIndices[0];
    const lastIdx = minIndices[minIndices.length - 1];
    const blocked = frets
      .slice(firstIdx, lastIdx + 1)
      .some((f) => f === 0 || f === -1);

    if (!blocked && distinctPressed.length <= 4) {
      if (lastIdx - firstIdx >= 1) {
        barre = { fret: minPressed, fromString: firstIdx, toString: lastIdx };
      }
      distinctPressed.forEach((fr, idx) => {
        fretToFinger.set(fr, Math.min(4, idx + 1));
      });
      return {
        fingers: frets.map((f) => (f > 0 ? fretToFinger.get(f) || 1 : 0)),
        barre,
      };
    }
  }

  // Assign distinct fingers 1..4 ordered by fret then string
  let nextFinger = 1;
  const fingers = [0, 0, 0, 0];
  for (const fr of distinctPressed) {
    for (let s = 0; s < 4; s++) {
      if (frets[s] === fr) {
        fingers[s] = Math.min(4, nextFinger);
        if (nextFinger < 4) nextFinger += 1;
      }
    }
  }
  return { fingers, barre: null };
}

function solveFourStringVoicings(safeRoot, quality, openMidi, instrumentId, maxResults = 2) {
  const expectedPcs = new Set(quality.intervals.map((semi) => (safeRoot + semi) % 12));
  const extPc =
    quality.intervals.length >= 5
      ? (safeRoot + quality.intervals[4]) % 12
      : null;
  const thirdOrSusPc =
    quality.intervals.length >= 2
      ? (safeRoot + quality.intervals[1]) % 12
      : null;
  const seventhOrSixthPc =
    quality.intervals.length >= 4
      ? (safeRoot + quality.intervals[3]) % 12
      : null;

  const allowMute = instrumentId === 'bass';
  const minSoundingNotes = instrumentId === 'bass' ? 2 : 4;
  const fallbackMinNotes = instrumentId === 'bass' ? 2 : 3;

  const candidates = [];
  const seenKeys = new Set();

  for (const maxSpan of [3, 4]) {
    for (let winStart = 1; winStart <= 11; winStart++) {
      const winEnd = Math.min(15, winStart + maxSpan);
      const perStringChoices = openMidi.map((openM) => {
        const opts = [];
        // Allow open string when in low position
        if (winStart <= 2 && expectedPcs.has(((openM % 12) + 12) % 12)) {
          opts.push(0);
        }
        for (let f = winStart; f <= winEnd; f++) {
          if (expectedPcs.has(((openM + f) % 12 + 12) % 12)) {
            opts.push(f);
          }
        }
        if (allowMute) opts.push(-1);
        else if (winStart <= 4) opts.push(-1);
        return opts;
      });

      for (const f0 of perStringChoices[0]) {
        for (const f1 of perStringChoices[1]) {
          for (const f2 of perStringChoices[2]) {
            for (const f3 of perStringChoices[3]) {
              const frets = [f0, f1, f2, f3];
              const key = frets.join(',');
              if (seenKeys.has(key)) continue;

              const pressed = frets.filter((f) => f > 0);
              const span =
                pressed.length > 0 ? Math.max(...pressed) - Math.min(...pressed) : 0;
              if (span > maxSpan) continue;

              const sounding = [];
              for (let s = 0; s < 4; s++) {
                if (frets[s] >= 0) {
                  sounding.push({
                    s,
                    fret: frets[s],
                    midi: openMidi[s] + frets[s],
                    pc: ((openMidi[s] + frets[s]) % 12 + 12) % 12,
                  });
                }
              }
              if (sounding.length < fallbackMinNotes) continue;

              // Forbid internal muted string sandwiched between active strings (e.g. [1, -1, 2, 1]) on ukulele
              const activeStrings = sounding.map((item) => item.s);
              const minS = Math.min(...activeStrings);
              const maxS = Math.max(...activeStrings);
              const hasSandwichedMute = frets.slice(minS, maxS + 1).includes(-1);
              if (hasSandwichedMute && instrumentId === 'ukulele') continue;

              const coveredPcs = new Set(sounding.map((item) => item.pc));
              if (!coveredPcs.has(safeRoot)) continue;

              // Defining interval (3rd / sus2 / sus4 / 5) must be present so chords never collapse to power chords
              if (thirdOrSusPc !== null && !coveredPcs.has(thirdOrSusPc)) continue;

              // Bass Guitar Low-Interval Limit: forbid tight intervals (< 7 semitones) below C2 (MIDI 36)
              if (instrumentId === 'bass') {
                const sortedMidi = sounding.map((item) => item.midi).sort((a, b) => a - b);
                let violatesLowLimit = false;
                for (let idx = 0; idx < sortedMidi.length - 1; idx++) {
                  if (sortedMidi[idx] < 36 && sortedMidi[idx + 1] - sortedMidi[idx] < 7) {
                    violatesLowLimit = true;
                    break;
                  }
                }
                if (violatesLowLimit) continue;
                if (seventhOrSixthPc !== null && !coveredPcs.has(seventhOrSixthPc)) continue;
              }

              const minDistinctReq = Math.min(expectedPcs.size, Math.min(4, sounding.length));
              const strictDistinct =
                expectedPcs.size <= 4 ? expectedPcs.size : 4;
              if (coveredPcs.size < Math.min(minDistinctReq, strictDistinct - 1)) {
                continue;
              }
              if (extPc !== null && !coveredPcs.has(extPc)) continue;

              const { fingers, barre } = assignFourStringFingers(frets);
              const nonZeroFingers = fingers.filter((fn) => fn > 0);
              if (nonZeroFingers.length > 4 && !barre) continue;

              seenKeys.add(key);

              // Score ergonomics & harmonic completeness
              let score = 0;
              score += coveredPcs.size * 50;
              if (coveredPcs.size >= strictDistinct) score += 80;
              if (thirdOrSusPc !== null && coveredPcs.has(thirdOrSusPc)) score += 35;
              if (seventhOrSixthPc !== null && coveredPcs.has(seventhOrSixthPc)) score += 30;
              if (extPc !== null && coveredPcs.has(extPc)) score += 45;
              if (sounding.length >= minSoundingNotes) score += 40;
              if (instrumentId !== 'bass' && !frets.includes(-1)) score += 25;
              if (instrumentId === 'bass' && sounding.length === 3) score += 20;
              if (hasSandwichedMute && instrumentId !== 'bass') score -= 22;

              // Prefer lowest note being the root (especially important on Bass!)
              const lowestMidi = sounding.reduce(
                (best, cur) => (cur.midi < best.midi ? cur : best),
                sounding[0]
              );
              if (lowestMidi.pc === safeRoot) {
                score += instrumentId === 'bass' ? 85 : 22;
              }

              // Prefer low fret positions & compact finger stretches
              const avgFret =
                pressed.length > 0
                  ? pressed.reduce((a, b) => a + b, 0) / pressed.length
                  : 0;
              score -= avgFret * 4.5;
              score -= span * 6;
              if (frets.includes(0)) score += 8;

              const { startFret } = computeWindow(frets);
              const labelPrefix =
                instrumentId === 'bass'
                  ? startFret === 1 && frets.includes(0)
                    ? 'Open Shell'
                    : `Shell (Fr ${startFret})`
                  : startFret === 1 && frets.includes(0)
                    ? 'Open Position'
                    : `Position (Fr ${startFret})`;

              candidates.push({
                score,
                voicing: {
                  label: labelPrefix,
                  frets,
                  fingers,
                  barre,
                  startFret,
                  midiNotes: sounding.map((item) => item.midi),
                  openMidi,
                },
              });
            }
          }
        }
      }
    }
    if (candidates.length >= maxResults) break;
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  const usedStartFrets = new Set();
  for (const cand of candidates) {
    if (selected.length >= maxResults) break;
    // Encourage variety across fretboard positions when picking a 2nd voicing
    if (
      selected.length > 0 &&
      usedStartFrets.has(cand.voicing.startFret) &&
      candidates.some((alt) => !usedStartFrets.has(alt.voicing.startFret) && alt.score >= cand.score - 25)
    ) {
      continue;
    }
    usedStartFrets.add(cand.voicing.startFret);
    selected.push(cand.voicing);
  }
  return selected;
}

export function getChordVoicings(
  rootPc,
  qualityId,
  preferFlatsOverride = null,
  instrumentId = 'guitar'
) {
  const config = getInstrumentConfig(instrumentId);
  const safeRoot = ((rootPc % 12) + 12) % 12;
  const preferFlats =
    preferFlatsOverride === null ? shouldPreferFlats(safeRoot) : preferFlatsOverride;
  const quality = CHORD_QUALITIES.find((q) => q.id === qualityId) || CHORD_QUALITIES[0];
  const rootName = getNoteName(safeRoot, preferFlats);
  const symbol = `${rootName}${quality.symbol}`;

  const voicings = [];
  const openKey = `${safeRoot}:${quality.id}`;

  if (config.id === 'guitar') {
    if (OPEN_VOICINGS[openKey]) {
      for (const v of OPEN_VOICINGS[openKey]) {
        const { startFret } = computeWindow(v.frets);
        const midiNotes = v.frets
          .map((f, idx) => (f >= 0 ? config.openMidi[idx] + f : null))
          .filter((m) => m !== null);
        voicings.push({
          label: v.label,
          frets: v.frets,
          fingers: v.fingers,
          barre: null,
          startFret,
          midiNotes,
          openMidi: config.openMidi,
        });
      }
    }

    const templates = MOVABLE_SHAPES[quality.id] || [];
    for (const tpl of templates) {
      const minRoot = Math.max(tpl.minRootFret || 0, tpl.barre ? 1 : 0);
      const rootFret = getRootFretForString(safeRoot, tpl.rootString, minRoot, config.openMidi);
      const frets = tpl.offsets.map((off) => (off === null ? -1 : rootFret + off));
      if (frets.some((f) => f > 15)) continue;

      const key = frets.join(',');
      if (voicings.some((v) => v.frets.join(',') === key)) continue;

      const { startFret } = computeWindow(frets);
      const barre =
        tpl.barre && rootFret > 0
          ? {
              fret: rootFret + tpl.barre.fretOffset,
              fromString: tpl.barre.from,
              toString: tpl.barre.to,
            }
          : null;

      const midiNotes = frets
        .map((f, idx) => (f >= 0 ? config.openMidi[idx] + f : null))
        .filter((m) => m !== null);

      voicings.push({
        label: `${tpl.label} (Fr ${rootFret})`,
        frets,
        fingers: tpl.fingers,
        barre,
        startFret,
        midiNotes,
        openMidi: config.openMidi,
      });
    }
  } else {
    const openMap = config.id === 'ukulele' ? UKE_OPEN_VOICINGS : BASS_OPEN_VOICINGS;
    const expectedPcs = new Set(quality.intervals.map((semi) => (safeRoot + semi) % 12));
    const requiredThirdPc =
      quality.intervals.length >= 2 ? (safeRoot + quality.intervals[1]) % 12 : null;

    if (openMap[openKey]) {
      const allowCuratedMajorBassSimplification =
        config.id === 'bass' && quality.id === 'major';
      for (const v of openMap[openKey]) {
        const midiNotes = v.frets
          .map((f, idx) => (f >= 0 ? config.openMidi[idx] + f : null))
          .filter((m) => m !== null);
        const pcs = new Set(midiNotes.map((m) => ((m % 12) + 12) % 12));
        const allValid = midiNotes.every((m) => expectedPcs.has(((m % 12) + 12) % 12));
        const hasRequired = allowCuratedMajorBassSimplification
          ? pcs.has(safeRoot)
          : pcs.has(safeRoot) && (requiredThirdPc === null || pcs.has(requiredThirdPc));
        if (!allValid || !hasRequired) continue;
        const { startFret } = computeWindow(v.frets);
        voicings.push({
          label: v.label,
          frets: v.frets,
          fingers: v.fingers,
          barre: null,
          startFret,
          midiNotes,
          openMidi: config.openMidi,
        });
      }
    }

    if (config.id === 'bass') {
      const bassTemplates = BASS_MOVABLE_SHAPES[quality.id] || [];
      for (const tpl of bassTemplates) {
        const rootFret = getRootFretForString(
          safeRoot,
          tpl.rootString,
          tpl.minRootFret || 0,
          config.openMidi
        );
        const frets = tpl.offsets.map((off) => (off === null ? -1 : rootFret + off));
        if (frets.some((f) => f < -1 || f > 15)) continue;
        const key = frets.join(',');
        if (voicings.some((v) => v.frets.join(',') === key)) continue;

        const midiNotes = frets
          .map((f, idx) => (f >= 0 ? config.openMidi[idx] + f : null))
          .filter((m) => m !== null);
        const pcs = new Set(midiNotes.map((m) => ((m % 12) + 12) % 12));
        const allValid = midiNotes.every((m) => expectedPcs.has(((m % 12) + 12) % 12));
        const hasRequired =
          pcs.has(safeRoot) && (requiredThirdPc === null || pcs.has(requiredThirdPc));
        if (!allValid || !hasRequired) continue;

        const { startFret } = computeWindow(frets);
        voicings.push({
          label: `${tpl.label} (Fr ${rootFret})`,
          frets,
          fingers: tpl.fingers,
          barre: null,
          startFret,
          midiNotes,
          openMidi: config.openMidi,
        });
      }
    }

    const solved = solveFourStringVoicings(
      safeRoot,
      quality,
      config.openMidi,
      config.id,
      2
    );
    for (const sVoicing of solved) {
      if (voicings.length >= 3) break;
      const key = sVoicing.frets.join(',');
      if (!voicings.some((v) => v.frets.join(',') === key)) {
        voicings.push(sVoicing);
      }
    }
  }

  const notes = quality.intervals.map((semi) => getNoteName(safeRoot + semi, preferFlats));

  return {
    instrumentId: config.id,
    rootPc: safeRoot,
    rootName,
    preferFlats,
    quality,
    symbol,
    notes,
    voicings,
  };
}

export const SCALE_DEFINITIONS = [
  {
    id: 'major',
    name: 'Major (Ionian)',
    category: 'Diatonic',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    diatonicQualities: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'm7b5'],
    roman: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    description: 'Bright, resolved seven-note foundation of Western harmony.',
  },
  {
    id: 'natural_minor',
    name: 'Natural Minor (Aeolian)',
    category: 'Diatonic',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
    diatonicQualities: ['minor', 'm7b5', 'major', 'minor', 'minor', 'major', 'major'],
    roman: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
    description: 'Expressive minor tonality central to rock, metal, and ballads.',
  },
  {
    id: 'minor_pentatonic',
    name: 'Minor Pentatonic',
    category: 'Pentatonic & Blues',
    intervals: [0, 3, 5, 7, 10],
    degrees: ['1', 'b3', '4', '5', 'b7'],
    description: 'Five-note soloing workhorse with zero avoid notes.',
  },
  {
    id: 'major_pentatonic',
    name: 'Major Pentatonic',
    category: 'Pentatonic & Blues',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
    description: 'Uplifting five-note scale used in country, pop, and classic rock.',
  },
  {
    id: 'blues',
    name: 'Blues Scale',
    category: 'Pentatonic & Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ['1', 'b3', '4', 'b5', '5', 'b7'],
    description: 'Minor pentatonic enhanced with the expressive b5 blue note.',
  },
  {
    id: 'dorian',
    name: 'Dorian Mode',
    category: 'Modes',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'],
    diatonicQualities: ['minor', 'minor', 'major', 'major', 'minor', 'm7b5', 'major'],
    roman: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
    description: 'Minor mode with a raised natural 6th—staple of funk, fusion, and Santana.',
  },
  {
    id: 'phrygian',
    name: 'Phrygian Mode',
    category: 'Modes',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
    description: 'Dark, Spanish-tinged minor mode driven by the half-step b2.',
  },
  {
    id: 'lydian',
    name: 'Lydian Mode',
    category: 'Modes',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ['1', '2', '3', '#4', '5', '6', '7'],
    description: 'Dreamy, cinematic major mode featuring a raised #4.',
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian Mode',
    category: 'Modes',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ['1', '2', '3', '4', '5', '6', 'b7'],
    diatonicQualities: ['major', 'minor', 'm7b5', 'major', 'minor', 'minor', 'major'],
    roman: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII'],
    description: 'Dominant-7th major mode built for blues-rock and jam grooves.',
  },
  {
    id: 'locrian',
    name: 'Locrian Mode',
    category: 'Modes',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
    description: 'Half-diminished mode with a flattened 5th and tense character.',
  },
  {
    id: 'harmonic_minor',
    name: 'Harmonic Minor',
    category: 'Harmonic & Exotic',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'],
    description: 'Classical & neoclassical scale with a dramatic augmented 2nd leap.',
  },
  {
    id: 'melodic_minor',
    name: 'Melodic Minor (Jazz)',
    category: 'Harmonic & Exotic',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    degrees: ['1', '2', 'b3', '4', '5', '6', '7'],
    description: 'Minor scale with raised 6th & 7th—source of altered jazz harmony.',
  },
  {
    id: 'phrygian_dominant',
    name: 'Phrygian Dominant',
    category: 'Harmonic & Exotic',
    intervals: [0, 1, 4, 5, 7, 8, 10],
    degrees: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
    description: '5th mode of Harmonic Minor—iconic flamenco and Middle Eastern color.',
  },
  {
    id: 'whole_tone',
    name: 'Whole Tone',
    category: 'Harmonic & Exotic',
    intervals: [0, 2, 4, 6, 8, 10],
    degrees: ['1', '2', '3', '#4', '#5', 'b7'],
    description: 'Symmetrical six-note whole-step scale for dreamy tension.',
  },
];

export function getScaleDetails(rootPc, scaleId, instrumentId = 'guitar') {
  const config = getInstrumentConfig(instrumentId);
  const safeRoot = ((rootPc % 12) + 12) % 12;
  const preferFlats = shouldPreferFlats(safeRoot);
  const scale = SCALE_DEFINITIONS.find((s) => s.id === scaleId) || SCALE_DEFINITIONS[0];

  const notes = scale.intervals.map((semi, idx) => {
    const pc = (safeRoot + semi) % 12;
    return {
      pc,
      name: getNoteName(pc, preferFlats),
      degree: scale.degrees[idx],
      semitones: semi,
    };
  });

  const diatonicChords = scale.diatonicQualities
    ? scale.intervals.map((semi, idx) => {
        const chordRootPc = (safeRoot + semi) % 12;
        const rawQualityId = scale.diatonicQualities[idx];
        const qualityId = mapQualityForInstrument(rawQualityId, config.id);
        const q = CHORD_QUALITIES.find((item) => item.id === qualityId);
        const chordRootName = getNoteName(chordRootPc, preferFlats);
        return {
          roman: scale.roman[idx],
          rootPc: chordRootPc,
          qualityId,
          symbol: `${chordRootName}${q ? q.symbol : ''}`,
          qualityName: q ? q.name : qualityId,
        };
      })
    : [];

  const baseMidi = config.scaleOctaveBase + safeRoot;
  const ascendingMidi = [
    ...scale.intervals.map((semi) => baseMidi + semi),
    baseMidi + 12,
  ];

  return {
    instrumentId: config.id,
    rootPc: safeRoot,
    rootName: getNoteName(safeRoot, preferFlats),
    preferFlats,
    scale,
    notes,
    diatonicChords,
    ascendingMidi,
  };
}

export function getFretboardMatrix(
  rootPc,
  scaleId,
  maxFret = 15,
  instrumentOrOpenMidi = 'guitar'
) {
  const isCustomArray = Array.isArray(instrumentOrOpenMidi);
  const config = isCustomArray
    ? INSTRUMENT_CONFIGS.guitar
    : getInstrumentConfig(instrumentOrOpenMidi);
  const openMidi = isCustomArray ? instrumentOrOpenMidi : config.openMidi;
  const stringLabels = isCustomArray
    ? openMidi.map((_, i) => `S${i + 1}`)
    : config.stringLabels;

  const details = getScaleDetails(rootPc, scaleId, config.id);
  const pcToNote = new Map(details.notes.map((n) => [n.pc, n]));

  // Return rows ordered top-to-bottom visually: highest string (1) down to lowest string (N)
  const rows = [];
  for (let sIdx = openMidi.length - 1; sIdx >= 0; sIdx--) {
    const stringOpenMidi = openMidi[sIdx];
    const cells = [];
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = stringOpenMidi + fret;
      const pc = ((midi % 12) + 12) % 12;
      const match = pcToNote.get(pc) || null;
      cells.push({
        fret,
        midi,
        pc,
        inScale: Boolean(match),
        isRoot: pc === details.rootPc,
        noteName: getNoteName(pc, details.preferFlats),
        degree: match ? match.degree : null,
      });
    }
    rows.push({
      stringNum: openMidi.length - sIdx,
      label: stringLabels[sIdx],
      cells,
    });
  }

  return {
    details,
    rows,
  };
}

export function getScaleBoxWindow(rootPc, boxId, instrumentId = 'guitar') {
  if (boxId === 'all') return { min: 0, max: 15, label: 'All Frets (0–15)' };
  if (boxId === 'open') return { min: 0, max: 4, label: 'Open Position (0–4)' };
  const config = getInstrumentConfig(instrumentId);
  const lowestStringNum = config.openMidi.length;
  const anchorRootFret = getRootFretForString(
    rootPc,
    lowestStringNum,
    0,
    config.openMidi
  );
  const boxOffsets = {
    pos1: [0, 4],
    pos2: [2, 6],
    pos3: [4, 8],
    pos4: [7, 11],
    pos5: [9, 13],
  };
  const [offMin, offMax] = boxOffsets[boxId] || [0, 15];
  let min = anchorRootFret + offMin;
  let max = anchorRootFret + offMax;
  if (max > 15) {
    min = Math.max(0, min - 12);
    max = Math.max(4, max - 12);
  }
  return { min, max, label: `Frets ${min}–${max}` };
}

export const PROGRESSION_TEMPLATES = [
  {
    id: 'three_chord_family',
    name: 'Three-Chord Family',
    category: 'Chord Families',
    numeralLabel: 'I – IV – V',
    description: 'Essential 3-chord family (G–C–D in G, C–F–G in C, D–G–A in D).',
    steps: [
      { offset: 0, qualityId: 'major', roman: 'I' },
      { offset: 5, qualityId: 'major', roman: 'IV' },
      { offset: 7, qualityId: 'major', roman: 'V' },
    ],
  },
  {
    id: 'four_chord_family',
    name: 'Key Chord Family',
    category: 'Chord Families',
    numeralLabel: 'I – IV – V – vi',
    description: 'The 4 primary chords of any key (G–C–D–Em in G) powering folk, pop & country.',
    steps: [
      { offset: 0, qualityId: 'major', roman: 'I' },
      { offset: 5, qualityId: 'major', roman: 'IV' },
      { offset: 7, qualityId: 'major', roman: 'V' },
      { offset: 9, qualityId: 'minor', roman: 'vi' },
    ],
  },
  {
    id: 'campfire_family',
    name: 'Acoustic Strummer',
    category: 'Chord Families',
    numeralLabel: 'I – IV – vi – V',
    description: 'Warm acoustic progression (G–C–Em–D in G) ideal for strumming & ballads.',
    steps: [
      { offset: 0, qualityId: 'major', roman: 'I' },
      { offset: 5, qualityId: 'major', roman: 'IV' },
      { offset: 9, qualityId: 'minor', roman: 'vi' },
      { offset: 7, qualityId: 'major', roman: 'V' },
    ],
  },
  {
    id: 'fifties_doowop',
    name: "Classic '50s Turnaround",
    category: 'Chord Families',
    numeralLabel: 'I – vi – IV – V',
    description: 'Timeless doo-wop and ballad loop (G–Em–C–D in G, C–Am–F–G in C).',
    steps: [
      { offset: 0, qualityId: 'major', roman: 'I' },
      { offset: 9, qualityId: 'minor', roman: 'vi' },
      { offset: 5, qualityId: 'major', roman: 'IV' },
      { offset: 7, qualityId: 'major', roman: 'V' },
    ],
  },
  {
    id: 'pop_axis',
    name: 'Pop / Rock Anthem',
    category: 'Pop & Rock',
    numeralLabel: 'I – V – vi – IV',
    description: 'Modern chart anthem loop (G–D–Em–C in G, C–G–Am–F in C).',
    steps: [
      { offset: 0, qualityId: 'major', roman: 'I' },
      { offset: 7, qualityId: 'major', roman: 'V' },
      { offset: 9, qualityId: 'minor', roman: 'vi' },
      { offset: 5, qualityId: 'major', roman: 'IV' },
    ],
  },
  {
    id: 'jazz_ii_v_i',
    name: 'Jazz Turnaround',
    category: 'Jazz & Blues',
    numeralLabel: 'ii7 – V7 – Imaj7',
    description: 'Foundational seventh-chord cadence used across jazz standards.',
    steps: [
      { offset: 2, qualityId: 'm7', roman: 'ii7' },
      { offset: 7, qualityId: '7', roman: 'V7' },
      { offset: 0, qualityId: 'maj7', roman: 'Imaj7' },
    ],
  },
  {
    id: 'blues_12bar',
    name: 'Classic Blues',
    category: 'Jazz & Blues',
    numeralLabel: 'I7 – IV7 – V7',
    description: 'Dominant-7th 12-bar blues anchor chords (G7–C7–D7 in G).',
    steps: [
      { offset: 0, qualityId: '7', roman: 'I7' },
      { offset: 5, qualityId: '7', roman: 'IV7' },
      { offset: 7, qualityId: '7', roman: 'V7' },
    ],
  },
  {
    id: 'minor_epic',
    name: 'Aeolian Minor',
    category: 'Minor & Modal',
    numeralLabel: 'i – bVI – bIII – bVII',
    description: 'Cinematic natural-minor progression for rock and soundtrack riffs.',
    steps: [
      { offset: 0, qualityId: 'minor', roman: 'i' },
      { offset: 8, qualityId: 'major', roman: 'bVI' },
      { offset: 3, qualityId: 'major', roman: 'bIII' },
      { offset: 10, qualityId: 'major', roman: 'bVII' },
    ],
  },
  {
    id: 'andalusian',
    name: 'Andalusian Cadence',
    category: 'Minor & Modal',
    numeralLabel: 'i – bVII – bVI – V7',
    description: 'Descending Spanish/flamenco minor turnaround.',
    steps: [
      { offset: 0, qualityId: 'minor', roman: 'i' },
      { offset: 10, qualityId: 'major', roman: 'bVII' },
      { offset: 8, qualityId: 'major', roman: 'bVI' },
      { offset: 7, qualityId: '7', roman: 'V7' },
    ],
  },
];

export function buildProgression(rootPc, templateId, instrumentId = 'guitar') {
  const safeRoot = ((rootPc % 12) + 12) % 12;
  const preferFlats = shouldPreferFlats(safeRoot);
  const tpl =
    PROGRESSION_TEMPLATES.find((p) => p.id === templateId) || PROGRESSION_TEMPLATES[0];

  return {
    ...tpl,
    instrumentId,
    rootName: getNoteName(safeRoot, preferFlats),
    chords: tpl.steps.map((step) => {
      const chordRoot = (safeRoot + step.offset) % 12;
      const effectiveQuality = mapQualityForInstrument(step.qualityId, instrumentId);
      const voiced = getChordVoicings(chordRoot, effectiveQuality, null, instrumentId);
      return {
        roman: step.roman,
        ...voiced,
      };
    }),
  };
}

export function getKeyChordFamily(rootPc, instrumentId = 'guitar') {
  const safeRoot = ((rootPc % 12) + 12) % 12;
  const preferFlats = shouldPreferFlats(safeRoot);
  const specs = [
    { offset: 0, qualityId: 'major', roman: 'I', role: 'Tonic' },
    { offset: 2, qualityId: 'minor', roman: 'ii', role: 'Supertonic' },
    { offset: 4, qualityId: 'minor', roman: 'iii', role: 'Mediant' },
    { offset: 5, qualityId: 'major', roman: 'IV', role: 'Subdominant' },
    { offset: 7, qualityId: 'major', roman: 'V', role: 'Dominant' },
    { offset: 9, qualityId: 'minor', roman: 'vi', role: 'Rel. Minor' },
  ];

  return {
    instrumentId,
    rootPc: safeRoot,
    rootName: getNoteName(safeRoot, preferFlats),
    chords: specs.map((spec) => {
      const chordRoot = (safeRoot + spec.offset) % 12;
      const effectiveQuality = mapQualityForInstrument(spec.qualityId, instrumentId);
      return {
        roman: spec.roman,
        role: spec.role,
        ...getChordVoicings(chordRoot, effectiveQuality, preferFlats, instrumentId),
      };
    }),
  };
}

const ROOT_NOTE_MAP = {
  c: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  fb: 4,
  'e#': 5,
  f: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'a#': 10,
  bb: 10,
  b: 11,
  cb: 11,
  'b#': 0,
};

const QUALITY_ALIAS_MAP = {
  '': 'major',
  maj: 'major',
  major: 'major',
  M: 'major',
  m: 'minor',
  min: 'minor',
  minor: 'minor',
  '-': 'minor',
  '5': '5',
  power: '5',
  pwr: '5',
  sus2: 'sus2',
  suspended2: 'sus2',
  '2': 'sus2',
  sus4: 'sus4',
  sus: 'sus4',
  suspended: 'sus4',
  suspended4: 'sus4',
  '7': '7',
  dom7: '7',
  dominant7: '7',
  dominant: '7',
  maj7: 'maj7',
  ma7: 'maj7',
  M7: 'maj7',
  major7: 'maj7',
  'Δ7': 'maj7',
  'Δ': 'maj7',
  m7: 'm7',
  min7: 'm7',
  '-7': 'm7',
  minor7: 'm7',
  '7sus4': '7sus4',
  '7sus': '7sus4',
  sus7: '7sus4',
  sus47: '7sus4',
  '6': '6',
  maj6: '6',
  major6: '6',
  m6: 'm6',
  min6: 'm6',
  '-6': 'm6',
  minor6: 'm6',
  add9: 'add9',
  add2: 'add9',
  '9': '9',
  dom9: '9',
  dominant9: '9',
  m9: 'm9',
  min9: 'm9',
  '-9': 'm9',
  minor9: 'm9',
  maj9: 'maj9',
  ma9: 'maj9',
  M9: 'maj9',
  major9: 'maj9',
  '13': '13',
  dom13: '13',
  dominant13: '13',
  m11: 'm11',
  min11: 'm11',
  '-11': 'm11',
  minor11: 'm11',
  '6/9': '6_9',
  '69': '6_9',
  maj69: '6_9',
  m7b5: 'm7b5',
  'm7-5': 'm7b5',
  min7b5: 'm7b5',
  halfdim: 'm7b5',
  halfdiminished: 'm7b5',
  'ø': 'm7b5',
  'ø7': 'm7b5',
  dim: 'dim',
  '°': 'dim',
  o: 'dim',
  diminished: 'dim',
  dim7: 'dim7',
  '°7': 'dim7',
  o7: 'dim7',
  diminished7: 'dim7',
  aug: 'aug',
  '+': 'aug',
  augmented: 'aug',
  '#5': 'aug',
  '7#9': '7sharp9',
  '7+9': '7sharp9',
  hendrix: '7sharp9',
  '7b9': '7b9',
  '7-9': '7b9',
  'm(maj7)': 'm_maj7',
  mmaj7: 'm_maj7',
  minmaj7: 'm_maj7',
  mM7: 'm_maj7',
  'm/maj7': 'm_maj7',
};

function resolveQualityId(rawSuffix) {
  const trimmed = rawSuffix.trim();
  if (QUALITY_ALIAS_MAP[trimmed]) return QUALITY_ALIAS_MAP[trimmed];

  const compact = trimmed.replace(/\s+/g, '');
  if (QUALITY_ALIAS_MAP[compact]) return QUALITY_ALIAS_MAP[compact];

  const lower = compact.toLowerCase();
  return QUALITY_ALIAS_MAP[lower] || null;
}

export function parseChordQuery(rawQuery) {
  const cleaned = String(rawQuery || '')
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
  if (!cleaned) return null;

  // Match root letter + optional #/b accidental (case-insensitive) + quality suffix
  const match = cleaned.match(/^([A-Ga-g])([#b]?)\s*(.*)$/);
  if (!match) return null;

  const [, letter, accidental, rawSuffix] = match;
  const rootKey = `${letter.toLowerCase()}${accidental}`;
  if (!(rootKey in ROOT_NOTE_MAP)) return null;

  const rootPc = ROOT_NOTE_MAP[rootKey];
  const preferFlats =
    accidental === 'b' ? true : accidental === '#' ? false : shouldPreferFlats(rootPc);
  const qualityId = resolveQualityId(rawSuffix);

  return {
    rootPc,
    preferFlats,
    qualityId,
    rawSuffix: rawSuffix.trim(),
  };
}

export function searchChords(rawQuery, fallbackRootPc = 0, instrumentId = 'guitar') {
  const query = String(rawQuery || '')
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');

  if (!query) {
    return {
      query: '',
      exactChord: null,
      matches: [],
      hasRootInQuery: false,
      excludedReason: null,
      suggestedPowerSymbol: null,
      suggestedRootPc: null,
    };
  }

  const supportedQualities = getChordQualitiesForInstrument(instrumentId);
  const parsed = parseChordQuery(query);
  if (parsed && parsed.qualityId) {
    if (!isChordQualitySupportedForInstrument(parsed.qualityId, instrumentId)) {
      const rootName = getNoteName(parsed.rootPc, parsed.preferFlats);
      return {
        query,
        exactChord: null,
        matches: [],
        hasRootInQuery: true,
        excludedReason: 'bass_no_minor',
        suggestedPowerSymbol: `${rootName}5`,
        suggestedRootPc: parsed.rootPc,
      };
    }

    const exactChord = getChordVoicings(
      parsed.rootPc,
      parsed.qualityId,
      parsed.preferFlats,
      instrumentId
    );
    const suffixLower = parsed.rawSuffix.toLowerCase();
    const otherQualities = supportedQualities.filter(
      (q) => q.id !== parsed.qualityId
    )
      .map((q) => {
        const hay = `${q.symbol} ${q.name} ${q.category}`.toLowerCase();
        const related =
          suffixLower.length >= 2 && hay.includes(suffixLower)
            ? 2
            : q.category === exactChord.quality.category
              ? 1
              : 0;
        return { q, related };
      })
      .sort((a, b) => b.related - a.related)
      .slice(0, 7)
      .map((item) =>
        getChordVoicings(parsed.rootPc, item.q.id, parsed.preferFlats, instrumentId)
      );

    return {
      query,
      exactChord,
      matches: [exactChord, ...otherQualities],
      hasRootInQuery: true,
      excludedReason: null,
      suggestedPowerSymbol: null,
      suggestedRootPc: null,
    };
  }

  // Otherwise match against quality names, symbols, descriptions, or partial root+suffix
  const targetRootPc = parsed ? parsed.rootPc : fallbackRootPc;
  const targetFlats = parsed ? parsed.preferFlats : shouldPreferFlats(targetRootPc);
  const searchTerm = (parsed ? parsed.rawSuffix : query).toLowerCase();
  const compactTerm = searchTerm.replace(/\s+/g, '');
  const resolvedKeywordQuality = resolveQualityId(compactTerm);

  if (
    instrumentId === 'bass' &&
    (BASS_EXCLUDED_QUALITY_IDS.has(resolvedKeywordQuality) ||
      compactTerm === 'minor')
  ) {
    const rootName = getNoteName(targetRootPc, targetFlats);
    return {
      query,
      exactChord: null,
      matches: [],
      hasRootInQuery: Boolean(parsed),
      excludedReason: 'bass_no_minor',
      suggestedPowerSymbol: `${rootName}5`,
      suggestedRootPc: targetRootPc,
    };
  }

  const scored = supportedQualities.map((q) => {
    const coreHay = `${q.symbol} ${q.name} ${q.category}`.toLowerCase();
    const fullHay = `${coreHay} ${q.description}`.toLowerCase();
    const symLower = q.symbol.toLowerCase();
    const nameLower = q.name.toLowerCase();
    let score = 0;

    if (!compactTerm && parsed) score = 5;
    else if (symLower === compactTerm) score = 100;
    else if (symLower.startsWith(compactTerm)) score = 80;
    else if (symLower.includes(compactTerm)) score = 70;
    else if (nameLower.startsWith(searchTerm)) score = 60;
    else if (coreHay.includes(searchTerm) || coreHay.includes(compactTerm)) score = 45;
    else if (compactTerm.length >= 4 && fullHay.includes(searchTerm)) score = 20;

    return { q, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const matches = scored.map((item) =>
    getChordVoicings(targetRootPc, item.q.id, targetFlats, instrumentId)
  );

  return {
    query,
    exactChord: matches[0] || null,
    matches,
    hasRootInQuery: Boolean(parsed),
    excludedReason: null,
    suggestedPowerSymbol: null,
    suggestedRootPc: null,
  };
}

const MINOR_FAMILY_QUALITIES = new Set([
  'minor',
  'm7',
  'm6',
  'm9',
  'm11',
  'm_maj7',
]);

const DIM_FAMILY_QUALITIES = new Set(['dim', 'dim7', 'm7b5']);

const DOM_FAMILY_QUALITIES = new Set([
  '7',
  '9',
  '13',
  '7sus4',
  '7sharp9',
  '7b9',
]);

function makeCustomProgression(id, name, numeralLabel, description, stepList, instrumentId = 'guitar') {
  return {
    id,
    name,
    numeralLabel,
    description,
    chords: stepList.map((s) => ({
      roman: s.roman,
      ...getChordVoicings(
        s.rootPc,
        mapQualityForInstrument(s.qualityId, instrumentId),
        s.preferFlats ?? null,
        instrumentId
      ),
    })),
  };
}

export function getChordFamilyContext(
  rootPc,
  qualityId,
  preferFlatsOverride = null,
  instrumentId = 'guitar'
) {
  const safeRoot = ((rootPc % 12) + 12) % 12;
  const effectiveQualityId = mapQualityForInstrument(qualityId, instrumentId);
  const chord = getChordVoicings(safeRoot, effectiveQualityId, preferFlatsOverride, instrumentId);
  const preferFlats = chord.preferFlats;

  const isMinor = MINOR_FAMILY_QUALITIES.has(chord.quality.id);
  const isDim = DIM_FAMILY_QUALITIES.has(chord.quality.id);
  const isDom = DOM_FAMILY_QUALITIES.has(chord.quality.id);

  // Determine the parent major key for the chord's natural family
  const parentMajorPc = isMinor
    ? (safeRoot + 3) % 12
    : isDim
      ? (safeRoot + 1) % 12
      : isDom
        ? (safeRoot + 5) % 12
        : safeRoot;

  const parentFlats =
    preferFlatsOverride !== null ? preferFlatsOverride : shouldPreferFlats(parentMajorPc);
  const parentMajorName = getNoteName(parentMajorPc, parentFlats);

  const familySpecs = [
    { offset: 0, qualityId: 'major', roman: 'I', role: 'Tonic' },
    { offset: 2, qualityId: 'minor', roman: 'ii', role: 'Supertonic' },
    { offset: 4, qualityId: 'minor', roman: 'iii', role: 'Mediant' },
    { offset: 5, qualityId: 'major', roman: 'IV', role: 'Subdominant' },
    { offset: 7, qualityId: 'major', roman: 'V', role: 'Dominant' },
    { offset: 9, qualityId: 'minor', roman: 'vi', role: 'Rel. Minor' },
    { offset: 11, qualityId: 'dim', roman: 'vii°', role: 'Leading Tone' },
  ];

  const familyChords = familySpecs.map((spec) => {
    const chordRoot = (parentMajorPc + spec.offset) % 12;
    const isSelected = chordRoot === safeRoot;
    return {
      roman: spec.roman,
      role: spec.role,
      isSelected,
      ...getChordVoicings(
        chordRoot,
        mapQualityForInstrument(spec.qualityId, instrumentId),
        parentFlats,
        instrumentId
      ),
    };
  });

  let keyFamilyLabel = `${parentMajorName} Major Chord Family`;
  let relationshipSummary = `${chord.symbol} is the I (Tonic) chord of the ${parentMajorName} Major family.`;

  if (isMinor) {
    keyFamilyLabel = `${chord.rootName} Minor / ${parentMajorName} Major Family`;
    relationshipSummary = `${chord.symbol} is the i (Tonic) of ${chord.rootName} Minor and the vi (Relative Minor) of ${parentMajorName} Major.`;
  } else if (isDim) {
    const relMinorName = getNoteName((safeRoot + 10) % 12, parentFlats);
    keyFamilyLabel = `${parentMajorName} Major / ${relMinorName} Minor Family`;
    relationshipSummary = `${chord.symbol} is the vii° leading-tone chord in ${parentMajorName} Major (resolves to ${parentMajorName}) and ii° in ${relMinorName} Minor.`;
  } else if (isDom) {
    keyFamilyLabel = `${parentMajorName} Major (V7) & ${chord.rootName} Blues`;
    relationshipSummary = `${chord.symbol} acts as the V7 dominant resolving to ${parentMajorName} Major, or the I7 tonic in ${chord.rootName} Blues.`;
  } else if (chord.quality.id !== 'major') {
    relationshipSummary = `${chord.symbol} colors the ${parentMajorName} Major tonic in the ${parentMajorName} Major chord family.`;
  }

  let progressions = [];

  if (isMinor) {
    progressions = [
      makeCustomProgression(
        'minor_3chord',
        `${chord.rootName} Minor Three-Chord Family`,
        'i – iv – v',
        `Core minor open-chord family centered on ${chord.symbol}.`,
        [
          { rootPc: safeRoot, qualityId: chord.quality.id === 'm7' ? 'm7' : 'minor', roman: 'i', preferFlats },
          { rootPc: (safeRoot + 5) % 12, qualityId: 'minor', roman: 'iv', preferFlats: parentFlats },
          { rootPc: (safeRoot + 7) % 12, qualityId: 'minor', roman: 'v', preferFlats: parentFlats },
        ],
        instrumentId
      ),
      makeCustomProgression(
        'minor_rel_major',
        `Relative ${parentMajorName} Major Family`,
        'i – VI – III – VII',
        `Uses ${chord.symbol} alongside its relative major (${parentMajorName}–${getNoteName((safeRoot + 8) % 12, parentFlats)}–${getNoteName((safeRoot + 10) % 12, parentFlats)}).`,
        [
          { rootPc: safeRoot, qualityId: 'minor', roman: 'i', preferFlats },
          { rootPc: (safeRoot + 8) % 12, qualityId: 'major', roman: 'bVI', preferFlats: parentFlats },
          { rootPc: (safeRoot + 3) % 12, qualityId: 'major', roman: 'bIII', preferFlats: parentFlats },
          { rootPc: (safeRoot + 10) % 12, qualityId: 'major', roman: 'bVII', preferFlats: parentFlats },
        ],
        instrumentId
      ),
      buildProgression(parentMajorPc, 'four_chord_family', instrumentId),
      buildProgression(parentMajorPc, 'fifties_doowop', instrumentId),
    ];
  } else if (isDim) {
    const relMinorPc = (safeRoot + 10) % 12;
    progressions = [
      makeCustomProgression(
        'dim_resolution',
        'Leading-Tone Resolution',
        'IV – vii° – I – V',
        `Classic tension-to-release voice leading resolving ${chord.symbol} up a half-step to ${parentMajorName}.`,
        [
          { rootPc: (parentMajorPc + 5) % 12, qualityId: 'major', roman: 'IV', preferFlats: parentFlats },
          { rootPc: safeRoot, qualityId: chord.quality.id, roman: 'vii°', preferFlats },
          { rootPc: parentMajorPc, qualityId: 'major', roman: 'I', preferFlats: parentFlats },
          { rootPc: (parentMajorPc + 7) % 12, qualityId: 'major', roman: 'V', preferFlats: parentFlats },
        ],
        instrumentId
      ),
      makeCustomProgression(
        'minor_ii_v_i',
        `Minor ii° – V7 – i (${getNoteName(relMinorPc, parentFlats)}m)`,
        'ii° – V7 – i',
        `Essential jazz/minor turnaround resolving through ${chord.symbol} to ${getNoteName(relMinorPc, parentFlats)}m.`,
        [
          { rootPc: safeRoot, qualityId: chord.quality.id === 'dim' ? 'm7b5' : chord.quality.id, roman: 'ii°', preferFlats },
          { rootPc: (relMinorPc + 7) % 12, qualityId: '7', roman: 'V7', preferFlats: parentFlats },
          { rootPc: relMinorPc, qualityId: 'minor', roman: 'i', preferFlats: parentFlats },
        ],
        instrumentId
      ),
      buildProgression(parentMajorPc, 'three_chord_family', instrumentId),
      buildProgression(parentMajorPc, 'four_chord_family', instrumentId),
    ];
  } else if (isDom) {
    progressions = [
      makeCustomProgression(
        'dom_cadence',
        `${parentMajorName} Major V7 Cadence`,
        'I – IV – V7 – I',
        `Uses ${chord.symbol} as the V7 tension chord pulling cleanly back to ${parentMajorName}.`,
        [
          { rootPc: parentMajorPc, qualityId: 'major', roman: 'I', preferFlats: parentFlats },
          { rootPc: (parentMajorPc + 5) % 12, qualityId: 'major', roman: 'IV', preferFlats: parentFlats },
          { rootPc: safeRoot, qualityId: chord.quality.id, roman: 'V7', preferFlats },
          { rootPc: parentMajorPc, qualityId: 'major', roman: 'I', preferFlats: parentFlats },
        ],
        instrumentId
      ),
      buildProgression(safeRoot, 'blues_12bar', instrumentId),
      buildProgression(parentMajorPc, 'jazz_ii_v_i', instrumentId),
      buildProgression(parentMajorPc, 'three_chord_family', instrumentId),
    ];
  } else {
    progressions = [
      buildProgression(parentMajorPc, 'three_chord_family', instrumentId),
      buildProgression(parentMajorPc, 'four_chord_family', instrumentId),
      buildProgression(parentMajorPc, 'campfire_family', instrumentId),
      buildProgression(parentMajorPc, 'pop_axis', instrumentId),
    ];
    if (chord.quality.id !== 'major') {
      progressions[0] = makeCustomProgression(
        'color_three_chord',
        `${chord.symbol} Color Resolution`,
        'I(color) – I – IV – V',
        `Blends ${chord.symbol} into the ${parentMajorName} three-chord family (${parentMajorName}–${getNoteName((parentMajorPc + 5) % 12, parentFlats)}–${getNoteName((parentMajorPc + 7) % 12, parentFlats)}).`,
        [
          { rootPc: safeRoot, qualityId: chord.quality.id, roman: 'I*', preferFlats },
          { rootPc: parentMajorPc, qualityId: 'major', roman: 'I', preferFlats: parentFlats },
          { rootPc: (parentMajorPc + 5) % 12, qualityId: 'major', roman: 'IV', preferFlats: parentFlats },
          { rootPc: (parentMajorPc + 7) % 12, qualityId: 'major', roman: 'V', preferFlats: parentFlats },
        ],
        instrumentId
      );
    }
  }

  return {
    instrumentId,
    chord,
    parentMajorPc,
    parentMajorName,
    keyFamilyLabel,
    relationshipSummary,
    familyChords,
    progressions,
  };
}

export const CIRCLE_OF_FIFTHS = [
  {
    position: 0,
    rootPc: 0,
    majorLabel: 'C',
    relMinorPc: 9,
    relMinorLabel: 'Am',
    preferFlats: false,
    accidentalsCount: 0,
    accidentalType: 'none',
    signatureLabel: '0 sharps / 0 flats',
    accidentals: [],
  },
  {
    position: 1,
    rootPc: 7,
    majorLabel: 'G',
    relMinorPc: 4,
    relMinorLabel: 'Em',
    preferFlats: false,
    accidentalsCount: 1,
    accidentalType: 'sharp',
    signatureLabel: '1 sharp (F#)',
    accidentals: ['F#'],
  },
  {
    position: 2,
    rootPc: 2,
    majorLabel: 'D',
    relMinorPc: 11,
    relMinorLabel: 'Bm',
    preferFlats: false,
    accidentalsCount: 2,
    accidentalType: 'sharp',
    signatureLabel: '2 sharps (F#, C#)',
    accidentals: ['F#', 'C#'],
  },
  {
    position: 3,
    rootPc: 9,
    majorLabel: 'A',
    relMinorPc: 6,
    relMinorLabel: 'F#m',
    preferFlats: false,
    accidentalsCount: 3,
    accidentalType: 'sharp',
    signatureLabel: '3 sharps (F#, C#, G#)',
    accidentals: ['F#', 'C#', 'G#'],
  },
  {
    position: 4,
    rootPc: 4,
    majorLabel: 'E',
    relMinorPc: 1,
    relMinorLabel: 'C#m',
    preferFlats: false,
    accidentalsCount: 4,
    accidentalType: 'sharp',
    signatureLabel: '4 sharps (F#, C#, G#, D#)',
    accidentals: ['F#', 'C#', 'G#', 'D#'],
  },
  {
    position: 5,
    rootPc: 11,
    majorLabel: 'B',
    relMinorPc: 8,
    relMinorLabel: 'G#m',
    preferFlats: false,
    accidentalsCount: 5,
    accidentalType: 'sharp',
    signatureLabel: '5 sharps (F#, C#, G#, D#, A#)',
    accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'],
  },
  {
    position: 6,
    rootPc: 6,
    majorLabel: 'F#/Gb',
    relMinorPc: 3,
    relMinorLabel: 'D#m/Ebm',
    preferFlats: false,
    accidentalsCount: 6,
    accidentalType: 'enharmonic',
    signatureLabel: '6 sharps / 6 flats',
    accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E# / Bb'],
  },
  {
    position: 7,
    rootPc: 1,
    majorLabel: 'Db',
    relMinorPc: 10,
    relMinorLabel: 'Bbm',
    preferFlats: true,
    accidentalsCount: 5,
    accidentalType: 'flat',
    signatureLabel: '5 flats (Bb, Eb, Ab, Db, Gb)',
    accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  },
  {
    position: 8,
    rootPc: 8,
    majorLabel: 'Ab',
    relMinorPc: 5,
    relMinorLabel: 'Fm',
    preferFlats: true,
    accidentalsCount: 4,
    accidentalType: 'flat',
    signatureLabel: '4 flats (Bb, Eb, Ab, Db)',
    accidentals: ['Bb', 'Eb', 'Ab', 'Db'],
  },
  {
    position: 9,
    rootPc: 3,
    majorLabel: 'Eb',
    relMinorPc: 0,
    relMinorLabel: 'Cm',
    preferFlats: true,
    accidentalsCount: 3,
    accidentalType: 'flat',
    signatureLabel: '3 flats (Bb, Eb, Ab)',
    accidentals: ['Bb', 'Eb', 'Ab'],
  },
  {
    position: 10,
    rootPc: 10,
    majorLabel: 'Bb',
    relMinorPc: 7,
    relMinorLabel: 'Gm',
    preferFlats: true,
    accidentalsCount: 2,
    accidentalType: 'flat',
    signatureLabel: '2 flats (Bb, Eb)',
    accidentals: ['Bb', 'Eb'],
  },
  {
    position: 11,
    rootPc: 5,
    majorLabel: 'F',
    relMinorPc: 2,
    relMinorLabel: 'Dm',
    preferFlats: true,
    accidentalsCount: 1,
    accidentalType: 'flat',
    signatureLabel: '1 flat (Bb)',
    accidentals: ['Bb'],
  },
];

export function getCircleOfFifthsContext(rootPc, instrumentId = 'guitar') {
  const safeRoot = ((Math.round(Number(rootPc) || 0) % 12) + 12) % 12;
  const activeIdx = Math.max(
    0,
    CIRCLE_OF_FIFTHS.findIndex((entry) => entry.rootPc === safeRoot)
  );
  const subdominantIdx = (activeIdx + 11) % 12;
  const dominantIdx = (activeIdx + 1) % 12;

  const entry = CIRCLE_OF_FIFTHS[activeIdx];
  const ivEntry = CIRCLE_OF_FIFTHS[subdominantIdx];
  const vEntry = CIRCLE_OF_FIFTHS[dominantIdx];

  const instConfig = getInstrumentConfig(instrumentId);
  const preferFlats = entry.preferFlats;
  const scaleOffsets = [0, 2, 4, 5, 7, 9, 11];
  const scaleNotes = scaleOffsets.map((semi, idx) => ({
    degree: idx + 1,
    pc: (safeRoot + semi) % 12,
    name: getNoteName((safeRoot + semi) % 12, preferFlats),
  }));

  const octaveOffsets = [0, 2, 4, 5, 7, 9, 11, 12];
  const octaveSteps = ['W', 'W', 'H', 'W', 'W', 'W', 'H', '8ve'];
  const fullOctaveScale = octaveOffsets.map((semi, idx) => ({
    degree: idx + 1,
    semitones: semi,
    isOctave: idx === 7,
    pc: (safeRoot + semi) % 12,
    name: getNoteName((safeRoot + semi) % 12, preferFlats),
    midi: instConfig.scaleOctaveBase + safeRoot + semi,
    stepLabel: octaveSteps[idx],
  }));

  const tonicChord = getChordVoicings(entry.rootPc, 'major', entry.preferFlats, instrumentId);
  const subdominantChord = getChordVoicings(
    ivEntry.rootPc,
    'major',
    ivEntry.preferFlats,
    instrumentId
  );
  const dominantChord = getChordVoicings(
    vEntry.rootPc,
    'major',
    vEntry.preferFlats,
    instrumentId
  );
  const relMinorChord = getChordVoicings(
    entry.relMinorPc,
    'minor',
    entry.preferFlats,
    instrumentId
  );

  return {
    activeIdx,
    subdominantIdx,
    dominantIdx,
    entry,
    ivEntry,
    vEntry,
    scaleNotes,
    fullOctaveScale,
    primaryChords: [
      { role: 'IV (Subdominant)', num: '4', chord: subdominantChord },
      { role: 'I (Tonic)', num: '1', chord: tonicChord },
      { role: 'V (Dominant)', num: '5', chord: dominantChord },
      { role: 'vi (Rel. Minor)', num: '6m', chord: relMinorChord },
    ],
  };
}

export const NASHVILLE_CHARTS = [
  {
    id: 'pop_anthem',
    name: 'Modern Pop & Worship Loop',
    feel: '4/4 · Straight Eighth Strumming',
    summary: 'The classic 4-chord progression used across thousands of acoustic & studio sessions.',
    bars: [
      { nashville: '1', offset: 0, qualityId: 'major', mark: '◇ (Ring)' },
      { nashville: '5', offset: 7, qualityId: 'major', mark: '' },
      { nashville: '6m', offset: 9, qualityId: 'minor', mark: '' },
      { nashville: '4', offset: 5, qualityId: 'major', mark: '' },
    ],
  },
  {
    id: 'country_walk',
    name: 'Nashville Country Walkup',
    feel: '4/4 · Bass Slash Inversion',
    summary: 'Uses 1/3 (first-inversion bass note on the 3rd degree) to create a smooth rising bass line into 4.',
    bars: [
      { nashville: '1', offset: 0, qualityId: 'major', mark: '' },
      { nashville: '1/3', offset: 0, qualityId: 'major', bassOffset: 4, mark: 'Bass on 3rd' },
      { nashville: '4', offset: 5, qualityId: 'major', mark: '' },
      { nashville: '5', offset: 7, qualityId: '7', mark: '^ (Push)' },
    ],
  },
  {
    id: 'soul_turnaround',
    name: 'Session R&B / Gospel Turnaround',
    feel: '4/4 · Warm 7th Voicings',
    summary: 'Swaps 1–4–5 triads for 2m7 → 5 → 1maj7 → 6m7 to practice smooth voice leading in any key.',
    bars: [
      { nashville: '2m7', offset: 2, qualityId: 'm7', mark: '' },
      { nashville: '5', offset: 7, qualityId: '7', mark: '7sus4→7' },
      { nashville: '1maj7', offset: 0, qualityId: 'maj7', mark: '◇ (Hold)' },
      { nashville: '6m7', offset: 9, qualityId: 'm7', mark: '' },
    ],
  },
];

export function buildNashvilleChart(rootPc, chartId = 'pop_anthem', instrumentId = 'guitar') {
  const safeRoot = ((Math.round(Number(rootPc) || 0) % 12) + 12) % 12;
  const preferFlats = shouldPreferFlats(safeRoot);
  const template = NASHVILLE_CHARTS.find((c) => c.id === chartId) || NASHVILLE_CHARTS[0];

  return {
    ...template,
    rootPc: safeRoot,
    keyName: getNoteName(safeRoot, preferFlats),
    bars: template.bars.map((bar) => {
      const chordRoot = (safeRoot + bar.offset) % 12;
      const effectiveQuality = mapQualityForInstrument(bar.qualityId, instrumentId);
      const chordData = getChordVoicings(chordRoot, effectiveQuality, preferFlats, instrumentId);
      const bassName =
        typeof bar.bassOffset === 'number'
          ? getNoteName((safeRoot + bar.bassOffset) % 12, preferFlats)
          : null;
      const displaySymbol = bassName ? `${chordData.symbol}/${bassName}` : chordData.symbol;

      return {
        ...bar,
        displaySymbol,
        chordData,
      };
    }),
  };
}

