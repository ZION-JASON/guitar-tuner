const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const getNoteFromFrequency = (frequency, ref = 440) => {
  // Formula: n = 12 * log2(f / f_ref)
  const n = 12 * (Math.log(frequency / ref) / Math.log(2));
  const roundedN = Math.round(n);
  const cents = (n - roundedN) * 100;
  
  // A4 is index 9 (A) in our array. 
  // We add 69 to the roundedN because MIDI note 69 is A4.
  const noteIndex = (roundedN + 69) % 12;
  const noteName = noteStrings[noteIndex];

  return { noteName, cents };
};