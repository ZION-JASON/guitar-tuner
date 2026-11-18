import { midiToFrequency } from './frequencyUtils.js';

const INSTRUMENT_TIMBRE = {
  guitar: {
    pickPos: 0.17,
    loopDamping: 0.08,
    rt60DbPerSec: -9.5,
    noiseMix: 0.22,
    noiseCutoffRatio: 0.25,
    pluckRoundFrac: 0.015, // crisp steel-string pluck corner
    bodyTapMix: 0.08,
    bodyTapHz: 118,
    bodyLowHz: 108,
    bodyLowGainDb: 4.0,
    bodyMidHz: 225,
    bodyMidGainDb: 2.2,
    presenceHz: 2100,
    presenceGainDb: 1.0,
    attackCutoffHz: 5400,
    sustainCutoffHz: 2300,
    brightnessDecaySec: 0.65,
    roomWetMix: 0.22,
    roomDecaySec: 0.28,
    strumStepSec: 0.025,
    defaultNoteDuration: 1.8,
    defaultChordDuration: 2.5,
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
    roomDecaySec: 0.18,
    strumStepSec: 0.036,
    defaultNoteDuration: 1.9,
    defaultChordDuration: 2.3,
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
    roomWetMix: 0.24,
    roomDecaySec: 0.24,
    strumStepSec: 0.019,
    defaultNoteDuration: 1.55,
    defaultChordDuration: 1.95,
  },
};

export function getInstrumentTimbre(instrumentId = 'guitar') {
  return INSTRUMENT_TIMBRE[instrumentId] || INSTRUMENT_TIMBRE.guitar;
}

