import React from 'react';
import {
  MAX_REF_FREQUENCY,
  MIN_REF_FREQUENCY,
  midiToFrequency,
} from '../utils/frequencyUtils';

const QUICK_REFS = [432, 440, 442];

const CHROMATIC_GUIDE = [
  { key: 'E2', label: 'E2', midi: 40 },
  { key: 'A2', label: 'A2', midi: 45 },
  { key: 'D3', label: 'D3', midi: 50 },
  { key: 'G3', label: 'G3', midi: 55 },
  { key: 'B3', label: 'B3', midi: 59 },
  { key: 'E4', label: 'E4', midi: 64 },
  { key: 'A4', label: 'A4', midi: 69 },
];

const StringMatrix = ({
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

  return (
    <aside className="flex flex-col gap-6">
      {/* A4 Reference Calibration Panel */}
      <div className="bg-white border-2 border-[#111111] brutal-shadow">
        <div className="px-5 py-3.5 border-b-2 border-[#111111] bg-[#F8F6F2] flex items-center justify-between">
          <h2 className="font-display font-extrabold text-sm uppercase tracking-wider">
            Concert Pitch Calibration
          </h2>
          <span
            data-testid="ref-frequency-readout"
            className="font-mono text-sm font-bold tabular-nums text-[#111111]"
          >
            A4 = {refFrequency} Hz
          </span>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {QUICK_REFS.map((freq) => {
              const active = refFrequency === freq;
              return (
                <button
                  key={freq}
                  type="button"
                  onClick={() => onChangeRefFrequency(freq)}
                  className={`py-2.5 px-3 border-2 border-[#111111] font-mono text-xs font-bold tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#F2EFE9] text-[#111111] hover:bg-[#E5E0D5]'
                  }`}
                >
                  {freq} Hz
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-2 border-[#111111] bg-[#F8F6F2] p-2">
            <button
              type="button"
              onClick={() => onChangeRefFrequency(refFrequency - 1)}
              disabled={refFrequency <= MIN_REF_FREQUENCY}
              aria-label="Decrease reference frequency by 1 Hz"
              className="px-3.5 py-2 border-2 border-[#111111] bg-white font-mono text-sm font-bold hover:bg-[#111111] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              -1 Hz
            </button>
            <span className="font-mono text-xs uppercase text-[#444444] tabular-nums">
              Range {MIN_REF_FREQUENCY}–{MAX_REF_FREQUENCY} Hz
            </span>
            <button
              type="button"
              onClick={() => onChangeRefFrequency(refFrequency + 1)}
              disabled={refFrequency >= MAX_REF_FREQUENCY}
              aria-label="Increase reference frequency by 1 Hz"
              className="px-3.5 py-2 border-2 border-[#111111] bg-white font-mono text-sm font-bold hover:bg-[#111111] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              +1 Hz
            </button>
          </div>
        </div>
      </div>

      {/* String Matrix & Reference Tone Generator */}
      <div className="bg-white border-2 border-[#111111] brutal-shadow flex-1 flex flex-col">
        <div className="px-5 py-3.5 border-b-2 border-[#111111] bg-[#F8F6F2] flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-extrabold text-sm uppercase tracking-wider">
              {hasStrings ? `${preset.label} Strings` : 'Reference Tones'}
            </h2>
          </div>
          {playingToneKey && (
            <button
              type="button"
              onClick={onStopTone}
              className="px-2.5 py-1 border-2 border-[#111111] bg-[#FF3B00] text-white font-mono text-xs font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
            >
              Mute Tone
            </button>
          )}
        </div>

        <div className="divide-y-2 divide-[#111111]">
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
                  className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                    isLocked
                      ? 'bg-[#FFCC00]'
                      : isMatched
                        ? 'bg-[#D6F5E3]'
                        : 'bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleLockString(s.stringNum)}
                    className="flex-1 flex items-center justify-between gap-3 text-left py-1 cursor-pointer"
                    aria-pressed={isLocked}
                    aria-label={`Lock string ${s.stringNum} ${s.noteName}${s.octave}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 flex items-center justify-center border-2 border-[#111111] bg-[#F2EFE9] font-mono text-xs font-bold tabular-nums">
                        {s.stringNum}
                      </span>
                      <span className="font-display font-black text-lg text-[#111111]">
                        {s.noteName}
                        <span className="font-mono text-xs font-semibold text-[#444444]">
                          {s.octave}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#333333]">
                        {targetHz.toFixed(2)} Hz
                      </span>
                      {isLocked && (
                        <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 bg-[#111111] text-white">
                          LOCKED
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
                    className={`px-3 py-1.5 border-2 border-[#111111] font-mono text-xs font-bold uppercase whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isPlaying
                        ? 'bg-[#FF3B00] text-white'
                        : 'bg-[#F2EFE9] text-[#111111] hover:bg-[#111111] hover:text-white'
                    }`}
                  >
                    {isPlaying ? 'Stop' : 'Tone'}
                  </button>
                </div>
              );
            })
          ) : (
            CHROMATIC_GUIDE.map((item) => {
              const targetHz = midiToFrequency(item.midi, refFrequency);
              const toneKey = `chromatic-${item.key}`;
              const isPlaying = playingToneKey === toneKey;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display font-black text-lg text-[#111111]">
                      {item.label}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-[#444444]">
                      {targetHz.toFixed(2)} Hz
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleTone(toneKey, targetHz, item.midi)}
                    aria-pressed={isPlaying}
                    className={`px-3 py-1.5 border-2 border-[#111111] font-mono text-xs font-bold uppercase whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isPlaying
                        ? 'bg-[#FF3B00] text-white'
                        : 'bg-[#F2EFE9] text-[#111111] hover:bg-[#111111] hover:text-white'
                    }`}
                  >
                    {isPlaying ? 'Stop' : 'Tone'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t-2 border-[#111111] bg-[#F8F6F2] font-mono text-xs text-[#444444] leading-relaxed">
          {hasStrings
            ? 'Click any string row to lock target tracking, or press Tone to hear its exact reference pitch.'
            : 'Chromatic mode tracks all 12 semitones across 38 Hz–1200 Hz automatically.'}
        </div>
      </div>
    </aside>
  );
};

export default StringMatrix;
