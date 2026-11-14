/**
 * YIN Pitch Detection Algorithm (de Cheveigne & Kawahara, 2002)
 * Includes DC offset removal, Cumulative Mean Normalized Difference Function (CMNDF),
 * octave-error protection, and sub-sample parabolic interpolation.
 */

export function detectPitchYIN(buffer, sampleRate, options = {}) {
  const {
    minFreq = 38,
    maxFreq = 1200,
    threshold = 0.15,
    rmsThreshold = 0.006,
  } = options;

  if (
    !buffer ||
    typeof buffer.length !== 'number' ||
    buffer.length < 128 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    !Number.isFinite(minFreq) ||
    !Number.isFinite(maxFreq) ||
    minFreq <= 0 ||
    maxFreq <= minFreq
  ) {
    return { frequency: -1, clarity: 0, rms: 0 };
  }

  const size = buffer.length;

  // 1. Remove DC offset and compute RMS energy
  let mean = 0;
  for (let i = 0; i < size; i++) {
    const val = buffer[i];
    if (!Number.isFinite(val)) {
      return { frequency: -1, clarity: 0, rms: 0 };
    }
    mean += val;
  }
  mean /= size;

  const centered = new Float32Array(size);
  let sumSq = 0;
  for (let i = 0; i < size; i++) {
    const v = buffer[i] - mean;
    centered[i] = v;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / size);

  if (rms < rmsThreshold) {
    return { frequency: -1, clarity: 0, rms };
  }

  // 2. Determine search lag bounds
  const halfSize = Math.floor(size / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(halfSize - 2, Math.ceil(sampleRate / minFreq));

  if (tauMax <= tauMin + 2) {
    return { frequency: -1, clarity: 0, rms };
  }

  // 3. Squared difference function d(tau)
  const diff = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let j = 0; j < halfSize; j++) {
      const delta = centered[j] - centered[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 4. Cumulative mean normalized difference function (CMNDF)
  const cmndf = new Float32Array(tauMax + 2);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  // 5. Absolute threshold search: first valley below threshold
  let bestTau = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 <= tauMax && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  // Fallback to global minimum if periodic enough (< 0.28)
  if (bestTau === -1) {
    let minVal = Infinity;
    let minTau = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cmndf[tau] < minVal) {
        minVal = cmndf[tau];
        minTau = tau;
      }
    }
    if (minTau !== -1 && minVal < 0.28) {
      bestTau = minTau;
    } else {
      return {
        frequency: -1,
        clarity: minTau !== -1 ? Math.max(0, 1 - minVal) : 0,
        rms,
      };
    }
  }

  // 6. Octave-error protection:
  // If a harmonic (e.g. 2nd harmonic) dominates over a weak fundamental,
  // bestTau may land at T/2 (where cmndf is moderately low, e.g. 0.05..0.18).
  // If cmndf[bestTau] <= 0.04, >96% of signal energy is already periodic at bestTau.
  const doubleCenter = bestTau * 2;
  if (cmndf[bestTau] > 0.04 && doubleCenter <= tauMax - 2) {
    const searchStart = Math.max(tauMin, Math.floor(doubleCenter * 0.94));
    const searchEnd = Math.min(tauMax, Math.ceil(doubleCenter * 1.06));
    let subMinVal = Infinity;
    let subMinTau = -1;
    for (let t = searchStart; t <= searchEnd; t++) {
      if (cmndf[t] < subMinVal) {
        subMinVal = cmndf[t];
        subMinTau = t;
      }
    }
    if (subMinTau !== -1 && subMinVal < cmndf[bestTau] * 0.45 && subMinVal < 0.08) {
      bestTau = subMinTau;
    }
  }

  // 7. Parabolic interpolation around bestTau for sub-sample precision
  const s0 = cmndf[bestTau - 1];
  const s1 = cmndf[bestTau];
  const s2 = cmndf[bestTau + 1];
  const denom = 2 * (s0 - 2 * s1 + s2);

  let betterTau = bestTau;
  if (Math.abs(denom) > 1e-12) {
    const shift = (s0 - s2) / denom;
    if (Number.isFinite(shift)) {
      betterTau = bestTau + Math.max(-0.5, Math.min(0.5, shift));
    }
  }

  const frequency = sampleRate / betterTau;
  if (!Number.isFinite(frequency) || frequency < minFreq || frequency > maxFreq) {
    return { frequency: -1, clarity: 0, rms };
  }

  const clarity = Math.max(0, Math.min(1, 1 - cmndf[bestTau]));
  return { frequency, clarity, rms };
}
