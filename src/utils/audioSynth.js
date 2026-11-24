import { midiToFrequency } from './frequencyUtils.js';
import {
  findNearestSample,
  getCoreWarmupSamples,
  loadSampleBuffer,
} from './sampleLibrary.js';
import { expandRhythmEventsForStep, getRhythmPattern } from './rhythmTheory.js';

const INSTRUMENT_TIMBRE = {
  guitar: {
    pickPos: 0.19,
    loopDamping: 0.125,
    rt60DbPerSec: -7.8,
    noiseMix: 0.11,
    noiseCutoffRatio: 0.09,
    pluckRoundFrac: 0.032, // rounded bevel plectrum transient without harsh synth buzz
    bodyTapMix: 0.09,
    bodyTapHz: 102,
    bodyLowHz: 100,
    bodyLowGainDb: 4.5,
    bodyMidHz: 205,
    bodyMidGainDb: 2.8,
    presenceHz: 2550,
    presenceGainDb: 0.9,
    attackCutoffHz: 4100,
    sustainCutoffHz: 1620,
    brightnessDecaySec: 0.44,
    roomWetMix: 0.22,
    sampleRoomWetMix: 0.16,
    roomDecaySec: 0.34,
    strumStepSec: 0.023,
    defaultNoteDuration: 2.1,
    defaultChordDuration: 3.1,
  },
  bass: {
    pickPos: 0.28,
    loopDamping: 0.22,
    rt60DbPerSec: -8.5,
    noiseMix: 0.09, // subtle finger-skin transient, zero synth buzz
    noiseCutoffRatio: 0.04,
    pluckRoundFrac: 0.09, // thick fleshy finger pluck (period-proportional)
    bodyTapMix: 0.14,
    bodyTapHz: 94,
    bodyLowHz: 92,
    bodyLowGainDb: 3.5,
    bodyMidHz: 235, // warm woody punch audible on mobile speakers
    bodyMidGainDb: 4.0,
    presenceHz: 720,
    presenceGainDb: 1.4,
    attackCutoffHz: 1750, // crisp finger attack
    sustainCutoffHz: 420, // deep warm woody bass sustain (eliminates low-note buzz)
    brightnessDecaySec: 0.38,
    roomWetMix: 0.12,
    sampleRoomWetMix: 0.08,
    roomDecaySec: 0.18,
    strumStepSec: 0.032,
    defaultNoteDuration: 1.95,
    defaultChordDuration: 2.55,
  },
  ukulele: {
    pickPos: 0.24,
    loopDamping: 0.15,
    rt60DbPerSec: -11.0,
    noiseMix: 0.11,
    noiseCutoffRatio: 0.09,
    pluckRoundFrac: 0.055, // warm compliant nylon/fluorocarbon string rounding
    bodyTapMix: 0.11,
    bodyTapHz: 305,
    bodyLowHz: 285,
    bodyLowGainDb: 4.2,
    bodyMidHz: 540,
    bodyMidGainDb: 2.8,
    presenceHz: 1600,
    presenceGainDb: 0.5,
    attackCutoffHz: 3600, // gentle nylon sparkle at attack
    sustainCutoffHz: 1550, // sweet mellow koa/mahogany sustain
    brightnessDecaySec: 0.45,
    roomWetMix: 0.22,
    sampleRoomWetMix: 0.17,
    roomDecaySec: 0.24,
    strumStepSec: 0.018,
    defaultNoteDuration: 1.75,
    defaultChordDuration: 2.35,
  },
};

export function getInstrumentTimbre(instrumentId = 'guitar') {
  return INSTRUMENT_TIMBRE[instrumentId] || INSTRUMENT_TIMBRE.guitar;
}

function createBodyBandpassCoeffs(f0, q, sampleRate) {
  const safeFreq = Math.max(30, Math.min(sampleRate * 0.42, f0));
  const w0 = (2 * Math.PI * safeFreq) / sampleRate;
  const sinW0 = Math.sin(w0);
  const cosW0 = Math.cos(w0);
  const alpha = sinW0 / (2 * Math.max(0.5, q));
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b2: -alpha / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha) / a0,
  };
}

/**
 * Pure-JS Physical String Synthesis (Plucked-Triangle + Thiran Allpass + 3-Tap Symmetric Loop
 * + Coupled Wooden Acoustic Soundboard Resonators).
 * Models realistic initial string displacement, plectrum compliance smoothing, 1st-order Thiran
 * Allpass fractional delay, pitch-normalized RT60 sustain, pick transient, and multi-mode spruce/mahogany body resonance.
 */
export function synthesizePluckedStringSamples({
  freq,
  durationSec = 1.8,
  sampleRate = 48000,
  instrument = 'guitar',
  seed = 1337,
}) {
  if (!Number.isFinite(freq) || freq <= 15 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return new Float32Array(0);
  }

  const profile = getInstrumentTimbre(instrument);
  const totalSamples = Math.max(256, Math.floor(durationSec * sampleRate));
  const out = new Float32Array(totalSamples);

  // Exact period in samples:
  // Total delay = N_int (ring buffer) + d (Thiran allpass in [0.5, 1.5)) + 1.0 (symmetric 3-tap LP)
  const rawPeriod = sampleRate / freq;
  const rem = Math.max(2.5, rawPeriod - 1.0);
  const delayInt = Math.max(2, Math.floor(rem - 0.5));
  const fracDelay = rem - delayInt; // strictly in [0.5, 1.5)
  const allpassCoeff = (1 - fracDelay) / (1 + fracDelay); // |c| <= 0.3333 -> unconditionally stable

  const excLen = delayInt;
  const bufLen = excLen + 8;
  const delayLine = new Float32Array(bufLen);

  // Deterministic PRNG for organic micro-texture
  let rng = (Math.abs(Math.round(freq * 100)) + seed) >>> 0 || 2463534242;
  const nextRand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return (rng / 0xffffffff) * 2 - 1;
  };

  // 1. Ideal plucked triangle displacement (natural 1/n^2 harmonic spectrum)
  const exc = new Float32Array(excLen);
  const pickIdx = Math.max(1, Math.min(excLen - 2, Math.round(excLen * profile.pickPos)));
  for (let i = 0; i < excLen; i++) {
    const tri =
      i <= pickIdx
        ? i / pickIdx
        : 1 - (i - pickIdx) / Math.max(1, excLen - 1 - pickIdx);
    exc[i] = tri;
  }

  // Round corners proportionally to period length so low strings sound warm, never raspy
  const roundWindow = Math.max(1, Math.min(24, Math.round(excLen * profile.pluckRoundFrac)));
  for (let pass = 0; pass < roundWindow; pass++) {
    const tmp = new Float32Array(excLen);
    for (let i = 0; i < excLen; i++) {
      const prev = exc[(i - 1 + excLen) % excLen];
      const curr = exc[i];
      const next = exc[(i + 1) % excLen];
      tmp[i] = 0.25 * prev + 0.5 * curr + 0.25 * next;
    }
    exc.set(tmp);
  }

  // 2. Band-limited noise burst for organic string excitation
  const noise = new Float32Array(excLen);
  for (let i = 0; i < excLen; i++) {
    noise[i] = nextRand();
  }
  const noisePasses = Math.max(1, Math.min(28, Math.round(1 / Math.max(0.03, profile.noiseCutoffRatio))));
  for (let pass = 0; pass < noisePasses; pass++) {
    const tmp = new Float32Array(excLen);
    for (let i = 0; i < excLen; i++) {
      const prev = noise[(i - 1 + excLen) % excLen];
      const curr = noise[i];
      const next = noise[(i + 1) % excLen];
      tmp[i] = 0.25 * prev + 0.5 * curr + 0.25 * next;
    }
    noise.set(tmp);
  }

  // Blend displacement + warm texture, center to zero mean, normalize safely below 0.85 peak
  let sum = 0;
  for (let i = 0; i < excLen; i++) {
    exc[i] = exc[i] * (1 - profile.noiseMix) + noise[i] * profile.noiseMix;
    sum += exc[i];
  }
  const mean = sum / excLen;
  let maxAbs = 0.0001;
  for (let i = 0; i < excLen; i++) {
    exc[i] -= mean;
    if (Math.abs(exc[i]) > maxAbs) maxAbs = Math.abs(exc[i]);
  }
  for (let i = 0; i < excLen; i++) {
    delayLine[i] = (exc[i] / maxAbs) * 0.85;
  }

  // Pitch-normalized per-cycle gain so low and treble strings sustain organically
  const gainPerSec = Math.pow(10, profile.rt60DbPerSec / 20);
  const loopGain = Math.min(0.9993, Math.pow(gainPerSec, 1 / freq));
  // Gentle extra damping at higher pitches for authentic internal string friction
  const b = Math.min(0.24, profile.loopDamping + Math.min(0.05, (freq / 1000) * 0.045));

  let writeIdx = excLen % bufLen;
  let prevApIn = 0;
  let prevApOut = 0;
  let apHist1 = 0;
  let apHist2 = 0;
  let dcPrevIn = 0;
  let dcPrevOut = 0;

  // Coupled wooden acoustic body resonators (Helmholtz soundhole air + top plate + upper bout)
  const isGuitar = instrument === 'guitar';
  const airC = isGuitar ? createBodyBandpassCoeffs(98, 5.2, sampleRate) : null;
  const topC = isGuitar ? createBodyBandpassCoeffs(198, 4.5, sampleRate) : null;
  const woodC = isGuitar ? createBodyBandpassCoeffs(412, 3.8, sampleRate) : null;
  let airX1 = 0;
  let airX2 = 0;
  let airY1 = 0;
  let airY2 = 0;
  let topX1 = 0;
  let topX2 = 0;
  let topY1 = 0;
  let topY2 = 0;
  let woodX1 = 0;
  let woodX2 = 0;
  let woodY1 = 0;
  let woodY2 = 0;

  // Brief plectrum brush transient on acoustic guitar attack (~10ms)
  const pickNoiseLen = isGuitar ? Math.min(totalSamples, Math.round(sampleRate * 0.011)) : 0;
  let pickLp = 0;

  // Short damped acoustic soundboard/body knock at attack
  const bodyTapLen = Math.min(totalSamples, Math.round(sampleRate * 0.048));
  const bodyOmega = (2 * Math.PI * profile.bodyTapHz) / sampleRate;
  const bodyDecayPerSample = Math.exp(-82 / sampleRate);
  let bodyAmp = profile.bodyTapMix;

  const fadeSamples = Math.min(totalSamples, Math.round(sampleRate * 0.065));

  for (let i = 0; i < totalSamples; i++) {
    const readIdx = (writeIdx - delayInt + bufLen) % bufLen;
    const apIn = delayLine[readIdx];

    // 1st-order Thiran Allpass fractional delay (flat 0dB magnitude at all frequencies)
    const apOut = allpassCoeff * apIn + prevApIn - allpassCoeff * prevApOut;
    prevApIn = apIn;
    prevApOut = apOut;

    // Zero-phase-distortion symmetric 3-tap damping filter (exact 1.0 sample delay)
    const lp = b * apOut + (1 - 2 * b) * apHist1 + b * apHist2;
    apHist2 = apHist1;
    apHist1 = apOut;

    const feedback = lp * loopGain;
    delayLine[writeIdx] = feedback;
    writeIdx = (writeIdx + 1) % bufLen;

    let sample = feedback;

    // Drive coupled spruce/mahogany soundboard modes with string energy
    if (isGuitar && airC && topC && woodC) {
      const airY = airC.b0 * feedback + airC.b2 * airX2 - airC.a1 * airY1 - airC.a2 * airY2;
      airX2 = airX1;
      airX1 = feedback;
      airY2 = airY1;
      airY1 = airY;

      const topY = topC.b0 * feedback + topC.b2 * topX2 - topC.a1 * topY1 - topC.a2 * topY2;
      topX2 = topX1;
      topX1 = feedback;
      topY2 = topY1;
      topY1 = topY;

      const woodY = woodC.b0 * feedback + woodC.b2 * woodX2 - woodC.a1 * woodY1 - woodC.a2 * woodY2;
      woodX2 = woodX1;
      woodX1 = feedback;
      woodY2 = woodY1;
      woodY1 = woodY;

      sample = feedback * 0.72 + airY * 0.32 + topY * 0.28 + woodY * 0.16;

      if (i < pickNoiseLen) {
        const tFrac = 1 - i / pickNoiseLen;
        pickLp = 0.28 * nextRand() + 0.72 * pickLp;
        sample += pickLp * tFrac * tFrac * 0.085;
      }
    }

    // Add soft woody body thump during the first ~48ms
    if (i < bodyTapLen) {
      sample += bodyAmp * Math.sin(bodyOmega * i);
      bodyAmp *= bodyDecayPerSample;
    }

    // Gentle saddle warmth saturation for natural chord compression
    if (isGuitar) {
      sample = Math.tanh(sample * 1.12) / 1.12;
    }

    // Clean 1st-order DC blocker (R = 0.997)
    const dcClean = sample - dcPrevIn + 0.997 * dcPrevOut;
    dcPrevIn = sample;
    dcPrevOut = dcClean;

    // Smooth tail fade-out over last 65ms
    if (i > totalSamples - fadeSamples) {
      const remFade = (totalSamples - i) / fadeSamples;
      out[i] = dcClean * remFade;
    } else {
      out[i] = dcClean;
    }
  }

  return out;
}

