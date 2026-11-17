import { midiToFrequency } from './frequencyUtils.js';

const INSTRUMENT_TIMBRE = {
  guitar: {
    pickPos: 0.17,
    loopBlend: 0.42, // bright steel-string harmonic decay
    decayBase: 0.9968,
    pickClickMix: 0.24,
    bodyLowHz: 112,
    bodyLowGainDb: 3.5,
    bodyMidHz: 240,
    bodyMidGainDb: 2.0,
    presenceHz: 2300,
    presenceGainDb: 1.5,
    strumStepSec: 0.028,
    defaultNoteDuration: 1.65,
    defaultChordDuration: 2.35,
  },
  bass: {
    pickPos: 0.29,
    loopBlend: 0.22, // warm fingerstyle fundamental
    decayBase: 0.9974,
    pickClickMix: 0.12,
    bodyLowHz: 86,
    bodyLowGainDb: 4.5,
    bodyMidHz: 195,
    bodyMidGainDb: 2.5,
    presenceHz: 1200,
    presenceGainDb: 0.5,
    strumStepSec: 0.036,
    defaultNoteDuration: 1.8,
    defaultChordDuration: 2.2,
  },
  ukulele: {
    pickPos: 0.23,
    loopBlend: 0.34, // mellow nylon-string rolloff
    decayBase: 0.9946,
    pickClickMix: 0.16,
    bodyLowHz: 290,
    bodyLowGainDb: 3.0,
    bodyMidHz: 520,
    bodyMidGainDb: 2.0,
    presenceHz: 1900,
    presenceGainDb: 1.0,
    strumStepSec: 0.022,
    defaultNoteDuration: 1.3,
    defaultChordDuration: 1.75,
  },
};

export function getInstrumentTimbre(instrumentId = 'guitar') {
  return INSTRUMENT_TIMBRE[instrumentId] || INSTRUMENT_TIMBRE.guitar;
}

