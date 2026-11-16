import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHROMATIC_NOTES,
  CHORD_QUALITIES,
  SCALE_DEFINITIONS,
  getChordVoicings,
  getScaleDetails,
  getFretboardMatrix,
  buildProgression,
  getChordFamilyContext,
  getKeyChordFamily,
  searchChords,
} from './musicTheory.js';

test('all 12 roots x 25 chord qualities produce valid voicings matching chord pitch classes', () => {
  for (const root of CHROMATIC_NOTES) {
    for (const quality of CHORD_QUALITIES) {
      const chord = getChordVoicings(root.index, quality.id);
      assert.ok(
        chord.voicings.length >= 1,
        `Missing voicings for ${root.name} ${quality.id}`
      );

      const expectedPcs = new Set(
        quality.intervals.map((semi) => (root.index + semi) % 12)
      );

      for (const v of chord.voicings) {
        assert.equal(v.frets.length, 6);
        assert.equal(v.fingers.length, 6);
        assert.ok(v.midiNotes.length >= 2, `Too few played notes in ${chord.symbol} ${v.label}`);
        for (const f of v.frets) {
          assert.ok(f >= -1 && f <= 15, `Fret out of bounds (${f}) for ${chord.symbol} ${v.label}`);
        }
        for (const midi of v.midiNotes) {
          const pc = ((midi % 12) + 12) % 12;
          assert.ok(
            expectedPcs.has(pc),
            `Wrong note pc=${pc} in ${chord.symbol} (${v.label}); expected one of [${[...expectedPcs].join(',')}]`
          );
        }
      }
    }
  }
});

test('all 12 roots x 14 scales transpose dynamically with exact note counts and root match', () => {
  for (const root of CHROMATIC_NOTES) {
    for (const scale of SCALE_DEFINITIONS) {
      const details = getScaleDetails(root.index, scale.id);
      assert.equal(details.notes.length, scale.intervals.length);
      assert.equal(details.notes[0].pc, root.index);
      assert.equal(details.notes[0].degree, '1');

      const matrix = getFretboardMatrix(root.index, scale.id, 15);
      assert.equal(matrix.rows.length, 6);
      assert.equal(matrix.rows[0].cells.length, 16); // frets 0..15

      // Open 1E (row 0, fret 0) is MIDI 64 (E = pc 4)
      const openHighE = matrix.rows[0].cells[0];
      assert.equal(openHighE.midi, 64);
      assert.equal(openHighE.isRoot, root.index === 4);
    }
  }
});

test('buildProgression and getKeyChordFamily produce G-C-D and key family chords accurately', () => {
  const gThreeChord = buildProgression(7, 'three_chord_family');
  assert.deepEqual(
    gThreeChord.chords.map((c) => c.symbol),
    ['G', 'C', 'D']
  );

  const gFamily = getKeyChordFamily(7);
  assert.deepEqual(
    gFamily.chords.map((c) => c.symbol),
    ['G', 'Am', 'Bm', 'C', 'D', 'Em']
  );

  const cPop = buildProgression(0, 'pop_axis');
  assert.deepEqual(
    cPop.chords.map((c) => c.symbol),
    ['C', 'G', 'Am', 'F']
  );

  const dJazz = buildProgression(2, 'jazz_ii_v_i');
  assert.deepEqual(
    dJazz.chords.map((c) => c.symbol),
    ['Em7', 'A7', 'Dmaj7']
  );
});

test('searchChords resolves exact symbols, enharmonics, and complex quality keywords', () => {
  const fSharpDim = searchChords('F#dim', 0);
  assert.equal(fSharpDim.exactChord?.symbol, 'F#dim');
  assert.equal(fSharpDim.exactChord?.quality.id, 'dim');

  const bbSus4 = searchChords('Bbsus4', 0);
  assert.equal(bbSus4.exactChord?.symbol, 'Bbsus4');
  assert.equal(bbSus4.exactChord?.quality.id, 'sus4');

  const eHendrix = searchChords('E7#9', 0);
  assert.equal(eHendrix.exactChord?.symbol, 'E7#9');
  assert.equal(eHendrix.exactChord?.quality.id, '7sharp9');

  const susKeyword = searchChords('sus', 7);
  assert.ok(susKeyword.matches.length >= 3);
  assert.ok(susKeyword.matches.every((m) => m.rootPc === 7 && m.symbol.includes('sus')));

  const dimKeyword = searchChords('dim', 2);
  assert.ok(dimKeyword.matches.some((m) => m.symbol === 'Ddim'));
  assert.ok(dimKeyword.matches.some((m) => m.symbol === 'Ddim7'));
});