export function setMobileAudioSession(type = 'playback') {
  if (typeof navigator !== 'undefined' && navigator.audioSession) {
    try {
      if (navigator.audioSession.type !== type) {
        navigator.audioSession.type = type;
      }
    } catch {
      // Ignore unsupported audioSession types on older browsers
    }
  }
}

export function playSilentUnlockBuffer(ctx) {
  if (!ctx || ctx.state === 'closed') return;
  try {
    const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
    const src = ctx.createBufferSource();
    src.buffer = silentBuffer;
    src.connect(ctx.destination);
    src.start(0);
    src.stop(0.001);
  } catch {
    // Ignore unlock failures on restricted contexts
  }
}

export function createPluckedAudioBuffer(ctx, freq, durationSec, instrument = 'guitar', seed = 1337) {
  const samples = synthesizePluckedStringSamples({
    freq,
    durationSec,
    sampleRate: ctx.sampleRate,
    instrument,
    seed,
  });
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  if (typeof buffer.getChannelData === 'function') {
    buffer.getChannelData(0).set(samples);
  } else if (typeof buffer.copyToChannel === 'function') {
    buffer.copyToChannel(samples, 0);
  }
  return buffer;
}

const roomIrCache = new WeakMap();

export function getInstrumentRoomIR(ctx, instrument = 'guitar') {
  if (!ctx || typeof ctx.createBuffer !== 'function') return null;
  let perCtx = roomIrCache.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    roomIrCache.set(ctx, perCtx);
  }
  if (perCtx.has(instrument)) {
    return perCtx.get(instrument);
  }

  const profile = getInstrumentTimbre(instrument);
  const sampleRate = ctx.sampleRate || 48000;
  const length = Math.max(512, Math.floor(profile.roomDecaySec * sampleRate));
  const irBuffer = ctx.createBuffer(2, length, sampleRate);

  let rng = instrument === 'bass' ? 918273 : instrument === 'ukulele' ? 445566 : 112233;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return (rng / 0xffffffff) * 2 - 1;
  };

  for (let ch = 0; ch < 2; ch++) {
    const data = irBuffer.getChannelData(ch);
    let lp = 0;
    const lpAlpha = instrument === 'bass' ? 0.14 : instrument === 'ukulele' ? 0.24 : 0.28;
    const earlyGap = Math.round(sampleRate * (0.006 + ch * 0.003));
    for (let i = earlyGap; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, 2.4);
      const raw = rand() * env;
      lp = lpAlpha * raw + (1 - lpAlpha) * lp;
      data[i] = lp * 0.45;
    }
  }

  perCtx.set(instrument, irBuffer);
  return irBuffer;
}

export function createInstrumentBodyChain(ctx, instrument = 'guitar', startTime = null) {
  const profile = getInstrumentTimbre(instrument);

  const lowBody = ctx.createBiquadFilter();
  lowBody.type = 'peaking';
  lowBody.frequency.value = profile.bodyLowHz;
  lowBody.Q.value = 1.05;
  lowBody.gain.value = profile.bodyLowGainDb;

  const midWarmth = ctx.createBiquadFilter();
  midWarmth.type = 'peaking';
  midWarmth.frequency.value = profile.bodyMidHz;
  midWarmth.Q.value = 1.1;
  midWarmth.gain.value = profile.bodyMidGainDb;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = profile.presenceHz;
  presence.Q.value = 0.85;
  presence.gain.value = profile.presenceGainDb;

  const airCut = ctx.createBiquadFilter();
  airCut.type = 'lowpass';
  airCut.Q.value = 0.7;
  if (
    startTime !== null &&
    typeof airCut.frequency.setValueAtTime === 'function' &&
    typeof airCut.frequency.exponentialRampToValueAtTime === 'function'
  ) {
    airCut.frequency.setValueAtTime(profile.attackCutoffHz, startTime);
    airCut.frequency.exponentialRampToValueAtTime(
      Math.max(120, profile.sustainCutoffHz),
      startTime + profile.brightnessDecaySec
    );
  } else {
    airCut.frequency.value = profile.sustainCutoffHz;
  }

  lowBody.connect(midWarmth);
  midWarmth.connect(presence);
  presence.connect(airCut);

  return { input: lowBody, output: airCut };
}

