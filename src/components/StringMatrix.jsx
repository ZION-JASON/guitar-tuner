import React from 'react';
import {
  DEFAULT_REF_FREQUENCY,
  getInstrumentMeta,
  MAX_REF_FREQUENCY,
  MIN_REF_FREQUENCY,
  midiToFrequency,
} from '../utils/frequencyUtils';

const QUICK_REFS = [432, 440, 442];

const CHROMATIC_GUIDES = {
  guitar: [
    { key: 'E2', label: 'E2', midi: 40 },
    { key: 'A2', label: 'A2', midi: 45 },
    { key: 'D3', label: 'D3', midi: 50 },
    { key: 'G3', label: 'G3', midi: 55 },
    { key: 'B3', label: 'B3', midi: 59 },
    { key: 'E4', label: 'E4', midi: 64 },
    { key: 'A4', label: 'A4', midi: 69 },
  ],
  bass: [
    { key: 'B0', label: 'B0', midi: 23 },
    { key: 'E1', label: 'E1', midi: 28 },
    { key: 'A1', label: 'A1', midi: 33 },
    { key: 'D2', label: 'D2', midi: 38 },
    { key: 'G2', label: 'G2', midi: 43 },
    { key: 'C3', label: 'C3', midi: 48 },
  ],
  ukulele: [
    { key: 'G3', label: 'G3', midi: 55 },
    { key: 'C4', label: 'C4', midi: 60 },
    { key: 'E4', label: 'E4', midi: 64 },
    { key: 'G4', label: 'G4', midi: 67 },
    { key: 'A4', label: 'A4', midi: 69 },
  ],
};