/**
 * Pure-JS Physical String Synthesis (Plucked-Triangle + Thiran Allpass + 3-Tap Symmetric Loop).
 * Models realistic initial string displacement (not raw static noise), finger/nylon compliance
 * smoothing, 1st-order Thiran Allpass fractional delay (flat magnitude across all pitches),
 * pitch-normalized RT60 sustain, and subtle wooden body attack resonance.
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

  // Round corners proportionally to period length so low bass strings are as smooth as treble strings
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

  // 2. Band-limited noise burst for organic pluck transient
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

  // Blend displacement + soft noise, center to zero mean, normalize safely below 0.86 peak
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
    delayLine[i] = (exc[i] / maxAbs) * 0.86;
  }

  // Pitch-normalized per-cycle gain so bass, guitar, and high ukulele notes all sustain naturally
  const gainPerSec = Math.pow(10, profile.rt60DbPerSec / 20);
  const loopGain = Math.min(0.9992, Math.pow(gainPerSec, 1 / freq));
  // Gentle extra damping at higher pitches for authentic string air/internal friction
  const b = Math.min(0.24, profile.loopDamping + Math.min(0.04, (freq / 1200) * 0.04));

  let writeIdx = excLen % bufLen;
  let prevApIn = 0;
  let prevApOut = 0;
  let apHist1 = 0;
  let apHist2 = 0;
  let dcPrevIn = 0;
  let dcPrevOut = 0;

  // Short damped acoustic soundboard/body knock at attack (no white-noise hiss!)
  const bodyTapLen = Math.min(totalSamples, Math.round(sampleRate * 0.045));
  const bodyOmega = (2 * Math.PI * profile.bodyTapHz) / sampleRate;
  const bodyDecayPerSample = Math.exp(-85 / sampleRate);
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

    // Add soft woody body thump during the first ~45ms
    let sample = feedback;
    if (i < bodyTapLen) {
      sample += bodyAmp * Math.sin(bodyOmega * i);
      bodyAmp *= bodyDecayPerSample;
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

    this._bindGlobalUnlock();
  }

  _bindGlobalUnlock() {
    if (this._gestureListenersBound || typeof window === 'undefined') return;
    this._gestureListenersBound = true;

    const handleFirstGesture = () => {
      const { ctx, resumePromise } = this._unlockContextSync();
      if (ctx && ctx.state === 'running') {
        cleanup();
      } else if (resumePromise) {
        resumePromise
          .then(() => {
            if (this.ctx && this.ctx.state === 'running') {
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
      this.roomWetGains.clear();
      this._unlocked = false;

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 14;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;

      const master = this.ctx.createGain();
      master.gain.value = 1.35;

      comp.connect(master);
      master.connect(this.ctx.destination);
      this.compressor = comp;
      this.masterGain = master;

      const dry = this.ctx.createGain();
      dry.gain.value = 0.9;
      dry.connect(comp);
      this.dryBus = dry;

      // Single shared acoustic studio room convolver per context (zero per-note allocation)
      if (typeof this.ctx.createConvolver === 'function') {
        const ir = getInstrumentRoomIR(this.ctx, 'guitar');
        if (ir) {
          const convolver = this.ctx.createConvolver();
          convolver.buffer = ir;
          const wet = this.ctx.createGain();
          wet.gain.value = 0.2;
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

  _withReadyContext(gen, callback) {
    const { ctx, resumePromise } = this._unlockContextSync();
    if (!ctx) return;

    if (ctx.state === 'running' || !resumePromise) {
      if (gen === this.playGen) {
        callback(ctx);
      }
      return;
    }

    resumePromise.then(() => {
      if (gen !== this.playGen || !this.ctx || this.ctx.state === 'closed') return;
      if (this.ctx.state !== 'running') return;
      callback(this.ctx);
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

  _schedulePluckedFreq(
    ctx,
    freq,
    {
      instrument = 'guitar',
      delaySec = 0,
      startTime: explicitStartTime = null,
      durationSec = null,
      volume = 0.55,
    } = {}
  ) {
    if (!ctx || ctx.state === 'closed' || !Number.isFinite(freq) || freq <= 0) return;

    const profile = getInstrumentTimbre(instrument);
    const dur = durationSec ?? profile.defaultNoteDuration;
    const startTime =
      Number.isFinite(explicitStartTime) && explicitStartTime >= ctx.currentTime
        ? explicitStartTime
        : ctx.currentTime + Math.max(0, delaySec);

    const buffer = this._getCachedBuffer(ctx, freq, dur, instrument);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const body = createInstrumentBodyChain(ctx, instrument, startTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);

    source.connect(body.input);
    body.output.connect(gain);

    const roomBus = this.roomWetGains.get('default');
    if (this.dryBus && roomBus) {
      roomBus.wet.gain.setTargetAtTime(profile.roomWetMix, startTime, 0.02);
      gain.connect(this.dryBus);
      gain.connect(roomBus.convolver);
    } else {
      gain.connect(this.compressor || ctx.destination);
    }

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
    this._withReadyContext(gen, (ctx) => {
      this._schedulePluckedFreq(ctx, freq, { instrument, delaySec, durationSec, volume });
    });
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

  playChordStrum(midiNotes, refFrequency = 440, instrument = 'guitar') {
    this.stopAll();
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return;

    const gen = this.playGen;
    const profile = getInstrumentTimbre(instrument);
    const perNoteVol = Math.min(0.48, 1.4 / midiNotes.length);

    this._withReadyContext(gen, (ctx) => {
      midiNotes.forEach((midi, idx) => {
        if (!Number.isFinite(midi)) return;
        const freq = midiToFrequency(midi, refFrequency);
        if (!Number.isFinite(freq) || freq <= 0) return;
        // Natural slightly expressive downstroke timing
        const jitter = (idx % 2 === 0 ? 1 : -1) * 0.002;
        const delaySec = Math.max(0, idx * profile.strumStepSec + jitter);
        const accent = idx === 0 ? 1.08 : idx === midiNotes.length - 1 ? 0.96 : 0.9;
        this._schedulePluckedFreq(ctx, freq, {
          instrument,
          delaySec,
          durationSec: profile.defaultChordDuration,
          volume: perNoteVol * accent,
        });
      });
    });
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
    const noteDurationSec = Math.max(1.05, profile.defaultChordDuration * 0.72);

    this._withReadyContext(gen, (ctx) => {
      midiNotes.forEach((midi, idx) => {
        const delayMs = idx * stepMs;
        if (Number.isFinite(midi)) {
          const freq = midiToFrequency(midi, refFrequency);
          if (Number.isFinite(freq) && freq > 0) {
            this._schedulePluckedFreq(ctx, freq, {
              instrument,
              delaySec: delayMs / 1000,
              durationSec: noteDurationSec,
              volume: 0.54,
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
    });
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

    this._withReadyContext(gen, (ctx) => {
      chords.forEach((chord, cIdx) => {
        const midiNotes = chord?.voicings?.[0]?.midiNotes || [];
        const baseDelayMs = cIdx * stepMs;
        const perNoteVol = Math.min(0.45, 1.3 / Math.max(1, midiNotes.length));
        const isArp = playMode === 'arpeggio' && midiNotes.length > 1;
        const stepOffsetMs = isArp
          ? Math.min(200, Math.max(115, Math.floor((stepMs * 0.68) / midiNotes.length)))
          : Math.round(profile.strumStepSec * 1000);
        const noteDurationSec = Math.max(1.15, profile.defaultChordDuration * 0.65);

        midiNotes.forEach((midi, nIdx) => {
          if (!Number.isFinite(midi)) return;
          const freq = midiToFrequency(midi, refFrequency);
          if (!Number.isFinite(freq) || freq <= 0) return;
          const delaySec = (baseDelayMs + nIdx * stepOffsetMs) / 1000;
          this._schedulePluckedFreq(ctx, freq, {
            instrument,
            delaySec,
            durationSec: noteDurationSec,
            volume: perNoteVol,
          });
        });

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
    });
  }

  _scheduleClickAt(ctx, time, isAccent) {
    if (!ctx || ctx.state === 'closed') return;

    const osc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    const vol = Math.max(0.05, Math.min(1, this._metroVolume)) * (isAccent ? 0.55 : 0.36);

    osc.type = 'triangle';
    const startFreq = isAccent ? 1240 : 880;
    const endFreq = isAccent ? 760 : 540;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.032);

    clickGain.gain.setValueAtTime(0.0001, time);
    clickGain.gain.linearRampToValueAtTime(vol, time + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

    osc.connect(clickGain);
    clickGain.connect(this.compressor || ctx.destination);

    osc.onended = () => {
      try {
        osc.disconnect();
        clickGain.disconnect();
      } catch {
        // ignore
      }
    };

    osc.start(time);
    osc.stop(time + 0.065);
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

      if (this._seqWithClick) {
        this._scheduleClickAt(this.ctx, noteTime, beatIndex === 0);
      }

      if (beatIndex === 0 && step && Array.isArray(step.midiNotes) && step.midiNotes.length > 0) {
        const inst = step.instrument || 'guitar';
        const profile = getInstrumentTimbre(inst);
        const stepDurationSec = totalBeatsInStep * beatDurSec;
        const noteDurSec = Math.max(
          0.75,
          Math.min(profile.defaultChordDuration + 0.35, stepDurationSec * 1.04)
        );
        const midiNotes = step.midiNotes;
        const perNoteVol = Math.min(0.46, 1.32 / Math.max(1, midiNotes.length));
        const isArp = this._seqPlayMode === 'arpeggio' && midiNotes.length > 1;
        const stepOffsetSec = isArp
          ? Math.min(0.2, Math.max(0.085, (stepDurationSec * 0.68) / midiNotes.length))
          : profile.strumStepSec;

        midiNotes.forEach((midi, nIdx) => {
          if (!Number.isFinite(midi)) return;
          const freq = midiToFrequency(midi, this._seqRefFrequency);
          if (!Number.isFinite(freq) || freq <= 0) return;
          const jitter = isArp ? 0 : (nIdx % 2 === 0 ? 1 : -1) * 0.0018;
          const exactStart = Math.max(this.ctx.currentTime, noteTime + nIdx * stepOffsetSec + jitter);
          const accent = nIdx === 0 ? 1.06 : nIdx === midiNotes.length - 1 ? 0.96 : 0.9;
          this._schedulePluckedFreq(this.ctx, freq, {
            instrument: inst,
            startTime: exactStart,
            durationSec: noteDurSec,
            volume: perNoteVol * accent,
          });
        });
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
            });
          }
        }, delayMs);
        this._seqUiTimers.add(uiId);
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
    this._seqWithClick = Boolean(withClick);
    this._seqLoop = Boolean(loop);
    this._seqStepIdx = 0;
    this._seqBeatInStep = 0;
    this._seqOnStepBeat = onStepBeat;
    this._seqOnComplete = onComplete;

    const beginLoop = () => {
      if (!this._seqRunning || gen !== this._seqGen || !this.ctx) return;
      this._seqNextBeatTime = this.ctx.currentTime + 0.03;
      this._runCustomProgressionScheduler();
      this._seqIntervalId = setInterval(() => {
        this._runCustomProgressionScheduler();
      }, 25);
    };

    if (ctx.state === 'running' || !resumePromise) {
      beginLoop();
    } else {
      resumePromise.then(beginLoop).catch(() => {});
    }

    return true;
  }

  updateCustomProgression({ steps, bpm, refFrequency, playMode, withClick, loop } = {}) {
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
    this.bufferCache.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

export const learnAudio = new LearnAudioEngine();