export function createStudioSampleChain(ctx, instrument = 'guitar', { velocity = 1.0 } = {}) {
  const highPass = ctx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = instrument === 'bass' ? 32 : instrument === 'ukulele' ? 145 : 68;
  highPass.Q.value = 0.7;

  const toneWarmth = ctx.createBiquadFilter();
  toneWarmth.type = 'peaking';
  if (instrument === 'bass') {
    toneWarmth.frequency.value = 155;
    toneWarmth.gain.value = 1.8;
    toneWarmth.Q.value = 0.9;
  } else if (instrument === 'ukulele') {
    toneWarmth.frequency.value = 390;
    toneWarmth.gain.value = 1.6;
    toneWarmth.Q.value = 0.95;
  } else {
    toneWarmth.frequency.value = 185;
    toneWarmth.gain.value = 1.1;
    toneWarmth.Q.value = 0.9;
  }

  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.Q.value = 0.65;
  const clampedVel = Math.max(0.5, Math.min(1.25, velocity));
  if (instrument === 'bass') {
    airFilter.frequency.value = 2600 + clampedVel * 900;
  } else if (instrument === 'ukulele') {
    airFilter.frequency.value = 4600 + clampedVel * 1800;
  } else {
    airFilter.frequency.value = 5400 + clampedVel * 3200;
  }

  highPass.connect(toneWarmth);
  toneWarmth.connect(airFilter);

  return { input: highPass, output: airFilter };
}

export class LearnAudioEngine {
  constructor() {
    this.ctx = null;
    this.compressor = null;
    this.masterGain = null;
    this.dryBus = null;
    this.roomWetGains = new Map();
    this.activeNodes = new Set();
    this.timers = new Set();
    this.bufferCache = new Map();
    this.sampleBuffers = new Map();
    this.sampleInFlight = new Map();
    this._warmedInstruments = new Set();
    this._preferredInstrument = 'guitar';
    this.playGen = 0;
    this._unlocked = false;
    this._gestureListenersBound = false;

    this._metroGen = 0;
    this._metroRunning = false;
    this._metroBpm = 90;
    this._metroBeats = 4;
    this._metroVolume = 0.7;
    this._metroBeatIndex = 0;
    this._metroNextNoteTime = 0;
    this._metroIntervalId = null;
    this._metroUiTimers = new Set();
    this._metroOnBeat = null;

    this._seqGen = 0;
    this._seqRunning = false;
    this._seqSteps = [];
    this._seqBpm = 90;
    this._seqRefFrequency = 440;
    this._seqPlayMode = 'strum';
    this._seqRhythmId = 'single';
    this._seqWithClick = true;
    this._seqLoop = true;
    this._seqStepIdx = 0;
    this._seqBeatInStep = 0;
    this._seqNextBeatTime = 0;
    this._seqIntervalId = null;
    this._seqUiTimers = new Set();
    this._seqOnStepBeat = null;
    this._seqOnComplete = null;
    this._seqEndScheduled = false;

    this._rhythmDemoGen = 0;
    this._rhythmDemoRunning = false;
    this._rhythmDemoSlots = [];
    this._rhythmDemoCycleBeats = 4;
    this._rhythmDemoBeatIdx = 0;
    this._rhythmDemoBpm = 96;
    this._rhythmDemoMidiNotes = [];
    this._rhythmDemoRefFrequency = 440;
    this._rhythmDemoInstrument = 'guitar';
    this._rhythmDemoPlayMode = 'strum';
    this._rhythmDemoWithClick = true;
    this._rhythmDemoNextBeatTime = 0;
    this._rhythmDemoIntervalId = null;
    this._rhythmDemoUiTimers = new Set();
    this._rhythmDemoOnSlot = null;

    this._bindGlobalUnlock();
  }

  _bindGlobalUnlock() {
    if (this._gestureListenersBound || typeof window === 'undefined') return;
    this._gestureListenersBound = true;

    const handleFirstGesture = () => {
      const { ctx, resumePromise } = this._unlockContextSync();
      if (ctx) {
        this._warmInstrumentAsync(ctx, this._preferredInstrument);
      }
      if (ctx && ctx.state === 'running') {
        cleanup();
      } else if (resumePromise) {
        resumePromise
          .then(() => {
            if (this.ctx && this.ctx.state === 'running') {
              this._warmInstrumentAsync(this.ctx, this._preferredInstrument);
              cleanup();
            }
          })
          .catch(() => {});
      }
    };

    const cleanup = () => {
      window.removeEventListener('touchstart', handleFirstGesture, true);
      window.removeEventListener('pointerdown', handleFirstGesture, true);
      window.removeEventListener('keydown', handleFirstGesture, true);
    };

    window.addEventListener('touchstart', handleFirstGesture, { capture: true, passive: true });
    window.addEventListener('pointerdown', handleFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleFirstGesture, { capture: true, passive: true });
  }

  _unlockContextSync() {
    if (typeof window === 'undefined') return { ctx: null, resumePromise: null };
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return { ctx: null, resumePromise: null };

    // Bypass iOS Silent/Ring switch and earpiece routing for Learn & Strum playback
    setMobileAudioSession('playback');

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
      this.bufferCache.clear();
      this.sampleBuffers.clear();
      this.sampleInFlight.clear();
      this._warmedInstruments.clear();
      this.roomWetGains.clear();
      this._unlocked = false;

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 14;
      comp.ratio.value = 3.2;
      comp.attack.value = 0.005;
      comp.release.value = 0.18;

      const master = this.ctx.createGain();
      master.gain.value = 1.25;

      comp.connect(master);
      master.connect(this.ctx.destination);
      this.compressor = comp;
      this.masterGain = master;

      const dry = this.ctx.createGain();
      dry.gain.value = 0.92;
      dry.connect(comp);
      this.dryBus = dry;

      // Single shared acoustic studio room convolver per context (zero per-note allocation)
      if (typeof this.ctx.createConvolver === 'function') {
        const ir = getInstrumentRoomIR(this.ctx, 'guitar');
        if (ir) {
          const convolver = this.ctx.createConvolver();
          convolver.buffer = ir;
          const wet = this.ctx.createGain();
          wet.gain.value = 0.18;
          convolver.connect(wet);
          wet.connect(comp);
          this.roomWetGains.set('default', { convolver, wet });
        }
      }
    }

    const ctx = this.ctx;
    if (!this._unlocked || ctx.state !== 'running') {
      playSilentUnlockBuffer(ctx);
      this._unlocked = true;
    }