const StringMatrix = ({
  instrument = 'guitar',
  preset,
  refFrequency,
  onChangeRefFrequency,
  matchedStringNum,
  lockedStringNum,
  onToggleLockString,
  playingToneKey,
  onToggleTone,
  onStopTone,
}) => {
  const hasStrings = preset.strings.length > 0;
  const instMeta = getInstrumentMeta(instrument);
  const chromaticList = CHROMATIC_GUIDES[instMeta.id] || CHROMATIC_GUIDES.guitar;

  return (
    <aside className="flex flex-col gap-4 sm:gap-6">
      {/* String Matrix & Realistic Plucked Reference Generator */}
      <div className="glass-panel rounded-2xl overflow-hidden flex-1 flex flex-col">
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/12 bg-white/[0.03] flex items-center justify-between gap-2">
          <h2 className="font-display font-bold text-sm tracking-wide text-slate-100">
            {hasStrings ? `${preset.label} Strings` : 'Reference Tones'}
          </h2>
          {playingToneKey && (
            <button
              type="button"
              onClick={onStopTone}
              className="min-h-[36px] px-3 py-1 rounded-lg border border-rose-300/40 bg-rose-500/25 text-rose-100 font-mono text-xs font-semibold hover:bg-rose-500/35 active:scale-[0.97] transition-[transform,background-color] duration-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Mute Tone
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 p-2.5 sm:p-0 sm:gap-0 sm:divide-y sm:divide-white/10">
          {hasStrings ? (
            preset.strings.map((s) => {
              const targetHz = midiToFrequency(s.midi, refFrequency);
              const toneKey = `${preset.id}-${s.stringNum}`;
              const isPlaying = playingToneKey === toneKey;
              const isLocked = lockedStringNum === s.stringNum;
              const isMatched = matchedStringNum === s.stringNum;

              return (
                <div
                  key={s.stringNum}
                  className={`flex items-center justify-between gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-2.5 min-h-[56px] sm:min-h-[58px] rounded-xl sm:rounded-none border sm:border-0 transition-colors duration-200 ${
                    isLocked
                      ? 'bg-amber-400/15 border-amber-300/35'
                      : isMatched
                        ? 'bg-emerald-400/12 border-emerald-300/35'
                        : 'bg-white/[0.03] sm:bg-transparent border-white/10 hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleLockString(s.stringNum)}
                    className="flex-1 min-w-0 min-h-[44px] flex items-center justify-between gap-2 sm:gap-3 text-left py-0.5 sm:py-1 cursor-pointer"
                    aria-pressed={isLocked}
                    aria-label={`Lock string ${s.stringNum} ${s.noteName}${s.octave}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border font-mono text-xs font-semibold tabular-nums shrink-0 transition-colors duration-200 ${
                          isLocked
                            ? 'border-amber-300/50 bg-amber-400/20 text-amber-200'
                            : isMatched
                              ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-200'
                              : 'border-white/15 bg-white/[0.07] text-slate-200'
                        }`}
                      >
                        {s.stringNum}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1 min-w-0">
                        <span className="font-display font-bold text-base sm:text-lg text-slate-50 leading-tight">
                          {s.noteName}
                          <span className="font-mono text-[11px] sm:text-xs font-medium text-slate-400 ml-0.5">
                            {s.octave}
                          </span>
                        </span>
                        <span className="sm:hidden font-mono text-[10px] tabular-nums text-slate-400 leading-tight truncate">
                          {isLocked ? 'Locked' : `${targetHz.toFixed(1)} Hz`}
                        </span>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">
                      <span className="font-mono text-xs font-medium tabular-nums text-slate-300">
                        {targetHz.toFixed(2)} Hz
                      </span>
                      {isLocked && (
                        <span className="font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-300 text-slate-950">
                          Locked
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleTone(toneKey, targetHz, s.midi)}
                    aria-pressed={isPlaying}
                    aria-label={
                      isPlaying
                        ? `Stop reference tone for ${s.noteName}${s.octave}`
                        : `Play reference tone for ${s.noteName}${s.octave}`
                    }
                    className={`min-h-[44px] min-w-[50px] sm:min-w-[68px] px-2.5 sm:px-3 py-2 rounded-xl border font-mono text-[11px] sm:text-xs font-semibold active:scale-[0.96] whitespace-nowrap shrink-0 transition-[transform,background-color,border-color,color,box-shadow] duration-200 cursor-pointer ${
                      isPlaying
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.35)]'
                        : 'bg-white/[0.07] text-slate-200 border-white/15 hover:bg-white/[0.15]'
                    }`}
                  >
                    {isPlaying ? 'Stop' : 'Tone'}
                  </button>
                </div>
              );
            })
          ) : (
            chromaticList.map((item) => {
              const targetHz = midiToFrequency(item.midi, refFrequency);
              const toneKey = `chromatic-${instMeta.id}-${item.key}`;
              const isPlaying = playingToneKey === toneKey;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-2.5 min-h-[54px] sm:min-h-[58px] rounded-xl sm:rounded-none border sm:border-0 border-white/10 bg-white/[0.03] sm:bg-transparent hover:bg-white/[0.04] transition-colors duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 min-w-0">
                    <span className="font-display font-bold text-base sm:text-lg text-slate-50 leading-tight">
                      {item.label}
                    </span>
                    <span className="font-mono text-[11px] sm:text-xs font-medium tabular-nums text-slate-300">
                      {targetHz.toFixed(1)} Hz
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleTone(toneKey, targetHz, item.midi)}
                    aria-pressed={isPlaying}
                    className={`min-h-[44px] min-w-[50px] sm:min-w-[68px] px-2.5 sm:px-3 py-2 rounded-xl border font-mono text-[11px] sm:text-xs font-semibold active:scale-[0.96] whitespace-nowrap shrink-0 transition-[transform,background-color,border-color,color,box-shadow] duration-200 cursor-pointer ${
                      isPlaying
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.35)]'
                        : 'bg-white/[0.07] text-slate-200 border-white/15 hover:bg-white/[0.15]'
                    }`}
                  >
                    {isPlaying ? 'Stop' : 'Tone'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 sm:p-4 border-t border-white/12 bg-white/[0.02] font-sans text-xs text-slate-400 leading-relaxed">
          {hasStrings
            ? 'Tap any string to lock tracking, or tap Tone to pluck its calibrated reference pitch.'
            : `Chromatic mode (${instMeta.label}) tracks all 12 semitones across ${instMeta.minFreq} Hz–${instMeta.maxFreq} Hz automatically.`}
        </div>
      </div>

      {/* A4 Reference Calibration Panel */}
      {(() => {
        const deltaHz = refFrequency - DEFAULT_REF_FREQUENCY;
        const isStandard = deltaHz === 0;
        const sliderPct =
          ((refFrequency - MIN_REF_FREQUENCY) /
            (MAX_REF_FREQUENCY - MIN_REF_FREQUENCY)) *
          100;

        return (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 sm:px-5 sm:py-3.5 border-b border-white/12 bg-white/[0.03] flex items-center justify-between gap-2">
              <h2 className="font-display font-bold text-sm tracking-wide text-slate-100 whitespace-nowrap">
                A4 Calibration
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                {!isStandard && (
                  <button
                    type="button"
                    onClick={() => onChangeRefFrequency(DEFAULT_REF_FREQUENCY)}
                    className="min-h-[36px] sm:min-h-[30px] px-2.5 py-1 rounded-lg border border-amber-300/35 bg-amber-400/15 hover:bg-amber-400/25 font-mono text-[11px] font-semibold text-amber-200 cursor-pointer transition-colors"
                  >
                    Reset 440
                  </button>
                )}
                <span
                  data-testid="ref-frequency-readout"
                  className={`font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                    isStandard ? 'text-cyan-300' : 'text-amber-300'
                  }`}
                >
                  A4 = {refFrequency} Hz
                </span>
              </div>
            </div>

            <div className="p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-3.5">
              <div className="grid grid-cols-3 gap-2">
                {QUICK_REFS.map((freq) => {
                  const active = refFrequency === freq;
                  return (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => onChangeRefFrequency(freq)}
                      aria-pressed={active}
                      className={`min-h-[42px] sm:min-h-[44px] py-2 px-3 rounded-xl border font-mono text-xs font-semibold tabular-nums active:scale-[0.97] transition-[transform,background-color,border-color,color] duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.25)]'
                          : 'bg-white/[0.06] text-slate-200 border-white/12 hover:bg-white/[0.12]'
                      }`}
                    >
                      {freq} Hz
                    </button>
                  );
                })}
              </div>

              {/* Stepper with prominent live center Hz readout */}
              <div className="flex items-center justify-between gap-2 glass-recessed rounded-xl p-1.5 sm:p-2 border border-white/10">
                <button
                  type="button"
                  onClick={() => onChangeRefFrequency(refFrequency - 1)}
                  disabled={refFrequency <= MIN_REF_FREQUENCY}
                  aria-label="Decrease reference frequency by 1 Hz"
                  className="min-h-[46px] min-w-[68px] sm:min-w-[74px] px-3.5 py-2 rounded-lg border border-white/15 bg-white/[0.08] font-mono text-sm font-semibold text-slate-100 hover:bg-white/[0.16] active:scale-[0.96] disabled:opacity-35 disabled:cursor-not-allowed transition-[transform,background-color,opacity] duration-200 cursor-pointer shrink-0"
                >
                  -1 Hz
                </button>

                <div
                  role="status"
                  aria-live="polite"
                  className="flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1"
                >
                  <div
                    data-testid="calibration-stepper-value"
                    className={`font-mono text-xl sm:text-2xl font-extrabold tabular-nums leading-tight ${
                      isStandard ? 'text-cyan-300' : 'text-amber-300'
                    }`}
                  >
                    {refFrequency} Hz
                  </div>
                  <div
                    className={`font-mono text-[10px] sm:text-[11px] tabular-nums leading-tight mt-0.5 ${
                      isStandard ? 'text-slate-400' : 'text-amber-200/90'
                    }`}
                  >
                    {isStandard
                      ? 'Standard pitch'
                      : `${deltaHz > 0 ? '+' : ''}${deltaHz} Hz from 440`}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onChangeRefFrequency(refFrequency + 1)}
                  disabled={refFrequency >= MAX_REF_FREQUENCY}
                  aria-label="Increase reference frequency by 1 Hz"
                  className="min-h-[46px] min-w-[68px] sm:min-w-[74px] px-3.5 py-2 rounded-lg border border-white/15 bg-white/[0.08] font-mono text-sm font-semibold text-slate-100 hover:bg-white/[0.16] active:scale-[0.96] disabled:opacity-35 disabled:cursor-not-allowed transition-[transform,background-color,opacity] duration-200 cursor-pointer shrink-0"
                >
                  +1 Hz
                </button>
              </div>

              {/* Continuous 415–465 Hz visual slider for instant position awareness */}
              <div className="flex flex-col gap-1 px-0.5">
                <input
                  type="range"
                  min={MIN_REF_FREQUENCY}
                  max={MAX_REF_FREQUENCY}
                  step={1}
                  value={refFrequency}
                  onChange={(e) => onChangeRefFrequency(Number(e.target.value))}
                  aria-label={`A4 Calibration slider, currently ${refFrequency} Hz`}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-cyan-400"
                  style={{
                    background: `linear-gradient(to right, rgba(34,211,238,0.85) 0%, rgba(34,211,238,0.85) ${sliderPct}%, rgba(255,255,255,0.14) ${sliderPct}%, rgba(255,255,255,0.14) 100%)`,
                  }}
                />
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 tabular-nums">
                  <span>{MIN_REF_FREQUENCY} Hz</span>
                  <button
                    type="button"
                    onClick={() => onChangeRefFrequency(DEFAULT_REF_FREQUENCY)}
                    className={`cursor-pointer hover:text-cyan-300 transition-colors ${
                      isStandard ? 'text-cyan-300 font-semibold' : ''
                    }`}
                  >
                    {DEFAULT_REF_FREQUENCY} Hz (Ref)
                  </button>
                  <span>{MAX_REF_FREQUENCY} Hz</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </aside>
  );
};

export default StringMatrix;
