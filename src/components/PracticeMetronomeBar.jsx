import React, { useState, useEffect, useRef } from 'react';
import { learnAudio } from '../utils/audioSynth';
import {
  clampBpm,
  computeTapTempoBpm,
  DEFAULT_BPM,
  getTimeSignatureConfig,
  MAX_BPM,
  MIN_BPM,
  TIME_SIGNATURES,
} from '../utils/metronome';

const PracticeMetronomeBar = ({
  favoritesCount = 0,
  showFavoritesTray = false,
  onToggleFavoritesTray,
}) => {
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [timeSigId, setTimeSigId] = useState('4/4');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(null);
  const tapHistoryRef = useRef([]);

  const timeSig = getTimeSignatureConfig(timeSigId);

  useEffect(() => {
    if (!isPlaying) return;
    learnAudio.updateMetronome({ bpm, beatsPerBar: timeSig.beats });
  }, [bpm, timeSig.beats, isPlaying]);

  useEffect(() => {
    return () => {
      learnAudio.stopMetronome();
    };
  }, []);

  const handleTogglePlay = () => {
    if (isPlaying) {
      learnAudio.stopMetronome();
      setIsPlaying(false);
      setActiveBeat(null);
      return;
    }

    const started = learnAudio.startMetronome({
      bpm,
      beatsPerBar: timeSig.beats,
      onBeat: (beatIdx) => {
        setActiveBeat(beatIdx);
      },
    });
    if (started) {
      setIsPlaying(true);
    }
  };

  const adjustBpm = (delta) => {
    setBpm((prev) => clampBpm(prev + delta));
  };

  const handleTapTempo = () => {
    const now = Date.now();
    const prev = tapHistoryRef.current;
    const trimmed =
      prev.length > 0 && now - prev[prev.length - 1] > 2200 ? [] : prev;
    const nextTaps = [...trimmed, now].slice(-6);
    tapHistoryRef.current = nextTaps;

    const detected = computeTapTempoBpm(nextTaps);
    if (detected !== null) {
      setBpm(detected);
    }
  };

  return (
    <section
      aria-label="Practice Metronome & Favorites Dock"
      className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Title + Live Visual Beat LEDs */}
        <div className="flex flex-wrap items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display font-bold text-sm sm:text-base text-white">
              Practice Metronome
            </span>
            <div
              role="status"
              aria-label={
                isPlaying && activeBeat !== null
                  ? `Beat ${(activeBeat % timeSig.beats) + 1} of ${timeSig.beats}`
                  : 'Metronome stopped'
              }
              className="flex items-center gap-1.5 glass-recessed rounded-full px-2.5 py-1.5"
            >
              {Array.from({ length: timeSig.beats }).map((_, idx) => {
                const isCurrent = isPlaying && activeBeat === idx;
                const isAccentBeat = idx === 0;
                return (
                  <span
                    key={`beat-dot-${idx}`}
                    className={`w-2.5 h-2.5 rounded-full transition-[transform,background-color,box-shadow] duration-75 ${
                      isCurrent
                        ? isAccentBeat
                          ? 'bg-cyan-400 scale-125 shadow-[0_0_12px_rgba(34,211,238,0.85)]'
                          : 'bg-white scale-115 shadow-[0_0_8px_rgba(255,255,255,0.75)]'
                        : isAccentBeat
                          ? 'bg-cyan-400/30'
                          : 'bg-white/15'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Mobile Quick Favorites Toggle */}
          {onToggleFavoritesTray && (
            <button
              type="button"
              onClick={onToggleFavoritesTray}
              aria-expanded={showFavoritesTray}
              className={`lg:hidden min-h-[38px] px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                showFavoritesTray
                  ? 'bg-amber-400/20 text-amber-200 border-amber-300/45'
                  : 'bg-white/[0.06] text-slate-200 border-white/15 hover:bg-white/[0.14]'
              }`}
            >
              <span aria-hidden="true" className="text-amber-300">
                ★
              </span>
              <span>Saved ({favoritesCount})</span>
            </button>
          )}
        </div>

        {/* Center: BPM Stepper + Slider + Tap Tempo */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-1 glass-recessed rounded-xl p-1">
            <button
              type="button"
              onClick={() => adjustBpm(-5)}
              disabled={bpm <= MIN_BPM}
              aria-label="Decrease tempo by 5 BPM"
              className="min-h-[36px] px-2 rounded-lg font-mono text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
            >
              -5
            </button>
            <button
              type="button"
              onClick={() => adjustBpm(-1)}
              disabled={bpm <= MIN_BPM}
              aria-label="Decrease tempo by 1 BPM"
              className="min-h-[36px] min-w-[34px] px-2 rounded-lg font-mono text-xs font-bold text-slate-200 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
            >
              −
            </button>
            <div className="px-2 text-center min-w-[76px]">
              <span className="font-display font-bold text-base sm:text-lg text-white tabular-nums">
                {bpm}
              </span>
              <span className="ml-1 font-mono text-[10px] text-cyan-300 font-semibold">
                BPM
              </span>
            </div>
            <button
              type="button"
              onClick={() => adjustBpm(1)}
              disabled={bpm >= MAX_BPM}
              aria-label="Increase tempo by 1 BPM"
              className="min-h-[36px] min-w-[34px] px-2 rounded-lg font-mono text-xs font-bold text-slate-200 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => adjustBpm(5)}
              disabled={bpm >= MAX_BPM}
              aria-label="Increase tempo by 5 BPM"
              className="min-h-[36px] px-2 rounded-lg font-mono text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
            >
              +5
            </button>
          </div>

          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(clampBpm(e.target.value))}
            aria-label="Metronome Tempo BPM Slider"
            className="w-24 sm:w-32 accent-cyan-400 cursor-pointer"
          />

          <button
            type="button"
            onClick={handleTapTempo}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.15] text-slate-100 font-mono text-xs font-semibold active:scale-[0.95] cursor-pointer transition-colors"
          >
            Tap
          </button>
        </div>

        {/* Right: Time Signatures + Start/Stop + Desktop Favorites Toggle */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
          <div
            role="group"
            aria-label="Metronome Time Signature"
            className="flex items-center gap-1 glass-recessed rounded-xl p-1"
          >
            {TIME_SIGNATURES.map((ts) => {
              const active = ts.id === timeSigId;
              return (
                <button
                  key={ts.id}
                  type="button"
                  onClick={() => setTimeSigId(ts.id)}
                  aria-pressed={active}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ts.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleTogglePlay}
            className={`min-h-[40px] px-4 py-1.5 rounded-xl border font-mono text-xs font-semibold whitespace-nowrap active:scale-[0.97] cursor-pointer transition-[transform,background-color,border-color,color] duration-150 ${
              isPlaying
                ? 'bg-rose-500/25 text-rose-100 border-rose-300/45 hover:bg-rose-500/35'
                : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_14px_rgba(34,211,238,0.28)] hover:bg-cyan-300'
            }`}
          >
            {isPlaying ? 'Stop Beat' : 'Start Beat'}
          </button>

          {onToggleFavoritesTray && (
            <button
              type="button"
              onClick={onToggleFavoritesTray}
              aria-expanded={showFavoritesTray}
              className={`hidden lg:inline-flex min-h-[40px] px-3.5 py-1.5 rounded-xl border font-mono text-xs font-semibold items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                showFavoritesTray
                  ? 'bg-amber-400/20 text-amber-200 border-amber-300/45'
                  : 'bg-white/[0.06] text-slate-200 border-white/15 hover:bg-white/[0.14]'
              }`}
            >
              <span aria-hidden="true" className="text-amber-300">
                ★
              </span>
              <span>Saved Chords ({favoritesCount})</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default PracticeMetronomeBar;
