import { midiToFrequency } from './frequencyUtils';

class LearnAudioEngine {
  constructor() {
    this.ctx = null;
    this.activeNodes = new Set();
    this.timers = new Set();
  }

  _ensureContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  stopAll() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();

    this.activeNodes.forEach(({ osc, gain, subOsc }) => {
      try {
        if (this.ctx) {
          gain.gain.cancelScheduledValues(this.ctx.currentTime);
          gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.015);
        }
        const stopAt = this.ctx ? this.ctx.currentTime + 0.05 : 0;
        osc.stop(stopAt);
        if (subOsc) subOsc.stop(stopAt);
      } catch {
        // ignore stopped nodes
      }
    });
    this.activeNodes.clear();
  }

  playPluckedNote(midi, refFrequency = 440, delaySec = 0, durationSec = 0.9, volume = 0.16) {
    const ctx = this._ensureContext();
    if (!ctx || !Number.isFinite(midi)) return;

    const freq = midiToFrequency(midi, refFrequency);
    if (!Number.isFinite(freq) || freq <= 0) return;

    const startTime = ctx.currentTime + delaySec;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(4200, freq * 6), startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.8), startTime + durationSec);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    let subOsc = null;
    let subGain = null;
    if (freq < 140) {
      subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 2, startTime);
      subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.28, startTime);
      subOsc.connect(subGain);
      subGain.connect(filter);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    const nodeEntry = { osc, gain, subOsc };
    this.activeNodes.add(nodeEntry);
    osc.onended = () => {
      this.activeNodes.delete(nodeEntry);
      try {
        osc.disconnect();
        if (subOsc) subOsc.disconnect();
        if (subGain) subGain.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.05);
    if (subOsc) {
      subOsc.start(startTime);
      subOsc.stop(startTime + durationSec + 0.05);
    }
  }

  playChordStrum(midiNotes, refFrequency = 440) {
    this.stopAll();
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return;

    const perNoteVol = Math.min(0.14, 0.42 / midiNotes.length);
    midiNotes.forEach((midi, idx) => {
      this.playPluckedNote(midi, refFrequency, idx * 0.045, 1.35, perNoteVol);
    });
  }

  playSequence(midiNotes, refFrequency = 440, stepMs = 280, onStep = null, onComplete = null) {
    this.stopAll();
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return;

    midiNotes.forEach((midi, idx) => {
      const delayMs = idx * stepMs;
      this.playPluckedNote(midi, refFrequency, delayMs / 1000, 0.55, 0.16);
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
      }, midiNotes.length * stepMs + 120);
      this.timers.add(endId);
    }
  }

  playProgression(chords, refFrequency = 440, stepMs = 900, onStep = null, onComplete = null) {
    this.stopAll();
    if (!Array.isArray(chords) || chords.length === 0) return;

    chords.forEach((chord, cIdx) => {
      const midiNotes = chord?.voicings?.[0]?.midiNotes || [];
      const baseDelayMs = cIdx * stepMs;
      const perNoteVol = Math.min(0.13, 0.38 / Math.max(1, midiNotes.length));

      midiNotes.forEach((midi, nIdx) => {
        this.playPluckedNote(midi, refFrequency, (baseDelayMs + nIdx * 40) / 1000, 0.95, perNoteVol);
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
      }, chords.length * stepMs + 150);
      this.timers.add(endId);
    }
  }

  dispose() {
    this.stopAll();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

export const learnAudio = new LearnAudioEngine();
