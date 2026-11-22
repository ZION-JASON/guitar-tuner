import React from 'react';

const RULER_TICKS = [-50, -40, -30, -25, -20, -10, -5, 0, 5, 10, 20, 25, 30, 40, 50];
const MAJOR_LABELS = new Set([-50, -25, -10, 0, 10, 25, 50]);

const TunerDisplay = ({
  data,
  isListening,
  onStartTuner,
  onStopTuner,
  presetLabel,
  refFrequency = 440,
  lockedStringNum,
  onClearLock,
}) => {
  const {
    noteName,
    octave,
    cents,
    frequency,
    targetFrequency,
    clarity,
    rms,
    matchedStringNum,
  } = data;

  const hasSignal = isListening && frequency > 0 && noteName !== '-';
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const absCents = Math.abs(cents);
  const inTune = hasSignal && absCents <= 3;
  const isFlat = hasSignal && cents < -3;
  const isSharp = hasSignal && cents > 3;

  let directionLabel = 'Standby';
  let directionClasses =
    'bg-white/10 text-slate-200 border-white/15';
  if (isListening && !hasSignal) {
    directionLabel = 'Listening · Pluck string';
    directionClasses =
      'bg-cyan-400/15 text-cyan-200 border-cyan-300/45';
  } else if (inTune) {
    directionLabel = '◆ In tune · Locked';
    directionClasses =
      'bg-emerald-400 text-emerald-950 border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.4)]';
  } else if (isFlat) {
    directionLabel = '▲ Flat · Tune up';
    directionClasses =
      'bg-rose-400/20 text-rose-200 border-rose-400/50';
  } else if (isSharp) {
    directionLabel = '▼ Sharp · Tune down';
    directionClasses =
      'bg-amber-400/20 text-amber-200 border-amber-400/50';
  }

  const inputPercent = Math.min(100, Math.round((rms / 0.12) * 100));
  const clarityPercent = hasSignal ? Math.round(clarity * 100) : 0;

  return (
    <section
      aria-label="Primary Pitch Meter"
      className="glass-panel rounded-[4px] overflow-hidden flex flex-col justify-between transition-colors duration-200"
    >
      {/* Top Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/14 bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs font-medium tracking-wider text-slate-300 truncate">
            {presetLabel}
          </span>
          <span
            className={`font-mono text-xs tabular-nums whitespace-nowrap ${
              refFrequency !== 440
                ? 'text-amber-300 font-semibold'
                : 'text-slate-400'
            }`}
          >
            · A4 = {refFrequency} Hz
          </span>
          {lockedStringNum !== null && (
            <button
              type="button"
              onClick={onClearLock}
              className="min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-[2px] border border-amber-300/50 bg-amber-400/15 text-amber-200 font-mono text-xs font-semibold hover:bg-amber-400/25 active:scale-[0.98] transition-[transform,background-color] duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              String {lockedStringNum} Locked · Unlock
            </button>
          )}
        </div>

        <div
          className={`px-3 py-1 rounded-[2px] border font-mono text-xs font-semibold tracking-wide whitespace-nowrap shrink-0 transition-[background-color,border-color,color,box-shadow] duration-150 ${directionClasses}`}
          data-testid="tuning-status"
        >
          {directionLabel}
        </div>
      </div>

      {/* Central Note & Meter Stage */}
      <div className="px-3.5 py-4 sm:px-7 sm:py-7 flex flex-col items-center gap-4 sm:gap-6">
        {/* Sharp Note + Cents Readout Bay */}
        <div
          className={`relative w-full flex flex-row items-center justify-between gap-4 glass-recessed rounded-[3px] px-4 py-3.5 sm:p-7 overflow-hidden transition-[border-color,box-shadow] duration-200 ${
            inTune
              ? 'border-emerald-400/60 shadow-[0_0_32px_rgba(52,211,153,0.16)]'
              : ''
          }`}
        >
          {/* Crisp horizontal bottom signal rail when listening or locked */}
          {isListening && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] transition-colors duration-200 ${
                inTune
                  ? 'bg-emerald-400'
                  : isFlat
                    ? 'bg-rose-400'
                    : isSharp
                      ? 'bg-amber-300'
                      : 'bg-cyan-400/70'
              }`}
            />
          )}

          <div className="relative flex items-baseline gap-1.5 sm:gap-2">
            <span
              data-testid="detected-note"
              className={`font-display font-extrabold leading-none tracking-tight text-5xl sm:text-8xl select-none tabular-nums transition-colors duration-150 ${
                inTune
                  ? 'text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.45)]'
                  : hasSignal
                    ? 'text-white'
                    : 'text-slate-300'
              }`}
            >
              {noteName === '-' ? '--' : noteName}
            </span>
            {octave !== null && (
              <span className="font-mono font-semibold text-2xl sm:text-4xl text-slate-300">
                {octave}
              </span>
            )}
          </div>

          <div className="relative flex flex-col items-end gap-1 sm:gap-2">
            <div className="flex items-center gap-2">
              {matchedStringNum !== null && (
                <span className="px-2 py-0.5 rounded-[2px] border border-white/18 bg-white/10 font-mono text-[11px] sm:text-xs font-semibold text-slate-200 whitespace-nowrap">
                  String {matchedStringNum}
                </span>
              )}
              <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider text-slate-400">
                Deviation
              </span>
            </div>
            <div
              data-testid="cents-readout"
              className={`font-mono font-bold text-2xl sm:text-5xl tabular-nums whitespace-nowrap transition-colors duration-150 ${
                inTune
                  ? 'text-emerald-300'
                  : isFlat
                    ? 'text-rose-300'
                    : isSharp
                      ? 'text-amber-300'
                      : 'text-slate-100'
              }`}
            >
              {hasSignal
                ? `${cents > 0 ? '+' : ''}${cents.toFixed(1)} ¢`
                : '0.0 ¢'}
            </div>
          </div>
        </div>

        {/* Precision Linear Cents Ruler (-50c to +50c) */}
        <div className="w-full">
          <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2 font-mono text-[11px] sm:text-xs font-medium text-slate-300">
            <span className="whitespace-nowrap">-50¢ Flat</span>
            <span
              className={`whitespace-nowrap transition-colors duration-150 ${
                inTune ? 'text-emerald-300 font-semibold' : 'text-slate-300'
              }`}
            >
              Center (±3¢)
            </span>
            <span className="whitespace-nowrap">+50¢ Sharp</span>
          </div>

          <div className="relative h-14 sm:h-20 glass-recessed rounded-[2px] overflow-hidden select-none">
            {/* In-tune center zone (±3 cents = 6% total width) */}
            <div
              className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[6%] border-x transition-[background-color,border-color,box-shadow] duration-150 ${
                inTune
                  ? 'bg-emerald-400/35 border-emerald-300/85 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                  : 'bg-white/[0.06] border-white/25'
              }`}
            />

            {/* Crisp Top & Bottom 0-Cent Alignment Markers */}
            <div
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-cyan-300/80 pointer-events-none"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-b-[6px] border-b-cyan-300/80 pointer-events-none"
            />

            {/* Ruler tick marks */}
            {RULER_TICKS.map((tick) => {
              const leftPct = tick + 50;
              const isCenter = tick === 0;
              const isMajor = MAJOR_LABELS.has(tick);
              const isLeftEdge = tick === -50;
              const isRightEdge = tick === 50;
              const posClass = isLeftEdge
                ? 'left-0 translate-x-0 items-start pl-1.5'
                : isRightEdge
                  ? 'right-0 translate-x-0 items-end pr-1.5'
                  : '-translate-x-1/2 items-center';

              return (
                <div
                  key={tick}
                  style={isRightEdge ? undefined : { left: `${leftPct}%` }}
                  className={`absolute top-0 bottom-0 flex flex-col justify-between py-1.5 pointer-events-none ${posClass}`}
                >
                  <div
                    className={`w-[1.5px] rounded-none ${
                      isLeftEdge || isRightEdge
                        ? 'h-0'
                        : isCenter
                          ? 'h-full bg-white/45'
                          : isMajor
                            ? 'h-4 sm:h-5 bg-white/45'
                            : 'h-2.5 sm:h-3 bg-white/20'
                    }`}
                  />
                  {isMajor && tick !== 0 && (
                    <span className="font-mono text-[10px] font-medium text-slate-300 tabular-nums px-0.5">
                      {tick > 0 ? `+${tick}` : tick}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Moving Sharp Needle Track (GPU-composited transform) */}
            <div
              className="absolute inset-0 pointer-events-none transition-transform duration-100 ease-out"
              style={{
                transform: `translateX(${hasSignal ? clampedCents : 0}%)`,
              }}
            >
              <div
                className={`absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-1 rounded-none transition-[background-color,box-shadow,opacity] duration-150 ${
                  !hasSignal
                    ? 'bg-slate-400/45'
                    : inTune
                      ? 'bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.95)]'
                      : isFlat
                        ? 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.85)]'
                        : 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.85)]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Desktop Primary Action & Input Signal Strip */}
        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {!isListening ? (
            <button
              type="button"
              onClick={onStartTuner}
              className="hidden lg:inline-flex items-center justify-center min-h-[46px] px-6 py-2.5 rounded-[2px] border border-cyan-300/70 bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wide shadow-[0_6px_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300 active:scale-[0.98] transition-[transform,background-color,box-shadow] duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Activate Microphone Tuner
            </button>
          ) : (
            <button
              type="button"
              onClick={onStopTuner}
              className="hidden lg:inline-flex items-center justify-center min-h-[46px] px-6 py-2.5 rounded-[2px] border border-rose-400/50 bg-rose-500/20 text-rose-100 font-display font-bold text-sm tracking-wide hover:bg-rose-500/30 active:scale-[0.98] transition-[transform,background-color] duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Stop Microphone
            </button>
          )}

          <div className="flex-1 flex flex-col gap-2 glass-recessed rounded-[3px] px-4 py-2.5">
            <div className="flex items-center justify-between font-mono text-xs font-medium text-slate-300">
              <span>Input Signal (RMS)</span>
              <span className="tabular-nums text-slate-200">
                {isListening ? `${inputPercent}%` : 'OFF'}
              </span>
            </div>
            <div className="h-2 w-full rounded-[1px] bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-none transition-transform duration-100 origin-left ${
                  inTune ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}
                style={{ transform: `scaleX(${isListening ? inputPercent / 100 : 0})` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4-Cell Tabular Metric Strip (2x2 on mobile, 4-col on sm+/PC) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/14 bg-white/[0.02]">
        <div className="p-3 sm:p-4 border-r border-b sm:border-b-0 border-white/12 min-w-0">
          <div className="font-mono text-[11px] sm:text-xs text-slate-400 truncate">
            Detected
          </div>
          <div className="mt-0.5 sm:mt-1 font-mono text-sm sm:text-xl font-semibold tabular-nums text-slate-50 whitespace-nowrap truncate">
            {hasSignal ? `${frequency.toFixed(2)} Hz` : '0.00 Hz'}
          </div>
        </div>

        <div className="p-3 sm:p-4 sm:border-r border-b sm:border-b-0 border-white/12 min-w-0">
          <div className="font-mono text-[11px] sm:text-xs text-slate-400 truncate">
            Target
          </div>
          <div className="mt-0.5 sm:mt-1 font-mono text-sm sm:text-xl font-semibold tabular-nums text-slate-50 whitespace-nowrap truncate">
            {targetFrequency > 0 ? `${targetFrequency.toFixed(2)} Hz` : '--'}
          </div>
        </div>

        <div className="p-3 sm:p-4 border-r border-white/12 min-w-0">
          <div className="font-mono text-[11px] sm:text-xs text-slate-400 truncate">
            Stability
          </div>
          <div
            className={`mt-0.5 sm:mt-1 font-mono text-sm sm:text-xl font-semibold tabular-nums truncate ${
              inTune ? 'text-emerald-300' : 'text-slate-50'
            }`}
          >
            {hasSignal ? (inTune ? 'LOCKED' : 'TRACKING') : isListening ? 'READY' : 'STANDBY'}
          </div>
        </div>

        <div className="p-3 sm:p-4 min-w-0">
          <div className="font-mono text-[11px] sm:text-xs text-slate-400 truncate">
            Clarity
          </div>
          <div className="mt-0.5 sm:mt-1 font-mono text-sm sm:text-xl font-semibold tabular-nums text-slate-50 whitespace-nowrap truncate">
            {clarityPercent}%
          </div>
        </div>
      </div>
    </section>
  );
};

export default TunerDisplay;