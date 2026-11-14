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

  // Ensure locked string target note & Hz show immediately even when standby or silent
  const displayData =
    data.frequency > 0
      ? data
      : {
          ...data,
          ...matchPresetString(0, presetId, refFrequency, lockedStringNum),
        };

  return (
    <div className="min-h-screen bg-[#F2EFE9] brutal-grid-bg text-[#111111] flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="bg-white border-b-2 border-[#111111]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sm:gap-8">
          <a
            href="#main-tuner"
            className="font-display font-black text-lg sm:text-xl tracking-tight uppercase text-[#111111] whitespace-nowrap shrink-0"
          >
            Brutalist Tuner
          </a>

          <nav
            aria-label="Tuning Presets"
            className="flex flex-wrap items-center gap-1.5"
          >
            {TUNING_PRESETS.map((preset) => {
              const active = preset.id === presetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetId(preset.id)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 border-2 border-[#111111] font-mono text-xs font-bold uppercase whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#F2EFE9] text-[#111111] hover:bg-[#E5E0D5]'
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
              className={`px-4 py-2 border-2 border-[#111111] font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isListening
                  ? 'bg-[#FF3B00] text-white hover:bg-[#111111]'
                  : 'bg-white text-[#111111] hover:bg-[#111111] hover:text-white'
              }`}
            >
              {isListening ? 'Mic Active · Stop' : 'Mic Standby'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        id="main-tuner"
        className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6"
      >
        {/* Accessible Microphone Error Banner */}
        {micError && (
          <div
            role="alert"
            className="bg-[#FFF0EC] border-2 border-[#111111] brutal-shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <p className="font-display font-extrabold text-sm uppercase text-[#111111]">
                {micError.title}
              </p>
              <p className="mt-1 font-sans text-sm text-[#222222]">
                {micError.detail}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={startTuner}
                className="px-3.5 py-2 border-2 border-[#111111] bg-[#FF3B00] text-white font-mono text-xs font-bold uppercase whitespace-nowrap cursor-pointer hover:bg-[#111111]"
              >
                Retry Mic
              </button>
              <button
                type="button"
                onClick={clearMicError}
                className="px-3.5 py-2 border-2 border-[#111111] bg-white text-[#111111] font-mono text-xs font-bold uppercase whitespace-nowrap cursor-pointer hover:bg-[#E5E0D5]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
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
    </div>
  );
}

export default App;