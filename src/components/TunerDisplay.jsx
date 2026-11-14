import React from 'react';

const RULER_TICKS = [-50, -40, -30, -25, -20, -10, -5, 0, 5, 10, 20, 25, 30, 40, 50];
const MAJOR_LABELS = new Set([-50, -25, -10, 0, 10, 25, 50]);

const TunerDisplay = ({
  data,
  isListening,
  onStartTuner,
  onStopTuner,
  presetLabel,
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

  let directionLabel = 'Microphone standby';
  let directionTone = 'bg-[#E5E0D5] text-[#111111] border-[#111111]';
  if (isListening && !hasSignal) {
    directionLabel = 'Listening · Pluck a string';
    directionTone = 'bg-white text-[#111111] border-[#111111]';
  } else if (inTune) {
    directionLabel = 'In tune · Locked';
    directionTone = 'bg-[#00E065] text-[#111111] border-[#111111]';
  } else if (isFlat) {
    directionLabel = 'Flat · Tune up';
    directionTone = 'bg-[#FF3B00] text-white border-[#111111]';
  } else if (isSharp) {
    directionLabel = 'Sharp · Tune down';
    directionTone = 'bg-[#111111] text-[#FFCC00] border-[#111111]';
  }

  const inputPercent = Math.min(100, Math.round((rms / 0.12) * 100));
  const clarityPercent = hasSignal ? Math.round(clarity * 100) : 0;

  return (
    <section
      aria-label="Primary Pitch Meter"
      className="bg-white border-2 border-[#111111] brutal-shadow flex flex-col justify-between"
    >
      {/* Top Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b-2 border-[#111111] bg-[#F8F6F2]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#111111]">
            Mode: {presetLabel}
          </span>
          {lockedStringNum !== null && (
            <button
              type="button"
              onClick={onClearLock}
              className="px-2 py-0.5 border border-[#111111] bg-[#FFCC00] text-[#111111] font-mono text-xs font-semibold uppercase hover:bg-[#111111] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              String {lockedStringNum} Locked · Unlock
            </button>
          )}
        </div>

        <div
          className={`px-3 py-1 border-2 font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${directionTone}`}
          data-testid="tuning-status"
        >
          {directionLabel}
        </div>
      </div>

      {/* Central Note & Meter Stage */}
      <div className="px-5 py-8 sm:px-8 sm:py-10 flex flex-col items-center gap-8">
        {/* Giant Note Block */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-6 border-2 border-[#111111] bg-[#F2EFE9] p-6 sm:p-8">
          <div className="flex items-baseline gap-2">
            <span
              data-testid="detected-note"
              className={`font-display font-black leading-none tracking-tight text-7xl sm:text-8xl select-none tabular-nums ${
                inTune ? 'text-[#007A37]' : 'text-[#111111]'
              }`}
            >
              {noteName === '-' ? '--' : noteName}
            </span>
            {octave !== null && (
              <span className="font-mono font-bold text-3xl sm:text-4xl text-[#444444]">
                {octave}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center sm:items-end gap-2">
            <div className="flex items-center gap-2">
              {matchedStringNum !== null && (
                <span className="px-2.5 py-1 border-2 border-[#111111] bg-white font-mono text-xs font-bold uppercase">
                  String {matchedStringNum}
                </span>
              )}
              <span className="font-mono text-xs uppercase tracking-wider text-[#444444]">
                Deviation
              </span>
            </div>
            <div
              data-testid="cents-readout"
              className="font-mono font-bold text-4xl sm:text-5xl tabular-nums text-[#111111]"
            >
              {hasSignal
                ? `${cents > 0 ? '+' : ''}${cents.toFixed(1)} ¢`
                : '0.0 ¢'}
            </div>
          </div>
        </div>

        {/* Precision Linear Cents Ruler (-50c to +50c) */}
        <div className="w-full">
          <div className="flex items-center justify-between gap-2 mb-2 font-mono text-[11px] sm:text-xs font-semibold uppercase text-[#444444]">
            <span className="whitespace-nowrap">-50¢ Flat</span>
            <span
              className={`whitespace-nowrap ${
                inTune ? 'text-[#007A37] font-bold' : ''
              }`}
            >
              Center (±3¢)
            </span>
            <span className="whitespace-nowrap">+50¢ Sharp</span>
          </div>

          <div className="relative h-20 border-2 border-[#111111] bg-[#E5E0D5] overflow-hidden select-none">
            {/* In-tune center zone (±3 cents = 6% total width) */}
            <div
              className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[6%] border-x border-[#111111]/40 transition-colors ${
                inTune ? 'bg-[#00E065]' : 'bg-[#FFFFFF]'
              }`}
            />

            {/* Ruler tick marks */}
            {RULER_TICKS.map((tick) => {
              const leftPct = tick + 50;
              const isCenter = tick === 0;
              const isMajor = MAJOR_LABELS.has(tick);
              const isLeftEdge = tick === -50;
              const isRightEdge = tick === 50;
              const posClass = isLeftEdge
                ? 'left-0 translate-x-0 items-start pl-1'
                : isRightEdge
                  ? 'right-0 translate-x-0 items-end pr-1'
                  : '-translate-x-1/2 items-center';

              return (
                <div
                  key={tick}
                  style={isRightEdge ? undefined : { left: `${leftPct}%` }}
                  className={`absolute top-0 bottom-0 flex flex-col justify-between py-1 pointer-events-none ${posClass}`}
                >
                  <div
                    className={`w-[2px] ${
                      isLeftEdge || isRightEdge
                        ? 'h-0'
                        : isCenter
                          ? 'h-full bg-[#111111]'
                          : isMajor
                            ? 'h-5 bg-[#111111]'
                            : 'h-3 bg-[#111111]/45'
                    }`}
                  />
                  {isMajor && tick !== 0 && (
                    <span className="font-mono text-[10px] font-bold text-[#111111] tabular-nums bg-[#E5E0D5]/90 px-0.5">
                      {tick > 0 ? `+${tick}` : tick}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Moving Needle Track (GPU-composited transform) */}
            <div
              className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
              style={{
                transform: `translateX(${hasSignal ? clampedCents : 0}%)`,
              }}
            >
              <div
                className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2 border-x border-[#111111] ${
                  !hasSignal
                    ? 'bg-[#777777] opacity-40'
                    : inTune
                      ? 'bg-[#008A3E]'
                      : 'bg-[#FF3B00]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Action & Input Signal Strip */}
        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {!isListening ? (
            <button
              type="button"
              onClick={onStartTuner}
              className="px-6 py-3.5 border-2 border-[#111111] bg-[#FF3B00] text-white font-display font-extrabold text-sm uppercase tracking-wider brutal-shadow-sm hover:bg-[#111111] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Activate Microphone Tuner
            </button>
          ) : (
            <button
              type="button"
              onClick={onStopTuner}
              className="px-6 py-3.5 border-2 border-[#111111] bg-[#111111] text-white font-display font-extrabold text-sm uppercase tracking-wider hover:bg-[#FF3B00] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Stop Microphone
            </button>
          )}

          <div className="flex-1 flex flex-col gap-1.5 border-2 border-[#111111] bg-[#F8F6F2] px-4 py-2.5">
            <div className="flex items-center justify-between font-mono text-xs font-semibold uppercase">
              <span>Input Signal (RMS)</span>
              <span className="tabular-nums">{isListening ? `${inputPercent}%` : 'OFF'}</span>
            </div>
            <div className="h-2.5 w-full bg-[#E5E0D5] border border-[#111111] overflow-hidden">
              <div
                className="h-full bg-[#111111] transition-transform duration-75 origin-left"
                style={{ transform: `scaleX(${isListening ? inputPercent / 100 : 0})` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4-Cell Tabular Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t-2 border-[#111111] bg-[#F8F6F2]">
        <div className="p-4 border-b-2 sm:border-b-0 border-r-2 border-[#111111]">
          <div className="font-mono text-xs uppercase text-[#555555]">Detected Pitch</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#111111]">
            {hasSignal ? `${frequency.toFixed(2)} Hz` : '0.00 Hz'}
          </div>
        </div>

        <div className="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-[#111111]">
          <div className="font-mono text-xs uppercase text-[#555555]">Target Pitch</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#111111]">
            {targetFrequency > 0 ? `${targetFrequency.toFixed(2)} Hz` : '--'}
          </div>
        </div>

        <div className="p-4 border-r-2 border-[#111111]">
          <div className="font-mono text-xs uppercase text-[#555555]">Stability</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#111111]">
            {hasSignal ? (inTune ? 'LOCKED' : 'TRACKING') : isListening ? 'READY' : 'STANDBY'}
          </div>
        </div>

        <div className="p-4">
          <div className="font-mono text-xs uppercase text-[#555555]">YIN Clarity</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#111111]">
            {clarityPercent}%
          </div>
        </div>
      </div>
    </section>
  );
};

export default TunerDisplay;