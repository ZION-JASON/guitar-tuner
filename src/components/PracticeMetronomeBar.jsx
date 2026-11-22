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
  bpm: controlledBpm,
  onBpmChange,
  timeSigId: controlledTimeSigId,
  onTimeSigChange,
  isPlaying: controlledIsPlaying,
  onPlayingChange,
  favoritesCount = 0,
  showFavoritesTray = false,
  onToggleFavoritesTray,
  sequenceCount = 0,
  showSequencer = false,
  onToggleSequencer,
}) => {
  const [internalBpm, setInternalBpm] = useState(DEFAULT_BPM);
  const [internalTimeSigId, setInternalTimeSigId] = useState('4/4');
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(null);
  const tapHistoryRef = useRef([]);

  const bpm = controlledBpm !== undefined ? controlledBpm : internalBpm;
  const setBpm = (valOrUpdater) => {
    const nextVal =
      typeof valOrUpdater === 'function' ? valOrUpdater(bpm) : valOrUpdater;
    const clamped = clampBpm(nextVal);
    if (onBpmChange) {
      onBpmChange(clamped);
    } else {
      setInternalBpm(clamped);
    }
  };

  const timeSigId =
    controlledTimeSigId !== undefined ? controlledTimeSigId : internalTimeSigId;
  const setTimeSigId = (nextId) => {
    if (onTimeSigChange) {
      onTimeSigChange(nextId);
    } else {
      setInternalTimeSigId(nextId);
    }
  };

  const isPlaying =
    controlledIsPlaying !== undefined ? controlledIsPlaying : internalIsPlaying;
  const setIsPlaying = (nextPlaying) => {
    if (onPlayingChange) {
      onPlayingChange(nextPlaying);
    } else {
      setInternalIsPlaying(nextPlaying);
    }
  };

  const timeSig = getTimeSignatureConfig(timeSigId);

  useEffect(() => {
    if (!isPlaying) {
      setActiveBeat(null);
      return;
    }
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
      className="glass-panel rounded-[4px] p-3.5 sm:p-4 flex flex-col gap-3"
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
              className="flex items-center gap-1.5 glass-recessed rounded-[2px] px-2.5 py-1.5"
            >
              {Array.from({ length: timeSig.beats }).map((_, idx) => {
                const isCurrent = isPlaying && activeBeat === idx;
                const isAccentBeat = idx === 0;
                return (
                  <span
                    key={`beat-dot-${idx}`}
                    className={`w-3 h-2 rounded-[1px] transition-[transform,background-color,box-shadow] duration-75 ${
                      isCurrent
                        ? isAccentBeat
                          ? 'bg-cyan-400 scale-115 shadow-[0_0_10px_rgba(34,211,238,0.85)]'
                          : 'bg-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.75)]'
                        : isAccentBeat
                          ? 'bg-cyan-400/30'
                          : 'bg-white/15'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: BPM Stepper + Slider + Tap Tempo */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-0.5 sm:gap-1 glass-recessed rounded-[3px] p-1">
              <button
                type="button"
                onClick={() => adjustBpm(-5)}
                disabled={bpm <= MIN_BPM}
                aria-label="Decrease tempo by 5 BPM"
                className="min-h-[42px] sm:min-h-[36px] min-w-[38px] sm:min-w-0 px-2 rounded-[2px] font-mono text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
              >
                -5
              </button>
              <button
                type="button"
                onClick={() => adjustBpm(-1)}
                disabled={bpm <= MIN_BPM}
                aria-label="Decrease tempo by 1 BPM"
                className="min-h-[42px] sm:min-h-[36px] min-w-[38px] sm:min-w-[34px] px-2 rounded-[2px] font-mono text-sm sm:text-xs font-bold text-slate-200 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
              >
                −
              </button>
              <div className="px-1.5 sm:px-2 text-center min-w-[70px] sm:min-w-[76px]">
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
                className="min-h-[42px] sm:min-h-[36px] min-w-[38px] sm:min-w-[34px] px-2 rounded-[2px] font-mono text-sm sm:text-xs font-bold text-slate-200 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => adjustBpm(5)}
                disabled={bpm >= MAX_BPM}
                aria-label="Increase tempo by 5 BPM"
                className="min-h-[42px] sm:min-h-[36px] min-w-[38px] sm:min-w-0 px-2 rounded-[2px] font-mono text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer transition-colors"
              >
                +5
              </button>
            </div>

            <button
              type="button"
              onClick={handleTapTempo}
              className="sm:hidden min-h-[44px] px-4 py-2 rounded-[2px] border border-white/18 bg-white/[0.06] hover:bg-white/[0.15] text-slate-100 font-mono text-xs font-semibold active:scale-[0.97] shrink-0 cursor-pointer transition-colors"
            >
              Tap
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
            className="w-full sm:w-32 h-2 rounded-[1px] accent-cyan-400 cursor-pointer my-1 sm:my-0"
          />

          <button
            type="button"
            onClick={handleTapTempo}
            className="hidden sm:inline-flex items-center justify-center min-h-[38px] px-3 py-1.5 rounded-[2px] border border-white/18 bg-white/[0.06] hover:bg-white/[0.15] text-slate-100 font-mono text-xs font-semibold active:scale-[0.97] cursor-pointer transition-colors"
          >
            Tap
          </button>
        </div>

        {/* Right: Time Signatures + Start/Stop + Favorites & Sequencer Toggles */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
          <div
            role="group"
            aria-label="Metronome Time Signature"
            className="flex-1 sm:flex-none grid grid-cols-4 sm:flex items-center gap-1 glass-recessed rounded-[3px] p-1"
          >
            {TIME_SIGNATURES.map((ts) => {
              const active = ts.id === timeSigId;
              return (
                <button
                  key={ts.id}
                  type="button"
                  onClick={() => setTimeSigId(ts.id)}
                  aria-pressed={active}
                  className={`min-h-[40px] sm:min-h-[36px] px-2 sm:px-2.5 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
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
            className={`min-h-[44px] sm:min-h-[40px] px-4 py-1.5 rounded-[2px] border font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.98] cursor-pointer transition-[transform,background-color,border-color,color] duration-150 ${
              isPlaying
                ? 'bg-rose-500/25 text-rose-100 border-rose-400/55 hover:bg-rose-500/35'
                : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_2px_12px_rgba(34,211,238,0.28)] hover:bg-cyan-300'
            }`}
          >
            {isPlaying ? 'Stop Beat' : 'Start Beat'}
          </button>

          {(onToggleFavoritesTray || onToggleSequencer) && (
            <div className="w-full lg:w-auto grid grid-cols-2 lg:flex items-center gap-2">
              {onToggleFavoritesTray && (
                <button
                  type="button"
                  onClick={onToggleFavoritesTray}
                  aria-expanded={showFavoritesTray}
                  className={`min-h-[42px] lg:min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    showFavoritesTray
                      ? 'bg-amber-400/20 text-amber-200 border-amber-300/55'
                      : 'bg-white/[0.06] text-slate-200 border-white/18 hover:bg-white/[0.14]'
                  }`}
                >
                  <span aria-hidden="true" className="text-amber-300">
                    ★
                  </span>
                  <span>Saved ({favoritesCount})</span>
                </button>
              )}

              {onToggleSequencer && (
                <button
                  type="button"
                  onClick={onToggleSequencer}
                  aria-expanded={showSequencer}
                  className={`min-h-[42px] lg:min-h-[40px] px-3 py-1.5 rounded-[2px] border font-mono text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    showSequencer
                      ? 'bg-cyan-400/20 text-cyan-200 border-cyan-300/55'
                      : 'bg-white/[0.06] text-slate-200 border-white/18 hover:bg-white/[0.14]'
                  }`}
                >
                  <span>Sequence ({sequenceCount})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PracticeMetronomeBar;
