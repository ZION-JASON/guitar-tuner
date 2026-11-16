import React from 'react';
import { useTuner } from './hooks/useTuner';
import { matchPresetString, TUNING_PRESETS } from './utils/frequencyUtils';
import TunerDisplay from './components/TunerDisplay';
import StringMatrix from './components/StringMatrix';

function App() {
  const {
    data,
    isListening,
    micError,
    clearMicError,
    startTuner,
    stopTuner,
    refFrequency,
    setRefFrequency,
    presetId,
    setPresetId,
    lockedStringNum,
    setLockedStringNum,
    playingToneKey,
    toggleReferenceTone,
    stopReferenceTone,
  } = useTuner();

  const activePreset =
    TUNING_PRESETS.find((p) => p.id === presetId) || TUNING_PRESETS[0];

  const displayData =
    data.frequency > 0
      ? data
      : {
          ...data,
          ...matchPresetString(0, presetId, refFrequency, lockedStringNum),
        };

  return (
    <div className="relative min-h-dvh bg-[#090e1a] text-slate-50 flex flex-col overflow-x-hidden">
      {/* Ambient Animated Acoustic Mesh Orbs (for authentic frosted glass refraction) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full bg-cyan-500/20 blur-[110px] animate-orb-a" />
        <div className="absolute -bottom-36 -right-24 w-[440px] h-[440px] sm:w-[600px] sm:h-[600px] rounded-full bg-indigo-500/22 blur-[120px] animate-orb-b" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full bg-teal-400/10 blur-[100px]" />
      </div>

      {/* Compact Frosted Header */}
      <header className="relative z-20 glass-bar border-b border-white/12">
        <div className="max-w-[1280px] mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href="#main-tuner"
            className="font-display font-bold text-base sm:text-xl tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Chroma Glass
          </a>

          {/* Desktop Preset Bar */}
          <nav
            aria-label="Tuning Presets"
            className="hidden lg:flex items-center gap-1.5"
          >
            {TUNING_PRESETS.map((preset) => {
              const active = preset.id === presetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetId(preset.id)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap shrink-0 transition-[transform,background-color,border-color,color] duration-200 cursor-pointer ${
                    active
                      ? 'bg-white/18 text-white border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.1] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={isListening ? stopTuner : startTuner}
              className={`min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border font-mono text-xs font-semibold tracking-wide active:scale-[0.97] whitespace-nowrap shrink-0 transition-[transform,background-color,border-color,color] duration-200 cursor-pointer ${
                isListening
                  ? 'bg-rose-500/20 text-rose-100 border-rose-300/40 hover:bg-rose-500/30'
                  : 'bg-white/[0.08] text-slate-100 border-white/15 hover:bg-white/[0.16]'
              }`}
            >
              {isListening ? 'Mic Active · Stop' : 'Mic Standby'}
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Horizontal Touch Preset Bar */}
        <nav
          aria-label="Mobile Tuning Presets"
          className="lg:hidden border-t border-white/10 bg-white/[0.03] px-3.5 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar"
        >
          {TUNING_PRESETS.map((preset) => {
            const active = preset.id === presetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPresetId(preset.id)}
                aria-pressed={active}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap shrink-0 transition-[transform,background-color,border-color,color] duration-200 cursor-pointer ${
                  active
                    ? 'bg-white/20 text-white border-white/30'
                    : 'bg-white/[0.05] text-slate-300 border-white/10'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Workspace */}
      <main
        id="main-tuner"
        className="relative z-10 flex-1 w-full max-w-[1280px] mx-auto px-3.5 sm:px-6 pt-4 pb-24 lg:py-8 flex flex-col gap-4 sm:gap-6"
      >
        {/* Accessible Microphone Error Banner */}
        {micError && (
          <div
            role="alert"
            className="animate-glass-enter glass-panel rounded-2xl border-rose-400/40 bg-rose-500/12 px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
          >
            <div>
              <p className="font-display font-bold text-sm text-rose-100">
                {micError.title}
              </p>
              <p className="mt-1 font-sans text-sm text-rose-200/90">
                {micError.detail}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={startTuner}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-cyan-300/60 bg-cyan-400 text-slate-950 font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap cursor-pointer hover:bg-cyan-300 transition-[transform,background-color] duration-200"
              >
                Retry Mic
              </button>
              <button
                type="button"
                onClick={clearMicError}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-white/15 bg-white/10 text-slate-100 font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap cursor-pointer hover:bg-white/20 transition-[transform,background-color] duration-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          <div className="lg:col-span-8">
            <TunerDisplay
              data={displayData}
              isListening={isListening}
              onStartTuner={startTuner}
              onStopTuner={stopTuner}
              presetLabel={`${activePreset.label}${
                activePreset.shortLabel ? ` · ${activePreset.shortLabel}` : ''
              }`}
              lockedStringNum={lockedStringNum}
              onClearLock={() => setLockedStringNum(null)}
            />
          </div>

          <div className="lg:col-span-4">
            <StringMatrix
              preset={activePreset}
              refFrequency={refFrequency}
              onChangeRefFrequency={setRefFrequency}
              matchedStringNum={displayData.matchedStringNum}
              lockedStringNum={lockedStringNum}
              onToggleLockString={setLockedStringNum}
              playingToneKey={playingToneKey}
              onToggleTone={toggleReferenceTone}
              onStopTone={stopReferenceTone}
            />
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Frosted Thumb-Zone Control Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-bar border-t border-white/15 px-3.5 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex items-center gap-2.5">
        <button
          type="button"
          onClick={isListening ? stopTuner : startTuner}
          className={`flex-1 min-h-[48px] px-4 py-2.5 rounded-xl border font-display font-bold text-sm tracking-wide whitespace-nowrap cursor-pointer active:scale-[0.98] transition-[transform,background-color,border-color,box-shadow] duration-200 ${
            isListening
              ? 'bg-rose-500/25 text-rose-100 border-rose-300/40'
              : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_6px_20px_rgba(34,211,238,0.28)]'
          }`}
        >
          {isListening ? 'Stop Microphone' : 'Activate Microphone'}
        </button>

        {playingToneKey && (
          <button
            type="button"
            onClick={stopReferenceTone}
            className="min-h-[48px] px-4 py-2.5 rounded-xl border border-amber-300/45 bg-amber-400/20 text-amber-100 font-mono text-xs font-semibold active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer transition-[transform,background-color] duration-200"
          >
            Mute Tone
          </button>
        )}
      </div>
    </div>
  );
}

export default App;