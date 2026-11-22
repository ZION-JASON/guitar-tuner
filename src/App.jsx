import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTuner } from './hooks/useTuner';
import {
  getInstrumentMeta,
  getPresetsForInstrument,
  INSTRUMENTS,
  matchPresetString,
} from './utils/frequencyUtils';
import { learnAudio } from './utils/audioSynth';
import {
  buildNextNavSnapshot,
  createInitialNavSnapshot,
  normalizeNavSnapshot,
} from './utils/navigationHistory';
import TunerDisplay from './components/TunerDisplay';
import StringMatrix from './components/StringMatrix';
import LearnSection from './components/LearnSection';
import ChromaTunerLogo from './components/ChromaTunerLogo';

function App() {
  const [navState, setNavState] = useState(() => createInitialNavSnapshot());
  const navRef = useRef(navState);
  navRef.current = navState;
  const activeInstrument = navState.instrument || 'guitar';

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
  } = useTuner(activeInstrument);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.history.replaceState(navRef.current, '');

    const handlePopState = (event) => {
      learnAudio.stopAll();
      stopReferenceTone();
      const restored = normalizeNavSnapshot(event.state);
      navRef.current = restored;
      setNavState(restored);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [stopReferenceTone]);

  const navigate = useCallback(
    (patch, options = {}) => {
      const nextSnap = buildNextNavSnapshot(navRef.current, patch, options);
      if (nextSnap.view === 'tuner') {
        learnAudio.stopAll();
      } else {
        stopReferenceTone();
      }
      navRef.current = nextSnap;
      setNavState(nextSnap);

      if (typeof window !== 'undefined') {
        if (options.replace) {
          window.history.replaceState(nextSnap, '');
        } else {
          window.history.pushState(nextSnap, '');
        }
      }
    },
    [stopReferenceTone]
  );

  const goBack = useCallback(() => {
    learnAudio.stopAll();
    stopReferenceTone();
    if (typeof window !== 'undefined' && navRef.current.stepIndex > 0) {
      window.history.back();
    }
  }, [stopReferenceTone]);

  const activeView = navState.view;
  const activeInstrumentMeta = getInstrumentMeta(activeInstrument);
  const visiblePresets = getPresetsForInstrument(activeInstrument);

  const activePreset =
    visiblePresets.find((p) => p.id === presetId) ||
    visiblePresets.find((p) => p.id === activeInstrumentMeta.defaultPresetId) ||
    visiblePresets[0];

  const displayData =
    data.frequency > 0
      ? data
      : {
          ...data,
          ...matchPresetString(0, activePreset.id, refFrequency, lockedStringNum),
        };

  const switchView = (nextView) => {
    if (nextView === activeView) return;
    navigate({ view: nextView });
  };

  const selectInstrument = (nextInstrument) => {
    if (nextInstrument === activeInstrument) return;
    navigate({ instrument: nextInstrument });
  };

  return (
    <div className="relative min-h-dvh bg-[#070b14] text-slate-50 flex flex-col overflow-x-hidden">
      {/* Crisp Architectural Studio Grid & Directional Top Accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 studio-grid-bg"
      >
        <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,rgba(34,211,238,0.11),transparent)]" />
      </div>

      {/* 3-Zone Single-Row Precision Header */}
      <header className="relative z-20 glass-bar border-b border-white/14">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-8">
          <button
            type="button"
            onClick={() => switchView('tuner')}
            className="inline-flex items-center gap-2 sm:gap-2.5 font-display font-bold text-[15px] sm:text-xl tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer text-left min-h-[40px]"
          >
            <ChromaTunerLogo className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" />
            <span>ChromaTuner</span>
          </button>

          {/* Top-Level Navigation: Tuner | Learn */}
          <nav
            aria-label="Primary Navigation"
            className="flex items-center gap-1 glass-recessed rounded-[3px] p-1"
          >
            <button
              type="button"
              onClick={() => switchView('tuner')}
              aria-pressed={activeView === 'tuner'}
              className={`min-h-[38px] px-3 sm:px-5 py-1.5 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.98] transition-[transform,background-color,color] duration-150 cursor-pointer ${
                activeView === 'tuner'
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_2px_10px_rgba(34,211,238,0.28)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Tuner
            </button>
            <button
              type="button"
              onClick={() => switchView('learn')}
              aria-pressed={activeView === 'learn'}
              className={`min-h-[38px] px-3 sm:px-5 py-1.5 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.98] transition-[transform,background-color,color] duration-150 cursor-pointer ${
                activeView === 'learn'
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_2px_10px_rgba(34,211,238,0.28)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Learn
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={isListening ? stopTuner : startTuner}
              className={`min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 rounded-[2px] border font-mono text-xs font-semibold tracking-wide active:scale-[0.98] whitespace-nowrap shrink-0 transition-[transform,background-color,border-color,color] duration-150 cursor-pointer ${
                isListening
                  ? 'bg-rose-500/20 text-rose-100 border-rose-400/55 hover:bg-rose-500/30'
                  : 'bg-white/[0.08] text-slate-100 border-white/18 hover:bg-white/[0.16]'
              }`}
            >
              <span className="sm:hidden">{isListening ? 'Mic On' : 'Mic Off'}</span>
              <span className="hidden sm:inline">
                {isListening ? 'Mic Active · Stop' : 'Mic Standby'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        id="main-workspace"
        className={`relative z-10 flex-1 w-full max-w-[1280px] mx-auto px-3 sm:px-6 pt-3 lg:py-6 flex flex-col gap-3.5 sm:gap-5 ${
          activeView === 'tuner'
            ? 'pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-10'
            : 'pb-[calc(2.5rem+env(safe-area-inset-bottom))] lg:pb-10'
        }`}
      >
        {/* Instrument & Tuning Preset Workspace Bar (Tuner View) */}
        {activeView === 'tuner' && (
          <div className="glass-panel rounded-[4px] p-2 sm:px-3.5 sm:py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
            <div
              role="group"
              aria-label="Instrument Selector"
              className="grid grid-cols-3 sm:flex items-center gap-1 glass-recessed rounded-[3px] p-1 shrink-0"
            >
              {INSTRUMENTS.map((inst) => {
                const active = inst.id === activeInstrument;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => selectInstrument(inst.id)}
                    aria-pressed={active}
                    className={`min-h-[40px] sm:min-h-[36px] px-3 py-1 rounded-[2px] font-mono text-xs font-semibold whitespace-nowrap shrink-0 active:scale-[0.98] transition-[transform,background-color,color] duration-150 cursor-pointer ${
                      active
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_2px_10px_rgba(34,211,238,0.28)]'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {inst.label}
                  </button>
                );
              })}
            </div>

            <div
              aria-hidden="true"
              className="hidden sm:block h-5 w-px bg-white/15 shrink-0"
            />

            <nav
              aria-label="Tuning Presets"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1"
            >
              {visiblePresets.map((preset) => {
                const active = preset.id === activePreset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPresetId(preset.id)}
                    aria-pressed={active}
                    className={`min-h-[40px] sm:min-h-[36px] px-3 sm:px-3.5 py-1.5 rounded-[2px] border font-mono text-xs font-semibold active:scale-[0.98] whitespace-nowrap shrink-0 transition-[transform,background-color,border-color,color] duration-150 cursor-pointer ${
                      active
                        ? 'bg-white/20 text-white border-cyan-300/60'
                        : 'bg-white/[0.05] text-slate-300 border-white/12 hover:bg-white/[0.1]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
        {/* Accessible Microphone Error Banner */}
        {micError && (
          <div
            role="alert"
            className="animate-glass-enter glass-panel rounded-[4px] border-rose-400/50 bg-rose-500/12 px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
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
                className="min-h-[42px] px-4 py-2 rounded-[2px] border border-cyan-300/70 bg-cyan-400 text-slate-950 font-mono text-xs font-semibold active:scale-[0.98] whitespace-nowrap cursor-pointer hover:bg-cyan-300 transition-[transform,background-color] duration-150"
              >
                Retry Mic
              </button>
              <button
                type="button"
                onClick={clearMicError}
                className="min-h-[42px] px-4 py-2 rounded-[2px] border border-white/18 bg-white/10 text-slate-100 font-mono text-xs font-semibold active:scale-[0.98] whitespace-nowrap cursor-pointer hover:bg-white/20 transition-[transform,background-color] duration-150"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {activeView === 'tuner' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
            <div className="lg:col-span-8">
              <TunerDisplay
                data={displayData}
                isListening={isListening}
                onStartTuner={startTuner}
                onStopTuner={stopTuner}
                presetLabel={`${activeInstrumentMeta.label.toUpperCase()} · ${activePreset.label}${
                  activePreset.shortLabel ? ` · ${activePreset.shortLabel}` : ''
                }`}
                refFrequency={refFrequency}
                lockedStringNum={lockedStringNum}
                onClearLock={() => setLockedStringNum(null)}
              />
            </div>

            <div className="lg:col-span-4">
              <StringMatrix
                instrument={activeInstrument}
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
        ) : (
          <LearnSection
            instrument={activeInstrument}
            onSelectInstrument={selectInstrument}
            refFrequency={refFrequency}
            learnState={navState.learn}
            onUpdateLearn={(learnPatch, options) =>
              navigate({ learn: learnPatch }, options)
            }
            canGoBack={navState.stepIndex > 0}
            prevLabel={navState.prevLabel}
            onGoBack={goBack}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Thumb-Zone Control Bar (Tuner View) */}
      {activeView === 'tuner' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-bar border-t border-white/15 px-3.5 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex items-center gap-2.5">
          <button
            type="button"
            onClick={isListening ? stopTuner : startTuner}
            className={`flex-1 min-h-[46px] px-4 py-2 rounded-[2px] border font-display font-bold text-sm tracking-wide whitespace-nowrap cursor-pointer active:scale-[0.98] transition-[transform,background-color,border-color,box-shadow] duration-150 ${
              isListening
                ? 'bg-rose-500/25 text-rose-100 border-rose-400/50'
                : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_4px_16px_rgba(34,211,238,0.28)]'
            }`}
          >
            {isListening ? 'Stop Microphone' : 'Activate Microphone'}
          </button>

          {playingToneKey && (
            <button
              type="button"
              onClick={stopReferenceTone}
              className="min-h-[46px] px-4 py-2 rounded-[2px] border border-amber-300/50 bg-amber-400/20 text-amber-100 font-mono text-xs font-semibold active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer transition-[transform,background-color] duration-150"
            >
              Mute Tone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;