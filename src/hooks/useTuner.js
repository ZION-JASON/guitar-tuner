import { useState, useRef, useCallback, useEffect } from 'react';
import { detectPitchYIN } from '../utils/pitchAlgorithm';
import {
  createInstrumentBodyChain,
  createPluckedAudioBuffer,
} from '../utils/audioSynth';
import {
  clampRefFrequency,
  DEFAULT_REF_FREQUENCY,
  getDefaultPresetIdForInstrument,
  getInstrumentMeta,
  matchPresetString,
  midiToFrequency,
  PitchStabilizer,
  TUNING_PRESETS,
} from '../utils/frequencyUtils';

const IDLE_DATA = {
  noteName: '-',
  octave: null,
  fullNote: '--',
  cents: 0,
  frequency: 0,
  targetFrequency: 0,
  clarity: 0,
  rms: 0,
  matchedStringNum: null,
};

function mapMicError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'PERMISSION_DENIED',
      title: 'Microphone access denied',
      detail: 'Allow microphone permissions in your browser settings and try again.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'NO_MICROPHONE',
      title: 'No microphone detected',
      detail: 'Connect an audio input or microphone, or use the Reference Tone generator.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'HARDWARE_BUSY',
      title: 'Audio device unavailable',
      detail: 'Your microphone may be in use by another application.',
    };
  }
  return {
    code: 'GENERIC',
    title: 'Unable to initialize audio input',
    detail: err?.message || 'Check your browser audio permissions and try again.',
  };
}

