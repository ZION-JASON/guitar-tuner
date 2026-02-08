// Standard concert pitch for A4
const CONCERT_PITCH = 440;

// The names of the 12 notes in an octave
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Calculates the number of semitones a frequency is from A4 (440Hz)
 * Uses the formula: n = 12 * log2(f / 440)
 */
export const getSemitonesFromA4 = (frequency) => {
  return 12 * Math.log2(frequency / CONCERT_PITCH);
};

/**
 * Converts a frequency to the nearest musical note
 */
export const getNoteFromFrequency = (frequency) => {
  // 69 is the MIDI number for A4
  const noteNum = 12 * (Math.log2(frequency / CONCERT_PITCH)) + 69;
  const roundedNoteNum = Math.round(noteNum);
  
  const noteName = NOTE_NAMES[roundedNoteNum % 12];
  const octave = Math.floor(roundedNoteNum / 12) - 1;
  
  return { noteName, octave, cents: Math.floor((noteNum - roundedNoteNum) * 100) };
};