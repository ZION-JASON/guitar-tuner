export const MIN_BPM = 40;
export const MAX_BPM = 220;
export const DEFAULT_BPM = 90;

export const TIME_SIGNATURES = [
  { id: '4/4', label: '4/4', beats: 4 },
  { id: '3/4', label: '3/4', beats: 3 },
  { id: '2/4', label: '2/4', beats: 2 },
  { id: '6/8', label: '6/8', beats: 6 },
];

export function clampBpm(bpm) {
  const n = Number(bpm);
  if (!Number.isFinite(n)) return DEFAULT_BPM;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n)));
}

export function getTimeSignatureConfig(id = '4/4') {
  return TIME_SIGNATURES.find((ts) => ts.id === id) || TIME_SIGNATURES[0];
}

export function getBeatIntervalSec(bpm) {
  return 60 / clampBpm(bpm);
}

export function computeTapTempoBpm(tapsMs, maxGapMs = 2200) {
  if (!Array.isArray(tapsMs) || tapsMs.length < 2) return null;
  const recent = [];
  for (let i = tapsMs.length - 1; i >= 0; i--) {
    if (recent.length > 0 && recent[0] - tapsMs[i] > maxGapMs) {
      break;
    }
    recent.unshift(tapsMs[i]);
    if (recent.length >= 6) break;
  }
  if (recent.length < 2) return null;

  let sumIntervals = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff <= 0) return null;
    sumIntervals += diff;
  }
  const avgMs = sumIntervals / (recent.length - 1);
  if (avgMs <= 0) return null;
  return clampBpm(60000 / avgMs);
}
