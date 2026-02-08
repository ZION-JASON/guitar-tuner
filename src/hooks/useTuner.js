import { useState, useRef } from 'react';
import { getNoteFromFrequency } from '../utils/frequencyUtils';

export const useTuner = () => {
  const [data, setData] = useState({ noteName: '-', cents: 0, frequency: 0 });
  const [isListening, setIsListening] = useState(false);
  
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const requestRef = useRef(null);

  const startTuner = async () => {
    try {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.current.createMediaStreamSource(stream);
      
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 2048;
      source.connect(analyser.current);
      
      setIsListening(true);
      update(); 
    } catch (err) {
      console.error("Microphone access denied or AudioContext failed:", err);
    }
  };

  const update = () => {
    if (!analyser.current) return;

    const bufferLength = analyser.current.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyser.current.getFloatTimeDomainData(buffer);

    const freq = autoCorrelate(buffer, audioContext.current.sampleRate);

    if (freq !== -1) {
      const noteInfo = getNoteFromFrequency(freq);
      setData({ ...noteInfo, frequency: freq });
    }

    requestRef.current = requestAnimationFrame(update);
  };

  return { data, isListening, startTuner };
};

/**
 * Autocorrelation algorithm to find the fundamental frequency
 */
function autoCorrelate(buffer, sampleRate) {
  // 1. Accuracy Check: Is the signal too quiet?
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; 

  // 2. Trimming: Focus on the "busy" part of the signal
  let r1 = 0, r2 = SIZE - 1, threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  const trimmedBuffer = buffer.slice(r1, r2);
  const newSize = trimmedBuffer.length;

  // 3. Autocorrelation: Slide the signal and compare
  const c = new Array(newSize).fill(0);
  for (let i = 0; i < newSize; i++) {
    for (let j = 0; j < newSize - i; j++) {
      c[i] = c[i] + trimmedBuffer[j] * trimmedBuffer[j + i];
    }
  }

  // 4. Find the first peak
  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  // 5. Convert lag to Frequency (Hz)
  return sampleRate / maxpos;
}