    let resumePromise = null;
    if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
      resumePromise = ctx.resume().catch(() => {});
    }

    return { ctx, resumePromise };
  }

  _canDecodeSamples(ctx) {
    return Boolean(
      ctx &&
        ctx.state !== 'closed' &&
        typeof fetch === 'function' &&
        typeof ctx.decodeAudioData === 'function'
    );
  }

  _warmInstrumentAsync(ctx, instrument = 'guitar') {
    if (!this._canDecodeSamples(ctx)) return;
    this._preferredInstrument = instrument;
    if (this._warmedInstruments.has(instrument)) return;
    this._warmedInstruments.add(instrument);

    const entries = getCoreWarmupSamples(instrument);
    const batchSize = 4;

    const runQueue = async () => {
      for (let i = 0; i < entries.length; i += batchSize) {
        if (!ctx || ctx.state === 'closed' || ctx !== this.ctx) return;
        const batch = entries.slice(i, i + batchSize);
        await Promise.all(
          batch.map((entry) => loadSampleBuffer(ctx, entry, this.sampleBuffers, this.sampleInFlight))
        );
      }
    };

    runQueue().catch(() => {});
  }

  warmInstrument(instrument = 'guitar') {
    this._preferredInstrument = instrument;
    if (this.ctx && this.ctx.state !== 'closed') {
      this._warmInstrumentAsync(this.ctx, instrument);
    }
  }

  _ensureSamplesForFreqs(ctx, instrument, freqs, timeoutMs = 190) {
    if (!this._canDecodeSamples(ctx) || !Array.isArray(freqs) || freqs.length === 0) {
      return null;
    }

    const needed = [];
    const seenKeys = new Set();
    for (const freq of freqs) {
      if (!Number.isFinite(freq) || freq <= 0) continue;
      const match = findNearestSample(instrument, freq);
      if (match && !this.sampleBuffers.has(match.key) && !seenKeys.has(match.key)) {
        seenKeys.add(match.key);
        needed.push(match);
      }
    }

    if (needed.length === 0) {
      return null;
    }

    const loadAll = Promise.all(
      needed.map((entry) => loadSampleBuffer(ctx, entry, this.sampleBuffers, this.sampleInFlight))
    );

    if (timeoutMs <= 0) {
      return loadAll;
    }

    return Promise.race([
      loadAll,
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
  }

  _withReadyContext(gen, callback, { instrument = 'guitar', preloadFreqs = null, preloadTimeoutMs = 190 } = {}) {
    const { ctx, resumePromise } = this._unlockContextSync();
    if (!ctx) return;

    this._warmInstrumentAsync(ctx, instrument);

    const runAfterLoad = (activeCtx) => {
      if (gen !== this.playGen || !activeCtx || activeCtx.state === 'closed') return;
      const pending = preloadFreqs
        ? this._ensureSamplesForFreqs(activeCtx, instrument, preloadFreqs, preloadTimeoutMs)
        : null;

      if (pending) {
        pending
          .then(() => {
            if (gen !== this.playGen || !this.ctx || this.ctx.state !== 'running') return;
            callback(this.ctx);
          })
          .catch(() => {
            if (gen !== this.playGen || !this.ctx || this.ctx.state !== 'running') return;
            callback(this.ctx);
          });
      } else {
        callback(activeCtx);
      }
    };

    if (ctx.state === 'running' || !resumePromise) {
      runAfterLoad(ctx);
      return;
    }

    resumePromise.then(() => {
      if (gen !== this.playGen || !this.ctx || this.ctx.state === 'closed') return;
      if (this.ctx.state !== 'running') return;
      runAfterLoad(this.ctx);
    });
  }

  _getCachedBuffer(ctx, freq, durationSec, instrument) {
    const key = `${instrument}:${freq.toFixed(2)}:${durationSec.toFixed(2)}:${ctx.sampleRate}`;
    let buf = this.bufferCache.get(key);
    if (!buf) {
      buf = createPluckedAudioBuffer(ctx, freq, durationSec, instrument);
      if (this.bufferCache.size > 96) {
        const firstKey = this.bufferCache.keys().next().value;
        this.bufferCache.delete(firstKey);
      }
      this.bufferCache.set(key, buf);
    }
    return buf;
  }

  _connectToMasterBuses(ctx, outputNode, roomWetMix, startTime) {
    const roomBus = this.roomWetGains.get('default');
    if (this.dryBus && roomBus) {
      if (typeof roomBus.wet.gain.setTargetAtTime === 'function') {
        roomBus.wet.gain.setTargetAtTime(roomWetMix, startTime, 0.02);
      } else {
        roomBus.wet.gain.value = roomWetMix;
      }
      outputNode.connect(this.dryBus);
      outputNode.connect(roomBus.convolver);
    } else {
      outputNode.connect(this.compressor || ctx.destination);
    }
  }

  _scheduleSampledFreq(
    ctx,
    sampleBuffer,
    playbackRate,
    {
      instrument = 'guitar',
      startTime,
      durationSec,
      volume = 0.5,
      pan = 0,
      velocity = 1.0,
    }
  ) {
    const profile = getInstrumentTimbre(instrument);
    const source = ctx.createBufferSource();
    source.buffer = sampleBuffer;
    if (source.playbackRate && typeof source.playbackRate.setValueAtTime === 'function') {
      source.playbackRate.setValueAtTime(playbackRate, startTime);
    } else if (source.playbackRate) {
      source.playbackRate.value = playbackRate;
    }

    const chain = createStudioSampleChain(ctx, instrument, { velocity });
    const gain = ctx.createGain();
    const peakGain = Math.max(0.02, volume);

    const maxSamplePlaySec = Math.max(0.35, sampleBuffer.duration / Math.max(0.25, playbackRate));
    const effectiveDur = Math.min(durationSec, maxSamplePlaySec);
    const releaseSec = Math.min(0.18, Math.max(0.06, effectiveDur * 0.16));
    const fadeStart = Math.max(startTime + 0.02, startTime + effectiveDur - releaseSec);

    if (typeof gain.gain.setValueAtTime === 'function') {
      gain.gain.setValueAtTime(0.001, startTime);
      if (typeof gain.gain.linearRampToValueAtTime === 'function') {
        gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.0025);
        gain.gain.setValueAtTime(peakGain, fadeStart);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + effectiveDur);
      } else {
        gain.gain.setValueAtTime(peakGain, startTime);
      }
    } else {
      gain.gain.value = peakGain;
    }

    source.connect(chain.input);
    chain.output.connect(gain);

    let tailNode = gain;
    let panner = null;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.35, Math.min(0.35, pan));
      gain.connect(panner);
      tailNode = panner;
    }

    this._connectToMasterBuses(ctx, tailNode, profile.sampleRoomWetMix ?? profile.roomWetMix, startTime);

    const entry = { source, gain };
    this.activeNodes.add(entry);
    source.onended = () => {
      this.activeNodes.delete(entry);
      try {
        source.disconnect();
        chain.output.disconnect();
        gain.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // ignore
      }
    };

    source.start(startTime);
    source.stop(startTime + effectiveDur + 0.03);
  }

  _schedulePluckedFreq(
    ctx,
    freq,
    {
      instrument = 'guitar',
      delaySec = 0,
      startTime: explicitStartTime = null,
      durationSec = null,
      volume = 0.55,
      pan = 0,
      velocity = 1.0,
    } = {}
  ) {
    if (!ctx || ctx.state === 'closed' || !Number.isFinite(freq) || freq <= 0) return;

    const profile = getInstrumentTimbre(instrument);
    const dur = durationSec ?? profile.defaultNoteDuration;
    const startTime =
      Number.isFinite(explicitStartTime) && explicitStartTime >= ctx.currentTime
        ? explicitStartTime
        : ctx.currentTime + Math.max(0, delaySec);

    // Prefer studio-recorded acoustic/nylon/bass multisamples when decoded
    if (this._canDecodeSamples(ctx)) {
      const sampleMatch = findNearestSample(instrument, freq);
      if (sampleMatch) {
        const cachedSample = this.sampleBuffers.get(sampleMatch.key);
        if (cachedSample) {
          this._scheduleSampledFreq(ctx, cachedSample, sampleMatch.playbackRate, {
            instrument,
            startTime,
            durationSec: dur,
            volume,
            pan,
            velocity,
          });
          return;
        }
        // Trigger background decode if this chromatic note isn't cached yet
        loadSampleBuffer(ctx, sampleMatch, this.sampleBuffers, this.sampleInFlight).catch(() => {});
      }
    }

    const buffer = this._getCachedBuffer(ctx, freq, dur, instrument);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const body = createInstrumentBodyChain(ctx, instrument, startTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);

    source.connect(body.input);
    body.output.connect(gain);
    this._connectToMasterBuses(ctx, gain, profile.roomWetMix, startTime);

    const entry = { source, gain };
    this.activeNodes.add(entry);
    source.onended = () => {
      this.activeNodes.delete(entry);
      try {
        source.disconnect();
        body.output.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };

    source.start(startTime);
    source.stop(startTime + dur + 0.02);
  }

  stopAll() {
    this.playGen += 1;
    this.stopCustomProgression();
    this.stopRhythmDemo();
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();

    this.activeNodes.forEach(({ source, gain }) => {
      try {
        if (this.ctx) {
          const now = this.ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setTargetAtTime(0.0001, now, 0.015);
        }
        const stopAt = this.ctx ? this.ctx.currentTime + 0.05 : 0;
        source.stop(stopAt);
      } catch {
        // ignore already-stopped nodes
      }
    });
    this.activeNodes.clear();
  }

  playPluckedFreq(
    freq,
    { instrument = 'guitar', delaySec = 0, durationSec = null, volume = 0.55 } = {}
  ) {
    if (!Number.isFinite(freq) || freq <= 0) return;
    const gen = this.playGen;
    this._withReadyContext(
      gen,
      (ctx) => {
        this._schedulePluckedFreq(ctx, freq, { instrument, delaySec, durationSec, volume });
      },
      { instrument, preloadFreqs: [freq], preloadTimeoutMs: 160 }
    );
  }

  playPluckedNote(
    midi,
    refFrequency = 440,
    delaySec = 0,
    durationSec = null,
    volume = 0.55,
    instrument = 'guitar'
  ) {
    if (!Number.isFinite(midi)) return;
    const freq = midiToFrequency(midi, refFrequency);
    if (!Number.isFinite(freq) || freq <= 0) return;
    this.playPluckedFreq(freq, { instrument, delaySec, durationSec, volume });
  }

  _buildStrumSchedule(
    midiNotes,
    refFrequency,
    instrument,
    { direction = 'down', velocityScale = 1.0 } = {}
  ) {
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return [];
    const profile = getInstrumentTimbre(instrument);

    let orderedNotes = midiNotes;
    let stepScale = 1.0;

    if (direction === 'bass') {
      const bassCount = midiNotes.length >= 5 ? 2 : 1;
      orderedNotes = midiNotes.slice(0, bassCount);
      stepScale = 0.65;
    } else if (direction === 'up' && midiNotes.length > 1) {
      // Natural acoustic upstrokes brush the upper 3-5 strings from treble -> mid
      const takeCount = midiNotes.length >= 5 ? Math.min(midiNotes.length, 5) : midiNotes.length;
      orderedNotes = midiNotes.slice(midiNotes.length - takeCount).reverse();
      stepScale = 0.78;
    }

    const total = orderedNotes.length;
    const baseVol = Math.min(0.46, 1.38 / Math.max(1, midiNotes.length)) * velocityScale;
    const events = [];

    orderedNotes.forEach((midi, idx) => {
      if (!Number.isFinite(midi)) return;
      const freq = midiToFrequency(midi, refFrequency);
      if (!Number.isFinite(freq) || freq <= 0) return;

      const curveOffset = idx * idx * 0.00042;
      const microJitter = (idx % 2 === 0 ? 1 : -1) * 0.0012;
      const delaySec = Math.max(
        0,
        idx * profile.strumStepSec * stepScale - curveOffset + microJitter
      );

      let accent =
        idx === 0 ? 1.06 : idx === total - 1 ? 0.99 : 0.86 + (idx / Math.max(1, total)) * 0.08;
      if (direction === 'up') {
        accent = idx === 0 ? 1.02 : 0.84 + (1 - idx / Math.max(1, total)) * 0.1;
      } else if (direction === 'bass') {
        accent = idx === 0 ? 1.12 : 0.84;
      }

      const rawPos = total > 1 ? idx / (total - 1) - 0.5 : 0;
      const pan = (direction === 'up' ? -rawPos : rawPos) * 0.24;

      events.push({
        freq,
        delaySec,
        volume: baseVol * accent,
        pan,
        velocity: Math.max(0.55, Math.min(1.22, accent * velocityScale)),
      });
    });

    return events;
  }

  _getChuckBuffer(ctx, instrument = 'guitar') {
    const key = `chuck:${instrument}:${ctx.sampleRate}`;
    let buf = this.bufferCache.get(key);
    if (buf) return buf;

    const sampleRate = ctx.sampleRate || 48000;
    const durSec = 0.075;
    const len = Math.max(256, Math.floor(durSec * sampleRate));
    buf = ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);

    let rng = instrument === 'bass' ? 424242 : instrument === 'ukulele' ? 773311 : 192837;
    const nextRand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return (rng / 0xffffffff) * 2 - 1;
    };

    const bodyHz = instrument === 'bass' ? 92 : instrument === 'ukulele' ? 235 : 138;
    const omega = (2 * Math.PI * bodyHz) / sampleRate;
    let bpPrev = 0;
    let lpPrev = 0;

    for (let i = 0; i < len; i += 1) {
      const t = i / sampleRate;
      // Fast string-scratch burst + dampened palm body knock
      const scratchEnv = Math.exp(-t * 95);
      const bodyEnv = Math.exp(-t * 62);
      const raw = nextRand();
      lpPrev = 0.42 * raw + 0.58 * lpPrev;
      const band = lpPrev - bpPrev;
      bpPrev = lpPrev * 0.65;
      const knock = Math.sin(omega * i) * bodyEnv * 0.36;
      const fadeIn = Math.min(1, i / Math.max(1, Math.round(sampleRate * 0.002)));
      data[i] = Math.tanh((band * scratchEnv * 1.45 + knock) * fadeIn) * 0.72;
    }

    this.bufferCache.set(key, buf);
    return buf;
  }

  _scheduleChuck(ctx, { instrument = 'guitar', startTime, volume = 0.34 } = {}) {
    if (!ctx || ctx.state === 'closed') return;
    const buf = this._getChuckBuffer(ctx, instrument);
    const source = ctx.createBufferSource();
    source.buffer = buf;

    const gain = ctx.createGain();
    const safeStart = Number.isFinite(startTime) ? Math.max(ctx.currentTime, startTime) : ctx.currentTime;
    gain.gain.setValueAtTime(Math.max(0.05, Math.min(0.6, volume)), safeStart);

    source.connect(gain);
    this._connectToMasterBuses(ctx, gain, 0.08, safeStart);

    const entry = { source, gain };
    this.activeNodes.add(entry);
    source.onended = () => {
      this.activeNodes.delete(entry);
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };

    source.start(safeStart);
    source.stop(safeStart + buf.duration + 0.01);
  }

  _scheduleRhythmStroke(
    ctx,
    midiNotes,
    refFrequency,
    instrument,
    { startTime, beatDurSec, stroke, playMode = 'strum', maxRingSec = null }
  ) {
    if (!ctx || ctx.state === 'closed' || !stroke || stroke.action === 'rest') return;
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return;

    const profile = getInstrumentTimbre(instrument);
    const safeStart = Math.max(ctx.currentTime, startTime);

    if (stroke.action === 'chuck') {
      this._scheduleChuck(ctx, {
        instrument,
        startTime: safeStart,
        volume: 0.34 * (stroke.velocity || 0.88),
      });
      return;
    }

    const rawRingSec = Math.max(0.14, (stroke.durationBeats || 1) * beatDurSec);
    const clampedRingSec =
      maxRingSec !== null
        ? Math.min(maxRingSec, rawRingSec + 0.04)
        : Math.min(profile.defaultChordDuration + 0.2, rawRingSec + 0.06);

    if (playMode === 'arpeggio' && midiNotes.length > 1 && stroke.action !== 'bass') {
      const idx =
        stroke.action === 'up'
          ? Math.max(0, midiNotes.length - 1 - ((stroke.slotIndex || 0) % Math.min(3, midiNotes.length)))
          : (stroke.slotIndex || 0) % midiNotes.length;
      const targetMidi = stroke.action === 'accent-down' ? midiNotes[0] : midiNotes[idx];
      const freq = midiToFrequency(targetMidi, refFrequency);
      if (Number.isFinite(freq) && freq > 0) {
        this._schedulePluckedFreq(ctx, freq, {
          instrument,
          startTime: safeStart,
          durationSec: Math.max(0.45, clampedRingSec),
          volume: 0.44 * (stroke.velocity || 0.9),
          velocity: stroke.velocity || 0.9,
        });
      }
      return;
    }

    const direction =
      stroke.action === 'up'
        ? 'up'
        : stroke.action === 'bass'
          ? 'bass'
          : 'down';

    const events = this._buildStrumSchedule(midiNotes, refFrequency, instrument, {
      direction,
      velocityScale: stroke.velocity || 0.94,
    });

    events.forEach((ev) => {
      this._schedulePluckedFreq(ctx, ev.freq, {
        instrument,
        startTime: Math.max(ctx.currentTime, safeStart + ev.delaySec),
        durationSec: clampedRingSec,
        volume: ev.volume,
        pan: ev.pan,
        velocity: ev.velocity,
      });
    });
  }

  playChordStrum(midiNotes, refFrequency = 440, instrument = 'guitar', options = {}) {
    this.stopAll();
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return;

    const gen = this.playGen;
    const profile = getInstrumentTimbre(instrument);
    const events = this._buildStrumSchedule(midiNotes, refFrequency, instrument, options);
    if (events.length === 0) return;

    this._withReadyContext(
      gen,
      (ctx) => {
        events.forEach((ev) => {
          this._schedulePluckedFreq(ctx, ev.freq, {
            instrument,
            delaySec: ev.delaySec,
            durationSec: profile.defaultChordDuration,
            volume: ev.volume,
            pan: ev.pan,
            velocity: ev.velocity,
          });
        });
      },
      {
        instrument,
        preloadFreqs: events.map((e) => e.freq),
        preloadTimeoutMs: 210,
      }
    );
  }

  playChord(
    midiNotes,
    refFrequency = 440,
    instrument = 'guitar',
    playMode = 'strum',
    { stepMs = 190 } = {}
  ) {
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return;
    if (playMode === 'arpeggio' && midiNotes.length > 1) {
      this.playSequence(midiNotes, refFrequency, stepMs, null, null, instrument);
      return;
    }
    this.playChordStrum(midiNotes, refFrequency, instrument);
  }

  playSequence(
    midiNotes,
    refFrequency = 440,
    stepMs = 280,
    onStep = null,
    onComplete = null,
    instrument = 'guitar'
  ) {
    this.stopAll();
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return;

    const gen = this.playGen;
    const profile = getInstrumentTimbre(instrument);
    // Let plucked notes ring out cleanly across arpeggio notes just like real fingerpicking
    const noteDurationSec = Math.max(1.45, profile.defaultChordDuration * 0.78);
    const freqs = midiNotes
      .filter((m) => Number.isFinite(m))
      .map((m) => midiToFrequency(m, refFrequency))
      .filter((f) => Number.isFinite(f) && f > 0);

    this._withReadyContext(
      gen,
      (ctx) => {
        const total = midiNotes.length;
        midiNotes.forEach((midi, idx) => {
          const delayMs = idx * stepMs;
          if (Number.isFinite(midi)) {
            const freq = midiToFrequency(midi, refFrequency);
            if (Number.isFinite(freq) && freq > 0) {
              const accent = idx === 0 ? 1.04 : idx === total - 1 ? 0.98 : 0.89;
              const pan = total > 1 ? ((idx / (total - 1)) - 0.5) * 0.22 : 0;
              this._schedulePluckedFreq(ctx, freq, {
                instrument,
                delaySec: delayMs / 1000,
                durationSec: noteDurationSec,
                volume: 0.5 * accent,
                pan,
                velocity: accent,
              });
            }
          }
          if (onStep) {
            const tId = setTimeout(() => {
              this.timers.delete(tId);
              if (gen === this.playGen) onStep(idx, midi);
            }, delayMs);
            this.timers.add(tId);
          }
        });

        if (onComplete) {
          const endId = setTimeout(() => {
            this.timers.delete(endId);
            if (gen === this.playGen) onComplete();
          }, midiNotes.length * stepMs + 150);
          this.timers.add(endId);
        }
      },
      { instrument, preloadFreqs: freqs, preloadTimeoutMs: 210 }
    );
  }

  playProgression(
    chords,
    refFrequency = 440,
    stepMs = 900,
    onStep = null,
    onComplete = null,
    instrument = 'guitar',
    playMode = 'strum'
  ) {
    this.stopAll();
    if (!Array.isArray(chords) || chords.length === 0) return;

    const gen = this.playGen;
    const profile = getInstrumentTimbre(instrument);
    const allFreqs = [];
    chords.forEach((chord) => {
      const notes = chord?.voicings?.[0]?.midiNotes || [];
      notes.forEach((midi) => {
        if (Number.isFinite(midi)) {
          const f = midiToFrequency(midi, refFrequency);
          if (Number.isFinite(f) && f > 0) allFreqs.push(f);
        }
      });
    });

    this._withReadyContext(
      gen,
      (ctx) => {
        chords.forEach((chord, cIdx) => {
          const midiNotes = chord?.voicings?.[0]?.midiNotes || [];
          const baseDelayMs = cIdx * stepMs;
          const isArp = playMode === 'arpeggio' && midiNotes.length > 1;
          const stepOffsetMs = isArp
            ? Math.min(200, Math.max(115, Math.floor((stepMs * 0.7) / midiNotes.length)))
            : Math.round(profile.strumStepSec * 1000);
          const chordRingSec = Math.max(
            1.35,
            Math.min(profile.defaultChordDuration, (stepMs / 1000) * 1.12)
          );

          if (isArp) {
            const total = midiNotes.length;
            const perNoteVol = Math.min(0.47, 1.34 / Math.max(1, total));
            midiNotes.forEach((midi, nIdx) => {
              if (!Number.isFinite(midi)) return;
              const freq = midiToFrequency(midi, refFrequency);
              if (!Number.isFinite(freq) || freq <= 0) return;
              const accent = nIdx === 0 ? 1.05 : nIdx === total - 1 ? 0.98 : 0.9;
              const pan = total > 1 ? ((nIdx / (total - 1)) - 0.5) * 0.22 : 0;
              const delaySec = (baseDelayMs + nIdx * stepOffsetMs) / 1000;
              this._schedulePluckedFreq(ctx, freq, {
                instrument,
                delaySec,
                durationSec: Math.max(1.2, chordRingSec - (nIdx * stepOffsetMs) / 1000 + 0.25),
                volume: perNoteVol * accent,
                pan,
                velocity: accent,
              });
            });
          } else {
            const strumEvents = this._buildStrumSchedule(midiNotes, refFrequency, instrument);
            strumEvents.forEach((ev) => {
              this._schedulePluckedFreq(ctx, ev.freq, {
                instrument,
                delaySec: baseDelayMs / 1000 + ev.delaySec,
                durationSec: chordRingSec,
                volume: ev.volume,
                pan: ev.pan,
                velocity: ev.velocity,
              });
            });
          }

          if (onStep) {
            const tId = setTimeout(() => {
              this.timers.delete(tId);
              if (gen === this.playGen) onStep(cIdx);
            }, baseDelayMs);
            this.timers.add(tId);
          }
        });

        if (onComplete) {
          const endId = setTimeout(() => {
            this.timers.delete(endId);
            if (gen === this.playGen) onComplete();
          }, chords.length * stepMs + 180);
          this.timers.add(endId);
        }
      },
      { instrument, preloadFreqs: allFreqs, preloadTimeoutMs: 220 }
    );
  }

  _scheduleClickAt(ctx, time, isAccent) {
    if (!ctx || ctx.state === 'closed') return;

    const osc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    const vol = Math.max(0.05, Math.min(1, this._metroVolume)) * (isAccent ? 0.48 : 0.3);

    // Crisp woody acoustic stick / woodblock click
    osc.type = 'triangle';
    const startFreq = isAccent ? 1480 : 1040;
    const endFreq = isAccent ? 920 : 660;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.026);

    clickGain.gain.setValueAtTime(0.0001, time);
    clickGain.gain.linearRampToValueAtTime(vol, time + 0.0018);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.048);

    osc.connect(clickGain);
    clickGain.connect(this.compressor || ctx.destination);

    // Subtle harmonic overtone transient for authentic woodblock snap
    const tapOsc = ctx.createOscillator();
    const tapGain = ctx.createGain();
    tapOsc.type = 'sine';
    tapOsc.frequency.setValueAtTime(isAccent ? 2850 : 2100, time);
    tapGain.gain.setValueAtTime(0.0001, time);
    tapGain.gain.linearRampToValueAtTime(vol * 0.28, time + 0.001);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.014);
    tapOsc.connect(tapGain);
    tapGain.connect(this.compressor || ctx.destination);

    osc.onended = () => {
      try {
        osc.disconnect();
        clickGain.disconnect();
        tapOsc.disconnect();
        tapGain.disconnect();
      } catch {
        // ignore
      }
    };

    osc.start(time);
    osc.stop(time + 0.055);
    tapOsc.start(time);
    tapOsc.stop(time + 0.02);
  }

  _scheduleMetronomeClick(ctx, time, isAccent, gen) {
    if (gen !== this._metroGen) return;
    this._scheduleClickAt(ctx, time, isAccent);
  }

  _runMetronomeScheduler() {
    if (!this._metroRunning || !this.ctx || this.ctx.state !== 'running') return;
    const lookaheadSec = 0.12;
    const currentGen = this._metroGen;
    const beatDurSec = 60 / Math.max(40, Math.min(220, this._metroBpm));

    if (this._metroNextNoteTime < this.ctx.currentTime - 0.15) {
      this._metroNextNoteTime = this.ctx.currentTime + 0.02;
    }

    while (this._metroNextNoteTime < this.ctx.currentTime + lookaheadSec) {
      const beatIdx = this._metroBeatIndex;
      const totalBeats = this._metroBeats;
      const noteTime = this._metroNextNoteTime;

      this._scheduleMetronomeClick(this.ctx, noteTime, beatIdx === 0, currentGen);

      if (this._metroOnBeat) {
        const delayMs = Math.max(0, (noteTime - this.ctx.currentTime) * 1000);
        const uiId = setTimeout(() => {
          this._metroUiTimers.delete(uiId);
          if (this._metroRunning && currentGen === this._metroGen && this._metroOnBeat) {
            this._metroOnBeat(beatIdx, totalBeats);
          }
        }, delayMs);
        this._metroUiTimers.add(uiId);
      }

      this._metroBeatIndex = (beatIdx + 1) % totalBeats;
      this._metroNextNoteTime += beatDurSec;
    }
  }

  startMetronome({ bpm = 90, beatsPerBar = 4, volume = 0.7, onBeat = null } = {}) {
    this.stopCustomProgression();
    this.stopMetronome();
    const { ctx, resumePromise } = this._unlockContextSync();
    if (!ctx) return false;

    const gen = ++this._metroGen;
    this._metroRunning = true;
    this._metroBpm = Math.max(40, Math.min(220, Math.round(bpm || 90)));
    this._metroBeats = Math.max(1, Math.min(12, Math.round(beatsPerBar || 4)));
    this._metroVolume = Number.isFinite(volume) ? volume : 0.7;
    this._metroBeatIndex = 0;
    this._metroOnBeat = onBeat;

    const beginLoop = () => {
      if (!this._metroRunning || gen !== this._metroGen || !this.ctx) return;
      this._metroNextNoteTime = this.ctx.currentTime + 0.03;
      this._runMetronomeScheduler();
      this._metroIntervalId = setInterval(() => {
        this._runMetronomeScheduler();
      }, 25);
    };

    if (ctx.state === 'running' || !resumePromise) {
      beginLoop();
    } else {
      resumePromise.then(beginLoop).catch(() => {});
    }

    return true;
  }

  updateMetronome({ bpm, beatsPerBar, volume } = {}) {
    if (bpm !== undefined) {
      this._metroBpm = Math.max(40, Math.min(220, Math.round(bpm)));
    }
    if (beatsPerBar !== undefined) {
      const nextBeats = Math.max(1, Math.min(12, Math.round(beatsPerBar)));
      this._metroBeats = nextBeats;
      this._metroBeatIndex = this._metroBeatIndex % nextBeats;
    }
    if (volume !== undefined && Number.isFinite(volume)) {
      this._metroVolume = Math.max(0.1, Math.min(1, volume));
    }
  }

  stopMetronome() {
    this._metroGen += 1;
    this._metroRunning = false;
    if (this._metroIntervalId !== null) {
      clearInterval(this._metroIntervalId);
      this._metroIntervalId = null;
    }
    this._metroUiTimers.forEach((id) => clearTimeout(id));
    this._metroUiTimers.clear();
  }

  _runRhythmDemoScheduler() {
    if (!this._rhythmDemoRunning || !this.ctx || this.ctx.state !== 'running') return;
    const slots = this._rhythmDemoSlots;
    const cycleBeats = Math.max(1, Math.round(this._rhythmDemoCycleBeats || 4));
    if (!Array.isArray(slots) || slots.length === 0) {
      this.stopRhythmDemo();
      return;
    }

    const lookaheadSec = 0.14;
    const currentGen = this._rhythmDemoGen;
    const beatDurSec = 60 / Math.max(40, Math.min(220, this._rhythmDemoBpm));

    if (this._rhythmDemoNextBeatTime < this.ctx.currentTime - 0.15) {
      this._rhythmDemoNextBeatTime = this.ctx.currentTime + 0.02;
    }

    while (this._rhythmDemoNextBeatTime < this.ctx.currentTime + lookaheadSec) {
      const beatIdx = this._rhythmDemoBeatIdx;
      const noteTime = this._rhythmDemoNextBeatTime;

      if (this._rhythmDemoWithClick) {
        this._scheduleClickAt(this.ctx, noteTime, beatIdx === 0);
      }

      for (let sIdx = 0; sIdx < slots.length; sIdx += 1) {
        const slot = slots[sIdx];
        if (slot.offsetBeats >= beatIdx - 1e-6 && slot.offsetBeats < beatIdx + 1 - 1e-6) {
          const offsetWithinBeat = Math.max(0, slot.offsetBeats - beatIdx);
          const strokeTime = noteTime + offsetWithinBeat * beatDurSec;

          this._scheduleRhythmStroke(
            this.ctx,
            this._rhythmDemoMidiNotes,
            this._rhythmDemoRefFrequency,
            this._rhythmDemoInstrument,
            {
              startTime: strokeTime,
              beatDurSec,
              stroke: { ...slot, slotIndex: sIdx },
              playMode: this._rhythmDemoPlayMode,
            }
          );

          if (this._rhythmDemoOnSlot) {
            const delayMs = Math.max(0, (strokeTime - this.ctx.currentTime) * 1000);
            const uiId = setTimeout(() => {
              this._rhythmDemoUiTimers.delete(uiId);
              if (
                this._rhythmDemoRunning &&
                currentGen === this._rhythmDemoGen &&
                this._rhythmDemoOnSlot
              ) {
                this._rhythmDemoOnSlot({
                  slotIndex: sIdx,
                  beatIndex: beatIdx,
                });
              }
            }, delayMs);
            this._rhythmDemoUiTimers.add(uiId);
          }
        }
      }

      this._rhythmDemoBeatIdx = (beatIdx + 1) % cycleBeats;
      this._rhythmDemoNextBeatTime += beatDurSec;
    }
  }

  startRhythmDemo({
    slots = [],
    cycleBeats = 4,
    bpm = 96,
    midiNotes = [],
    refFrequency = 440,
    instrument = 'guitar',
    playMode = 'strum',
    withClick = true,
    onSlot = null,
  } = {}) {
    if (!Array.isArray(slots) || slots.length === 0 || !Array.isArray(midiNotes) || midiNotes.length === 0) {
      return false;
    }

    this.stopMetronome();
    this.stopAll();

    const { ctx, resumePromise } = this._unlockContextSync();
    if (!ctx) return false;

    const gen = ++this._rhythmDemoGen;
    this._rhythmDemoRunning = true;
    this._rhythmDemoSlots = slots;
    this._rhythmDemoCycleBeats = Math.max(1, Math.round(cycleBeats || 4));
    this._rhythmDemoBeatIdx = 0;
    this._rhythmDemoBpm = Math.max(40, Math.min(220, Math.round(bpm || 96)));
    this._rhythmDemoMidiNotes = midiNotes;
    this._rhythmDemoRefFrequency = Number.isFinite(refFrequency) ? refFrequency : 440;
    this._rhythmDemoInstrument = instrument || 'guitar';
    this._rhythmDemoPlayMode = playMode === 'arpeggio' ? 'arpeggio' : 'strum';
    this._rhythmDemoWithClick = Boolean(withClick);
    this._rhythmDemoOnSlot = onSlot;

    this._warmInstrumentAsync(ctx, this._rhythmDemoInstrument);

    const freqs = midiNotes
      .filter((m) => Number.isFinite(m))
      .map((m) => midiToFrequency(m, this._rhythmDemoRefFrequency))
      .filter((f) => Number.isFinite(f) && f > 0);

    const beginLoop = () => {
      if (!this._rhythmDemoRunning || gen !== this._rhythmDemoGen || !this.ctx) return;
      const pending = this._ensureSamplesForFreqs(this.ctx, this._rhythmDemoInstrument, freqs, 200);
      const launch = () => {
        if (
          !this._rhythmDemoRunning ||
          gen !== this._rhythmDemoGen ||
          !this.ctx ||
          this.ctx.state !== 'running'
        ) {
          return;
        }
        this._rhythmDemoNextBeatTime = this.ctx.currentTime + 0.03;
        this._runRhythmDemoScheduler();
        this._rhythmDemoIntervalId = setInterval(() => {
          this._runRhythmDemoScheduler();
        }, 20);
      };
      if (pending) {
        pending.then(launch).catch(launch);
      } else {
        launch();
      }
    };

    if (ctx.state === 'running' || !resumePromise) {
      beginLoop();
    } else {
      resumePromise.then(beginLoop).catch(() => {});
    }

    return true;
  }

  updateRhythmDemo({ bpm, midiNotes, refFrequency, instrument, playMode, withClick } = {}) {
    if (bpm !== undefined) {
      this._rhythmDemoBpm = Math.max(40, Math.min(220, Math.round(bpm)));
    }
    if (Array.isArray(midiNotes)) {
      this._rhythmDemoMidiNotes = midiNotes;
    }
    if (refFrequency !== undefined && Number.isFinite(refFrequency)) {
      this._rhythmDemoRefFrequency = refFrequency;
    }
    if (instrument !== undefined) {
      this._rhythmDemoInstrument = instrument;
    }
    if (playMode !== undefined) {
      this._rhythmDemoPlayMode = playMode === 'arpeggio' ? 'arpeggio' : 'strum';
    }
    if (withClick !== undefined) {
      this._rhythmDemoWithClick = Boolean(withClick);
    }
  }

  stopRhythmDemo() {
    this._rhythmDemoGen += 1;
    this._rhythmDemoRunning = false;
    if (this._rhythmDemoIntervalId !== null) {
      clearInterval(this._rhythmDemoIntervalId);
      this._rhythmDemoIntervalId = null;
    }
    this._rhythmDemoUiTimers.forEach((id) => clearTimeout(id));
    this._rhythmDemoUiTimers.clear();
  }

  _runCustomProgressionScheduler() {
    if (!this._seqRunning || this._seqEndScheduled || !this.ctx || this.ctx.state !== 'running') {
      return;
    }
    if (!Array.isArray(this._seqSteps) || this._seqSteps.length === 0) {
      this.stopCustomProgression();
      return;
    }

    const lookaheadSec = 0.14;
    const currentGen = this._seqGen;
    const beatDurSec = 60 / Math.max(40, Math.min(220, this._seqBpm));

    if (this._seqNextBeatTime < this.ctx.currentTime - 0.15) {
      this._seqNextBeatTime = this.ctx.currentTime + 0.02;
    }

    while (this._seqNextBeatTime < this.ctx.currentTime + lookaheadSec) {
      if (this._seqStepIdx >= this._seqSteps.length) {
        if (this._seqLoop) {
          this._seqStepIdx = 0;
          this._seqBeatInStep = 0;
        } else {
          this._seqEndScheduled = true;
          const finishDelayMs = Math.max(
            60,
            (this._seqNextBeatTime - this.ctx.currentTime) * 1000 + 80
          );
          const doneTimer = setTimeout(() => {
            this._seqUiTimers.delete(doneTimer);
            if (currentGen !== this._seqGen) return;
            const onDone = this._seqOnComplete;
            this.stopCustomProgression();
            if (onDone) onDone();
          }, finishDelayMs);
          this._seqUiTimers.add(doneTimer);
          break;
        }
      }

      const stepIndex = this._seqStepIdx;
      const step = this._seqSteps[stepIndex];
      const totalBeatsInStep = Math.max(1, Math.min(16, Math.round(step?.beats || 4)));
      const beatIndex = this._seqBeatInStep;
      const noteTime = this._seqNextBeatTime;
      const effectiveRhythmId =
        step?.rhythmId && step.rhythmId !== 'inherit' ? step.rhythmId : this._seqRhythmId;
      const activePattern = getRhythmPattern(effectiveRhythmId);

      if (this._seqWithClick) {
        this._scheduleClickAt(this.ctx, noteTime, beatIndex === 0);
      }

      const hasNotes = step && Array.isArray(step.midiNotes) && step.midiNotes.length > 0;
      const inst = step?.instrument || 'guitar';
      const profile = getInstrumentTimbre(inst);
      const stepDurationSec = totalBeatsInStep * beatDurSec;

      if (activePattern.id === 'single') {
        if (beatIndex === 0 && hasNotes) {
          const noteDurSec = Math.max(
            0.95,
            Math.min(profile.defaultChordDuration + 0.25, stepDurationSec * 1.05)
          );
          const midiNotes = step.midiNotes;
          const isArp = this._seqPlayMode === 'arpeggio' && midiNotes.length > 1;

          if (isArp) {
            const total = midiNotes.length;
            const perNoteVol = Math.min(0.47, 1.34 / Math.max(1, total));
            const stepOffsetSec = Math.min(
              0.22,
              Math.max(0.095, (stepDurationSec * 0.72) / total)
            );
            midiNotes.forEach((midi, nIdx) => {
              if (!Number.isFinite(midi)) return;
              const freq = midiToFrequency(midi, this._seqRefFrequency);
              if (!Number.isFinite(freq) || freq <= 0) return;
              const noteStart = Math.max(this.ctx.currentTime, noteTime + nIdx * stepOffsetSec);
              const ringDur = Math.max(0.85, stepDurationSec - nIdx * stepOffsetSec + 0.08);
              const accent = nIdx === 0 ? 1.05 : nIdx === total - 1 ? 0.98 : 0.9;
              const pan = total > 1 ? (nIdx / (total - 1) - 0.5) * 0.22 : 0;
              this._schedulePluckedFreq(this.ctx, freq, {
                instrument: inst,
                startTime: noteStart,
                durationSec: Math.min(profile.defaultChordDuration, ringDur),
                volume: perNoteVol * accent,
                pan,
                velocity: accent,
              });
            });
          } else {
            const strumEvents = this._buildStrumSchedule(
              midiNotes,
              this._seqRefFrequency,
              inst
            );
            strumEvents.forEach((ev) => {
              const exactStart = Math.max(this.ctx.currentTime, noteTime + ev.delaySec);
              this._schedulePluckedFreq(this.ctx, ev.freq, {
                instrument: inst,
                startTime: exactStart,
                durationSec: noteDurSec,
                volume: ev.volume,
                pan: ev.pan,
                velocity: ev.velocity,
              });
            });
          }
        }

        if (this._seqOnStepBeat) {
          const delayMs = Math.max(0, (noteTime - this.ctx.currentTime) * 1000);
          const uiId = setTimeout(() => {
            this._seqUiTimers.delete(uiId);
            if (this._seqRunning && currentGen === this._seqGen && this._seqOnStepBeat) {
              this._seqOnStepBeat({
                stepIndex,
                beatIndex,
                totalBeatsInStep,
                uid: step?.uid,
                slotIndex: beatIndex % activePattern.slots.length,
                rhythmId: activePattern.id,
              });
            }
          }, delayMs);
          this._seqUiTimers.add(uiId);
        }
      } else {
        const expandedStrokes = expandRhythmEventsForStep(activePattern.id, totalBeatsInStep);
        let scheduledBeatCursor = false;

        for (let i = 0; i < expandedStrokes.length; i += 1) {
          const ev = expandedStrokes[i];
          if (ev.offsetBeats >= beatIndex - 1e-6 && ev.offsetBeats < beatIndex + 1 - 1e-6) {
            const subOffsetSec = Math.max(0, ev.offsetBeats - beatIndex) * beatDurSec;
            const strokeTime = noteTime + subOffsetSec;
            if (Math.abs(ev.offsetBeats - beatIndex) < 1e-4) {
              scheduledBeatCursor = true;
            }

            if (hasNotes) {
              this._scheduleRhythmStroke(ctxRefFallback(this.ctx), step.midiNotes, this._seqRefFrequency, inst, {
                startTime: strokeTime,
                beatDurSec,
                stroke: ev,
                playMode: this._seqPlayMode,
                maxRingSec: Math.min(profile.defaultChordDuration, stepDurationSec * 0.95),
              });
            }

            if (this._seqOnStepBeat) {
              const delayMs = Math.max(0, (strokeTime - this.ctx.currentTime) * 1000);
              const uiId = setTimeout(() => {
                this._seqUiTimers.delete(uiId);
                if (this._seqRunning && currentGen === this._seqGen && this._seqOnStepBeat) {
                  this._seqOnStepBeat({
                    stepIndex,
                    beatIndex,
                    totalBeatsInStep,
                    uid: step?.uid,
                    slotIndex: ev.slotIndex,
                    rhythmId: activePattern.id,
                  });
                }
              }, delayMs);
              this._seqUiTimers.add(uiId);
            }
          }
        }

        if (!scheduledBeatCursor && this._seqOnStepBeat) {
          const delayMs = Math.max(0, (noteTime - this.ctx.currentTime) * 1000);
          const uiId = setTimeout(() => {
            this._seqUiTimers.delete(uiId);
            if (this._seqRunning && currentGen === this._seqGen && this._seqOnStepBeat) {
              this._seqOnStepBeat({
                stepIndex,
                beatIndex,
                totalBeatsInStep,
                uid: step?.uid,
                slotIndex: null,
                rhythmId: activePattern.id,
              });
            }
          }, delayMs);
          this._seqUiTimers.add(uiId);
        }
      }

      this._seqBeatInStep += 1;
      if (this._seqBeatInStep >= totalBeatsInStep) {
        this._seqBeatInStep = 0;
        this._seqStepIdx += 1;
      }
      this._seqNextBeatTime += beatDurSec;
    }
  }

  startCustomProgression({
    steps = [],
    bpm = 90,
    refFrequency = 440,
    playMode = 'strum',
    rhythmId = 'single',
    withClick = true,
    loop = true,
    onStepBeat = null,
    onComplete = null,
  } = {}) {
    if (!Array.isArray(steps) || steps.length === 0) return false;

    this.stopMetronome();
    this.stopAll();

    const { ctx, resumePromise } = this._unlockContextSync();
    if (!ctx) return false;

    const gen = ++this._seqGen;
    this._seqRunning = true;
    this._seqEndScheduled = false;
    this._seqSteps = steps;
    this._seqBpm = Math.max(40, Math.min(220, Math.round(bpm || 90)));
    this._seqRefFrequency = Number.isFinite(refFrequency) ? refFrequency : 440;
    this._seqPlayMode = playMode === 'arpeggio' ? 'arpeggio' : 'strum';
    this._seqRhythmId = getRhythmPattern(rhythmId).id;
    this._seqWithClick = Boolean(withClick);
    this._seqLoop = Boolean(loop);
    this._seqStepIdx = 0;
    this._seqBeatInStep = 0;
    this._seqOnStepBeat = onStepBeat;
    this._seqOnComplete = onComplete;

    // Preload all unique notes used in the progression steps before beat 1
    const byInst = new Map();
    steps.forEach((step) => {
      const inst = step?.instrument || 'guitar';
      this._warmInstrumentAsync(ctx, inst);
      if (!byInst.has(inst)) byInst.set(inst, []);
      (step?.midiNotes || []).forEach((midi) => {
        if (Number.isFinite(midi)) {
          const f = midiToFrequency(midi, this._seqRefFrequency);
          if (Number.isFinite(f) && f > 0) byInst.get(inst).push(f);
        }
      });
    });

    const beginLoop = () => {
      if (!this._seqRunning || gen !== this._seqGen || !this.ctx) return;

      const preloadPromises = [];
      byInst.forEach((freqs, inst) => {
        const p = this._ensureSamplesForFreqs(this.ctx, inst, freqs, 220);
        if (p) preloadPromises.push(p);
      });

      const launch = () => {
        if (!this._seqRunning || gen !== this._seqGen || !this.ctx || this.ctx.state !== 'running') {
          return;
        }
        this._seqNextBeatTime = this.ctx.currentTime + 0.03;
        this._runCustomProgressionScheduler();
        this._seqIntervalId = setInterval(() => {
          this._runCustomProgressionScheduler();
        }, 20);
      };

      if (preloadPromises.length > 0) {
        Promise.all(preloadPromises).then(launch).catch(launch);
      } else {
        launch();
      }
    };

    if (ctx.state === 'running' || !resumePromise) {
      beginLoop();
    } else {
      resumePromise.then(beginLoop).catch(() => {});
    }

    return true;
  }

  updateCustomProgression({ steps, bpm, refFrequency, playMode, rhythmId, withClick, loop } = {}) {
    if (Array.isArray(steps)) {
      this._seqSteps = steps;
      if (steps.length === 0) {
        this.stopCustomProgression();
        return;
      }
      if (this._seqStepIdx >= steps.length) {
        this._seqStepIdx = 0;
        this._seqBeatInStep = 0;
      }
    }
    if (bpm !== undefined) {
      this._seqBpm = Math.max(40, Math.min(220, Math.round(bpm)));
    }
    if (refFrequency !== undefined && Number.isFinite(refFrequency)) {
      this._seqRefFrequency = refFrequency;
    }
    if (playMode !== undefined) {
      this._seqPlayMode = playMode === 'arpeggio' ? 'arpeggio' : 'strum';
    }
    if (rhythmId !== undefined) {
      this._seqRhythmId = getRhythmPattern(rhythmId).id;
    }
    if (withClick !== undefined) {
      this._seqWithClick = Boolean(withClick);
    }
    if (loop !== undefined) {
      this._seqLoop = Boolean(loop);
    }
  }

  stopCustomProgression() {
    this._seqGen += 1;
    this._seqRunning = false;
    this._seqEndScheduled = false;
    if (this._seqIntervalId !== null) {
      clearInterval(this._seqIntervalId);
      this._seqIntervalId = null;
    }
    this._seqUiTimers.forEach((id) => clearTimeout(id));
    this._seqUiTimers.clear();
  }

  dispose() {
    this.stopAll();
    this.stopMetronome();
    this.stopCustomProgression();
    this.stopRhythmDemo();
    this.bufferCache.clear();
    this.sampleBuffers.clear();
    this.sampleInFlight.clear();
    this._warmedInstruments.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

function ctxRefFallback(ctx) {
  return ctx;
}

export const learnAudio = new LearnAudioEngine();
