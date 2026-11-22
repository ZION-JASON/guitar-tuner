import React, { useMemo, useState } from 'react';
import { getChordVoicings } from '../utils/musicTheory';
import { getInstrumentMeta } from '../utils/frequencyUtils';
import ChordDiagramSVG from './ChordDiagramSVG';

const FavoriteChordsTray = ({
  favorites = [],
  currentInstrument = 'guitar',
  labelMode = 'fingers',
  playMode = 'strum',
  refFrequency = 440,
  activeStrumId = null,
  onPlayChord,
  onAddToSequence,
  onQueueAllFavorites,
  onRemoveFavorite,
  onClearAll,
  onInspectFavorite,
  onClose,
}) => {
  const [scope, setScope] = useState('all');

  const resolvedItems = useMemo(() => {
    return favorites
      .map((fav) => {
        const chordData = getChordVoicings(
          fav.rootPc,
          fav.qualityId,
          fav.preferFlats,
          fav.instrument
        );
        if (!chordData || !chordData.voicings.length) return null;
        const safeIdx = Math.min(
          Math.max(0, fav.voicingIdx || 0),
          chordData.voicings.length - 1
        );
        return {
          fav,
          chordData,
          voicing: chordData.voicings[safeIdx],
          instMeta: getInstrumentMeta(fav.instrument),
        };
      })
      .filter(Boolean);
  }, [favorites]);

  const hasMultipleInstruments = useMemo(() => {
    const instSet = new Set(resolvedItems.map((item) => item.fav.instrument));
    return instSet.size > 1;
  }, [resolvedItems]);

  const visibleItems = useMemo(() => {
    if (scope === 'current') {
      return resolvedItems.filter((item) => item.fav.instrument === currentInstrument);
    }
    return resolvedItems;
  }, [resolvedItems, scope, currentInstrument]);

  const buildArpNotes = (voicing, intervals) => {
    const midi = voicing?.midiNotes || [];
    if (midi.length > 1) return midi;
    if (midi.length === 1) {
      const rootMidi = midi[0];
      const notes = (intervals || [0, 4, 7]).map((semi) => rootMidi + semi);
      if ((intervals || []).length <= 3) notes.push(rootMidi + 12);
      return notes;
    }
    return [];
  };

  return (
    <section
      aria-label="Saved Favorite Chords for Practice"
      className="glass-panel rounded-[4px] p-4 sm:p-5 border border-amber-300/35 flex flex-col gap-3.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="font-display font-bold text-base sm:text-lg text-white inline-flex items-center gap-2">
            <span aria-hidden="true" className="text-amber-300">
              ★
            </span>
            <span>Practice Favorites ({favorites.length})</span>
          </h2>
          <span className="font-mono text-[11px] text-slate-300">
            Saved locally for quick chord-change practice
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasMultipleInstruments && (
            <div className="flex items-center gap-1 glass-recessed rounded-[3px] p-1">
              <button
                type="button"
                onClick={() => setScope('all')}
                aria-pressed={scope === 'all'}
                className={`min-h-[34px] px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-semibold cursor-pointer transition-colors ${
                  scope === 'all'
                    ? 'bg-white/20 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({resolvedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('current')}
                aria-pressed={scope === 'current'}
                className={`min-h-[34px] px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-semibold cursor-pointer transition-colors ${
                  scope === 'current'
                    ? 'bg-white/20 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {getInstrumentMeta(currentInstrument).shortLabel}
              </button>
            </div>
          )}

          {visibleItems.length > 0 && onQueueAllFavorites && (
            <button
              type="button"
              onClick={() => onQueueAllFavorites(visibleItems.map((item) => item.fav))}
              className="min-h-[36px] px-3 py-1 rounded-[2px] border border-cyan-300/45 bg-cyan-400/12 hover:bg-cyan-400/22 text-cyan-200 font-mono text-[11px] font-semibold cursor-pointer transition-colors"
            >
              + Sequence All ({visibleItems.length})
            </button>
          )}

          {favorites.length > 1 && (
            <button
              type="button"
              onClick={onClearAll}
              className="min-h-[36px] px-3 py-1 rounded-[2px] border border-rose-400/35 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 font-mono text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Clear All
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] px-3 py-1 rounded-[2px] border border-white/18 bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 font-mono text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Hide
            </button>
          )}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="glass-recessed rounded-[3px] p-4 sm:p-5 text-center flex flex-col items-center gap-1.5">
          <p className="font-sans text-xs sm:text-sm text-slate-200">
            {favorites.length === 0
              ? 'No favorite chords saved yet.'
              : `No saved chords for ${getInstrumentMeta(currentInstrument).label}.`}
          </p>
          <p className="font-mono text-[11px] text-slate-400">
            Tap the ☆ star on any chord card to pin it here for quick switching with the metronome.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
          {visibleItems.map(({ fav, chordData, voicing, instMeta }) => {
            const cardKey = `fav-${fav.id}`;
            const isStrumActive = activeStrumId === `${cardKey}:strum`;
            const isArpActive = activeStrumId === `${cardKey}:arpeggio`;
            const isSingleNote = voicing?.midiNotes?.length === 1;

            return (
              <article
                key={fav.id}
                className="glass-recessed rounded-[3px] p-2.5 sm:p-3 border border-white/14 flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="font-display font-bold text-base sm:text-lg text-white truncate">
                        {chordData.symbol}
                      </h3>
                      <span className="font-mono text-[10px] text-cyan-300 uppercase shrink-0">
                        {instMeta.shortLabel}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400 truncate">
                      {voicing?.label}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveFavorite(fav.id)}
                    aria-label={`Remove ${chordData.symbol} (${instMeta.label}) from favorites`}
                    className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] rounded-[2px] border border-amber-300/45 bg-amber-400/15 hover:bg-rose-500/20 hover:border-rose-300/50 text-amber-300 hover:text-rose-200 font-mono text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </div>

                <div className="rounded-[2px] bg-slate-950/45 py-1.5 px-1">
                  <ChordDiagramSVG
                    voicing={voicing}
                    rootPc={chordData.rootPc}
                    labelMode={labelMode}
                    compact
                    preferFlats={chordData.preferFlats}
                    instrumentLabel={fav.instrument}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onPlayChord(
                        cardKey,
                        voicing.midiNotes,
                        'strum',
                        fav.instrument,
                        refFrequency
                      )
                    }
                    className={`min-h-[40px] sm:min-h-[34px] px-2 py-1 rounded-[2px] border font-mono text-[11px] sm:text-[10px] font-semibold cursor-pointer transition-colors ${
                      isStrumActive
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : playMode === 'strum'
                          ? 'bg-white/[0.1] text-white border-white/22 hover:bg-white/[0.18]'
                          : 'bg-white/[0.05] text-slate-200 border-white/12 hover:bg-white/[0.14]'
                    }`}
                  >
                    {isSingleNote ? 'Pluck' : 'Strum'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPlayChord(
                        cardKey,
                        buildArpNotes(voicing, chordData.quality.intervals),
                        'arpeggio',
                        fav.instrument,
                        refFrequency
                      )
                    }
                    className={`min-h-[40px] sm:min-h-[34px] px-2 py-1 rounded-[2px] border font-mono text-[11px] sm:text-[10px] font-semibold cursor-pointer transition-colors ${
                      isArpActive
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : playMode === 'arpeggio'
                          ? 'bg-cyan-400/18 text-cyan-200 border-cyan-300/45 hover:bg-cyan-400/28'
                          : 'bg-white/[0.05] text-slate-200 border-white/12 hover:bg-white/[0.14]'
                    }`}
                  >
                    Arp
                  </button>
                  {onAddToSequence && (
                    <button
                      type="button"
                      onClick={() => onAddToSequence(fav)}
                      aria-label={`Add ${chordData.symbol} (${instMeta.label}) to rhythm sequence`}
                      className="min-h-[38px] sm:min-h-[34px] px-2 py-1 rounded-[2px] border border-cyan-300/40 bg-cyan-400/10 hover:bg-cyan-400/22 text-cyan-200 font-mono text-[11px] sm:text-[10px] font-semibold cursor-pointer transition-colors"
                    >
                      + Seq
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onInspectFavorite(fav, chordData)}
                    aria-label={`Open ${chordData.symbol} diagram`}
                    className={`${
                      onAddToSequence ? '' : 'col-span-2'
                    } min-h-[38px] sm:min-h-[34px] px-2 py-1 rounded-[2px] border border-white/14 bg-white/[0.04] hover:bg-white/[0.14] text-slate-300 hover:text-white font-mono text-[11px] sm:text-[10px] font-semibold cursor-pointer transition-colors`}
                  >
                    Open
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default FavoriteChordsTray;