/**
 * Pure-JS Extended Karplus-Strong physical string synthesis.
 * Models pick/finger noise burst, pick-position comb filtering, exact
 * phase-compensated fractional delay (linear + loop delay subtraction),
 * and frequency-dependent string damping.
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

  // Two-point loop average y[n] = (1 - a) * x[n] + a * x[n-1] adds exact delay `a` samples.
  // Subtract `a` from the period so the fundamental pitch stays sub-cent accurate.
  const loopWeight = profile.loopBlend;
  const rawPeriod = sampleRate / freq;
  const compensatedDelay = Math.max(4, rawPeriod - loopWeight);
  const delayInt = Math.floor(compensatedDelay);
  const frac = compensatedDelay - delayInt;
  const bufLen = delayInt + 2;
  const delayLine = new Float32Array(bufLen);

  // Deterministic PRNG for clean repeatable transient texture
  let rng = (Math.abs(Math.round(freq * 100)) + seed) >>> 0 || 2463534242;
  const nextRand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0xffffffff - 0.5;
  };

  // Pre-filter burst noise so high strings aren't overly hissy
  const excitationLen = Math.max(8, Math.round(rawPeriod));
  const noiseRaw = new Float32Array(excitationLen);
  let preLp = 0;
  const excBright = instrument === 'bass' ? 0.35 : instrument === 'ukulele' ? 0.55 : 0.72;
  for (let i = 0; i < excitationLen; i++) {
    const white = nextRand() * 2;
    preLp = excBright * white + (1 - excBright) * preLp;
    noiseRaw[i] = preLp;
  }

  // Pick-position comb filter + gentle fundamental reinforcement for low registers
  const pickComb = Math.max(1, Math.round(excitationLen * profile.pickPos));
  const lowFundamentalBoost = freq < 130 ? 0.24 : freq < 220 ? 0.1 : 0.04;
  let maxExc = 0.0001;
  for (let i = 0; i < excitationLen; i++) {
    const delayed = i >= pickComb ? noiseRaw[i - pickComb] : 0;
    const fundamental = lowFundamentalBoost * Math.sin((2 * Math.PI * i) / rawPeriod);
    const val = noiseRaw[i] - 0.82 * delayed + fundamental;
    delayLine[i % bufLen] = val;
    if (Math.abs(val) > maxExc) maxExc = Math.abs(val);
  }
  for (let i = 0; i < excitationLen; i++) {
    delayLine[i % bufLen] /= maxExc;
  }

  // Frequency-compensated loop damping so high notes still ring musically
  const pitchFactor = Math.min(1, Math.max(0, (freq - 65) / 600));
  const decay = profile.decayBase - pitchFactor * 0.0012;

  let writeIdx = 0;
  let prevDelayed = 0;
  let prevOut = 0;
  const pickClickSamples = Math.min(totalSamples, Math.round(sampleRate * 0.007));

  for (let i = 0; i < totalSamples; i++) {
    const readA = (writeIdx - delayInt + bufLen) % bufLen;
    const readB = (readA - 1 + bufLen) % bufLen;

    // Fractional linear interpolation
    const delayed = delayLine[readA] * (1 - frac) + delayLine[readB] * frac;

    // Frequency-dependent two-point damping loop
    const filtered = ((1 - loopWeight) * delayed + loopWeight * prevDelayed) * decay;
    prevDelayed = delayed;

    delayLine[writeIdx] = filtered;
    writeIdx = (writeIdx + 1) % bufLen;

    // Subtle acoustic plectrum/finger transient during first ~7ms
    let sample = filtered;
    if (i < pickClickSamples) {
      const env = 1 - i / pickClickSamples;
      sample += profile.pickClickMix * env * env * nextRand();
    }

    // DC-blocking gentle smoothing
    const finalSample = sample - 0.002 * prevOut;
    prevOut = finalSample;

    // Smooth tail fade-out over last 60ms to prevent clicks
    const fadeSamples = Math.min(totalSamples, Math.round(sampleRate * 0.06));
    if (i > totalSamples - fadeSamples) {
      const rem = (totalSamples - i) / fadeSamples;
      out[i] = finalSample * rem;
    } else {
      out[i] = finalSample;
    }
  }

  return out;
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
  buffer.copyToChannel(samples, 0);
  return buffer;
}

export function createInstrumentBodyChain(ctx, instrument = 'guitar') {
  const profile = getInstrumentTimbre(instrument);

  const lowBody = ctx.createBiquadFilter();
  lowBody.type = 'peaking';
  lowBody.frequency.value = profile.bodyLowHz;
  lowBody.Q.value = 1.1;
  lowBody.gain.value = profile.bodyLowGainDb;

  const midWarmth = ctx.createBiquadFilter();
  midWarmth.type = 'peaking';
  midWarmth.frequency.value = profile.bodyMidHz;
  midWarmth.Q.value = 1.0;
  midWarmth.gain.value = profile.bodyMidGainDb;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = profile.presenceHz;
  presence.Q.value = 0.9;
  presence.gain.value = profile.presenceGainDb;

  const airCut = ctx.createBiquadFilter();
  airCut.type = 'lowpass';
  airCut.frequency.value = instrument === 'bass' ? 2400 : instrument === 'ukulele' ? 4200 : 5400;

  lowBody.connect(midWarmth);
  midWarmth.connect(presence);
  presence.connect(airCut);

  return { input: lowBody, output: airCut };
}

class LearnAudioEngine {
  constructor() {
    this.ctx = null;
    this.compressor = null;
    this.activeNodes = new Set();
    this.timers = new Set();
    this.bufferCache = new Map();
  }

  _ensureContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
      this.bufferCache.clear();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 14;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      comp.connect(this.ctx.destination);
      this.compressor = comp;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
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

  stopAll() {
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
    const ctx = this._ensureContext();
    if (!ctx || !Number.isFinite(freq) || freq <= 0) return;

    const profile = getInstrumentTimbre(instrument);
    const dur = durationSec ?? profile.defaultNoteDuration;
    const startTime = ctx.currentTime + delaySec;

    const buffer = this._getCachedBuffer(ctx, freq, dur, instrument);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const body = createInstrumentBodyChain(ctx, instrument);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);

    source.connect(body.input);
    body.output.connect(gain);
    gain.connect(this.compressor || ctx.destination);

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

    const profile = getInstrumentTimbre(instrument);
    const perNoteVol = Math.min(0.46, 1.35 / midiNotes.length);

    midiNotes.forEach((midi, idx) => {
      // Natural slightly expressive downstroke timing
      const jitter = ((idx % 2 === 0 ? 1 : -1) * 0.002);
      const delaySec = Math.max(0, idx * profile.strumStepSec + jitter);
      const accent = idx === 0 ? 1.08 : idx === midiNotes.length - 1 ? 0.96 : 0.9;
      this.playPluckedNote(
        midi,
        refFrequency,
        delaySec,
        profile.defaultChordDuration,
        perNoteVol * accent,
        instrument
      );
    });
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

    midiNotes.forEach((midi, idx) => {
      const delayMs = idx * stepMs;
      this.playPluckedNote(midi, refFrequency, delayMs / 1000, 0.95, 0.54, instrument);
      if (onStep) {
        const tId = setTimeout(() => {
          this.timers.delete(tId);
          onStep(idx, midi);
        }, delayMs);
        this.timers.add(tId);
      }
    });

    if (onComplete) {
      const endId = setTimeout(() => {
        this.timers.delete(endId);
        onComplete();
      }, midiNotes.length * stepMs + 150);
      this.timers.add(endId);
    }
  }

  playProgression(
    chords,
    refFrequency = 440,
    stepMs = 900,
    onStep = null,
    onComplete = null,
    instrument = 'guitar'
  ) {
    this.stopAll();
    if (!Array.isArray(chords) || chords.length === 0) return;

    const profile = getInstrumentTimbre(instrument);
    chords.forEach((chord, cIdx) => {
      const midiNotes = chord?.voicings?.[0]?.midiNotes || [];
      const baseDelayMs = cIdx * stepMs;
      const perNoteVol = Math.min(0.42, 1.2 / Math.max(1, midiNotes.length));

      midiNotes.forEach((midi, nIdx) => {
        const delaySec = (baseDelayMs + nIdx * Math.round(profile.strumStepSec * 1000)) / 1000;
        this.playPluckedNote(midi, refFrequency, delaySec, 1.15, perNoteVol, instrument);
      });

      if (onStep) {
        const tId = setTimeout(() => {
          this.timers.delete(tId);
          onStep(cIdx);
        }, baseDelayMs);
        this.timers.add(tId);
      }
    });

    if (onComplete) {
      const endId = setTimeout(() => {
        this.timers.delete(endId);
        onComplete();
      }, chords.length * stepMs + 180);
      this.timers.add(endId);
    }
  }

  dispose() {
    this.stopAll();
    this.bufferCache.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

export const learnAudio = new LearnAudioEngine();