export const useTuner = (instrument = 'guitar') => {
  const [refFrequency, setRefFrequencyState] = useState(DEFAULT_REF_FREQUENCY);
  const [presetId, setPresetIdState] = useState(() =>
    getDefaultPresetIdForInstrument(instrument)
  );
  const [lockedStringNum, setLockedStringNumState] = useState(null);
  const [data, setData] = useState(IDLE_DATA);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const [playingToneKey, setPlayingToneKey] = useState(null);

  const instrumentRef = useRef(instrument);
  instrumentRef.current = instrument;
  const refFreqRef = useRef(refFrequency);
  const presetIdRef = useRef(presetId);
  const lockedStringRef = useRef(lockedStringNum);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const bufferRef = useRef(null);
  const rafRef = useRef(null);
  const startRequestIdRef = useRef(0);
  const lastPitchTimeRef = useRef(0);
  const stabilizerRef = useRef(new PitchStabilizer(5));

  // Separate playback refs for realistic plucked reference tone generator
  const toneCtxRef = useRef(null);
  const toneSourceRef = useRef(null);
  const toneGainRef = useRef(null);
  const toneTimerRef = useRef(null);
  const playingMidiRef = useRef(null);
  const playingFreqRef = useRef(null);

  const triggerReferencePluck = useCallback((freq, instrumentId) => {
    const ctx = toneCtxRef.current;
    if (!ctx || ctx.state === 'closed' || !Number.isFinite(freq) || freq <= 0) return;

    const now = ctx.currentTime;
    if (toneGainRef.current && toneSourceRef.current) {
      try {
        toneGainRef.current.gain.cancelScheduledValues(now);
        toneGainRef.current.gain.setTargetAtTime(0.0001, now, 0.018);
        toneSourceRef.current.stop(now + 0.06);
      } catch {
        // ignore stopped source
      }
    }

    const durationSec = instrumentId === 'ukulele' ? 1.85 : 2.5;
    const buffer = createPluckedAudioBuffer(ctx, freq, durationSec, instrumentId);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const body = createInstrumentBodyChain(ctx, instrumentId);
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.65, now);

    source.connect(body.input);
    body.output.connect(masterGain);
    masterGain.connect(ctx.destination);

    source.start(now);
    source.stop(now + durationSec + 0.05);

    toneSourceRef.current = source;
    toneGainRef.current = masterGain;
  }, []);

  const stopReferenceTone = useCallback(() => {
    playingMidiRef.current = null;
    playingFreqRef.current = null;
    if (toneTimerRef.current !== null) {
      clearInterval(toneTimerRef.current);
      toneTimerRef.current = null;
    }
    if (toneGainRef.current && toneCtxRef.current) {
      try {
        const now = toneCtxRef.current.currentTime;
        toneGainRef.current.gain.cancelScheduledValues(now);
        toneGainRef.current.gain.setTargetAtTime(0.0001, now, 0.02);
      } catch {
        // ignore audio node cleanup error
      }
    }
    if (toneSourceRef.current) {
      try {
        toneSourceRef.current.stop(toneCtxRef.current ? toneCtxRef.current.currentTime + 0.07 : 0);
      } catch {
        // ignore
      }
      toneSourceRef.current = null;
    }
    toneGainRef.current = null;
    setPlayingToneKey(null);
  }, []);

  const setRefFrequency = useCallback(
    (next) => {
      const clamped = clampRefFrequency(next);
      refFreqRef.current = clamped;
      setRefFrequencyState(clamped);

      if (playingMidiRef.current !== null && toneCtxRef.current) {
        const nextHz = midiToFrequency(playingMidiRef.current, clamped);
        playingFreqRef.current = nextHz;
        triggerReferencePluck(nextHz, instrumentRef.current);
      }
    },
    [triggerReferencePluck]
  );

  const setPresetId = useCallback((nextId) => {
    presetIdRef.current = nextId;
    lockedStringRef.current = null;
    setPresetIdState(nextId);
    setLockedStringNumState(null);
  }, []);

  const setLockedStringNum = useCallback((stringNum) => {
    const next = lockedStringRef.current === stringNum ? null : stringNum;
    lockedStringRef.current = next;
    setLockedStringNumState(next);
  }, []);

  const stopMicResources = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    bufferRef.current = null;
    stabilizerRef.current.reset();
  }, []);

  const stopTuner = useCallback(() => {
    startRequestIdRef.current += 1;
    stopMicResources();
    setIsListening(false);
    setData(IDLE_DATA);
  }, [stopMicResources]);

  const toggleReferenceTone = useCallback(
    async (key, frequency, midi = null) => {
      if (!Number.isFinite(frequency) || frequency <= 0) return;

      if (playingToneKey === key) {
        stopReferenceTone();
        return;
      }

      stopReferenceTone();

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!toneCtxRef.current || toneCtxRef.current.state === 'closed') {
          toneCtxRef.current = new AudioCtx();
        }
        const ctx = toneCtxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        playingMidiRef.current = midi;
        playingFreqRef.current = frequency;
        setPlayingToneKey(key);

        triggerReferencePluck(frequency, instrumentRef.current);

        // Naturally re-pluck every 2.2s so musicians can tune hands-free by ear
        toneTimerRef.current = setInterval(() => {
          const activeHz = playingFreqRef.current;
          if (activeHz && activeHz > 0) {
            triggerReferencePluck(activeHz, instrumentRef.current);
          }
        }, 2200);
      } catch {
        playingMidiRef.current = null;
        playingFreqRef.current = null;
        setPlayingToneKey(null);
      }
    },
    [playingToneKey, stopReferenceTone, triggerReferencePluck]
  );

  const startTuner = useCallback(async () => {
    setMicError(null);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMicError({
        code: 'INSECURE_CONTEXT',
        title: 'Microphone API unavailable',
        detail: 'Microphone input requires a secure HTTPS or localhost context.',
      });
      return;
    }

    const requestId = ++startRequestIdRef.current;
    stopMicResources();

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          channelCount: 1,
        },
      });

      // If stopped or superseded while awaiting permission, release immediately
      if (requestId !== startRequestIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (requestId !== startRequestIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
        return;
      }

      const source = ctx.createMediaStreamSource(stream);

      // Clean instrument bandpass: preserve 5-string Bass B0 (30.87Hz) while cutting sub-24Hz rumble and >1400Hz pick scratch
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 24;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1400;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize);
      stabilizerRef.current.reset();
      lastPitchTimeRef.current = performance.now();

      setIsListening(true);

      const tick = (now) => {
        if (requestId !== startRequestIdRef.current || !analyserRef.current || !audioContextRef.current) {
          return;
        }

        const buffer = bufferRef.current;
        analyserRef.current.getFloatTimeDomainData(buffer);
        const instMeta = getInstrumentMeta(instrumentRef.current);

        const { frequency, clarity, rms } = detectPitchYIN(
          buffer,
          audioContextRef.current.sampleRate,
          {
            minFreq: instMeta.minFreq,
            maxFreq: instMeta.maxFreq,
            threshold: 0.15,
            rmsThreshold: 0.006,
          }
        );

        if (frequency > 0 && clarity >= 0.72) {
          const stabilized = stabilizerRef.current.push(frequency, clarity);
          if (stabilized > 0) {
            lastPitchTimeRef.current = now;
            const matched = matchPresetString(
              stabilized,
              presetIdRef.current,
              refFreqRef.current,
              lockedStringRef.current
            );
            setData({
              noteName: matched.noteName,
              octave: matched.octave,
              fullNote: matched.fullNote,
              cents: matched.cents,
              frequency: stabilized,
              targetFrequency: matched.targetFrequency,
              clarity,
              rms,
              matchedStringNum: matched.matchedStringNum,
            });
          }
        } else {
          // Hold last reading briefly (250ms) across micro-dips, then clear cleanly
          if (now - lastPitchTimeRef.current > 250) {
            stabilizerRef.current.reset();
            const idleMatch = matchPresetString(
              0,
              presetIdRef.current,
              refFreqRef.current,
              lockedStringRef.current
            );
            setData({
              ...IDLE_DATA,
              noteName: idleMatch.noteName,
              octave: idleMatch.octave,
              fullNote: idleMatch.fullNote,
              targetFrequency: idleMatch.targetFrequency,
              matchedStringNum: idleMatch.matchedStringNum,
              rms,
            });
          } else {
            setData((prev) => ({ ...prev, rms }));
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      if (requestId === startRequestIdRef.current) {
        stopMicResources();
        setIsListening(false);
        setMicError(mapMicError(err));
      }
    }
  }, [stopMicResources]);

  useEffect(() => {
    const currentPreset = TUNING_PRESETS.find((p) => p.id === presetIdRef.current);
    if (
      currentPreset &&
      currentPreset.instrument !== 'all' &&
      currentPreset.instrument !== instrument
    ) {
      const nextPresetId = getDefaultPresetIdForInstrument(instrument);
      presetIdRef.current = nextPresetId;
      lockedStringRef.current = null;
      setPresetIdState(nextPresetId);
      setLockedStringNumState(null);
      stopReferenceTone();
    }
  }, [instrument, stopReferenceTone]);

  useEffect(() => {
    return () => {
      startRequestIdRef.current += 1;
      stopMicResources();
      stopReferenceTone();
      if (toneCtxRef.current && toneCtxRef.current.state !== 'closed') {
        toneCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopMicResources, stopReferenceTone]);

  return {
    data,
    isListening,
    micError,
    clearMicError: () => setMicError(null),
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
  };
};