test('getChordFamilyContext derives chord family and playable progressions for any chord', () => {
  const gCtx = getChordFamilyContext(7, 'major');
  assert.equal(gCtx.parentMajorPc, 7);
  assert.equal(gCtx.familyChords.length, 7);
  assert.deepEqual(
    gCtx.progressions[0].chords.map((c) => c.symbol),
    ['G', 'C', 'D']
  );

  const emCtx = getChordFamilyContext(4, 'minor');
  assert.equal(emCtx.parentMajorPc, 7); // Relative major is G
  assert.deepEqual(
    emCtx.progressions[0].chords.map((c) => c.symbol),
    ['Em', 'Am', 'Bm']
  );

  const fSharpDimCtx = getChordFamilyContext(6, 'dim', false);
  assert.equal(fSharpDimCtx.parentMajorPc, 7); // vii° in G major
  assert.ok(fSharpDimCtx.progressions[0].chords.some((c) => c.symbol === 'F#dim'));
  assert.ok(fSharpDimCtx.progressions[0].chords.some((c) => c.symbol === 'G'));

  const d7Ctx = getChordFamilyContext(2, '7');
  assert.equal(d7Ctx.parentMajorPc, 7); // V7 in G major
  assert.deepEqual(
    d7Ctx.progressions[0].chords.map((c) => c.symbol),
    ['G', 'C', 'D7', 'G']
  );
});

test('all 12 roots x 25 chord qualities produce valid 4-string voicings for Ukulele and Bass', () => {
  for (const instrumentId of ['ukulele', 'bass']) {
    for (const root of CHROMATIC_NOTES) {
      for (const quality of CHORD_QUALITIES) {
        const chord = getChordVoicings(root.index, quality.id, null, instrumentId);
        assert.equal(chord.instrumentId, instrumentId);
        assert.ok(
          chord.voicings.length >= 1,
          `Missing ${instrumentId} voicings for ${root.name} ${quality.id}`
        );

        const expectedPcs = new Set(
          quality.intervals.map((semi) => (root.index + semi) % 12)
        );

        for (const v of chord.voicings) {
          assert.equal(v.frets.length, 4);
          assert.equal(v.fingers.length, 4);
          assert.equal(v.openMidi.length, 4);
          assert.ok(
            v.midiNotes.length >= 2,
            `Too few played notes in ${instrumentId} ${chord.symbol} ${v.label}`
          );
          for (const f of v.frets) {
            assert.ok(
              f >= -1 && f <= 15,
              `Fret out of bounds (${f}) for ${instrumentId} ${chord.symbol} ${v.label}`
            );
          }
          for (const midi of v.midiNotes) {
            const pc = ((midi % 12) + 12) % 12;
            assert.ok(
              expectedPcs.has(pc),
              `Wrong note pc=${pc} in ${instrumentId} ${chord.symbol} (${v.label})`
            );
          }
        }
      }
    }
  }
});

test('Ukulele and Bass fretboards, progressions, search, and chord families operate on 4 strings', () => {
  const ukeBoard = getFretboardMatrix(0, 'major', 15, 'ukulele');
  assert.equal(ukeBoard.rows.length, 4);
  assert.equal(ukeBoard.rows[0].label, '1A');
  assert.equal(ukeBoard.rows[0].cells[0].midi, 69);
  assert.equal(ukeBoard.rows[3].label, '4G');
  assert.equal(ukeBoard.rows[3].cells[0].midi, 67);

  const bassBoard = getFretboardMatrix(4, 'minor_pentatonic', 15, 'bass');
  assert.equal(bassBoard.rows.length, 4);
  assert.equal(bassBoard.rows[0].label, '1G');
  assert.equal(bassBoard.rows[0].cells[0].midi, 43);
  assert.equal(bassBoard.rows[3].label, '4E');
  assert.equal(bassBoard.rows[3].cells[0].midi, 28);

  const ukeGCD = buildProgression(7, 'three_chord_family', 'ukulele');
  assert.deepEqual(
    ukeGCD.chords.map((c) => c.symbol),
    ['G', 'C', 'D']
  );
  assert.ok(ukeGCD.chords.every((c) => c.voicings[0].frets.length === 4));

  const bassGCD = buildProgression(7, 'three_chord_family', 'bass');
  assert.deepEqual(
    bassGCD.chords.map((c) => c.symbol),
    ['G', 'C', 'D']
  );
  assert.ok(bassGCD.chords.every((c) => c.voicings[0].frets.length === 4));

  const ukeSearch = searchChords('F#dim', 0, 'ukulele');
  assert.equal(ukeSearch.exactChord?.symbol, 'F#dim');
  assert.equal(ukeSearch.exactChord?.voicings[0].frets.length, 4);

  const bassFamily = getChordFamilyContext(6, 'dim', false, 'bass');
  assert.equal(bassFamily.parentMajorPc, 7);
  assert.ok(
    bassFamily.progressions[0].chords.every((c) => c.voicings[0].frets.length === 4)
  );
});
