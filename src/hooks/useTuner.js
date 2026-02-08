import { useState, useRef, useCallback } from 'react';
import { getNoteFromFrequency } from '../utils/frequencyUtils';

export const useTuner = () => {
  const [refFrequency, setRefFrequency] = useState(440);
  const [data, setData] = useState({ noteName: '-', cents: 0, frequency: 0 });
  const [isListening, setIsListening] = useState(false);
  
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const requestRef = useRef(null);
  const smoothingBuffer = useRef([]);

  const update = useCallback(() => {
    if (!analyser.current) return;

    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);

    const freq = autoCorrelate(buffer, audioContext.current.sampleRate);

    // FILTER: Guitar range + Noise Gate
    if (freq > 40 && freq < 1200) { 
      smoothingBuffer.current.push(freq);
      if (smoothingBuffer.current.length > 5) smoothingBuffer.current.shift();
      
      const averageFreq = smoothingBuffer.current.reduce((a, b) => a + b) / smoothingBuffer.current.length;
      const noteInfo = getNoteFromFrequency(averageFreq, refFrequency);
      
      setData({ ...noteInfo, frequency: averageFreq });
    } else {
      // CLEAR BUFFER: If signal is lost, clear the average so it doesn't "drift"
      smoothingBuffer.current = [];
      setData(prev => ({ ...prev, frequency: 0, noteName: '-', cents: 0 }));
    }

    requestRef.current = requestAnimationFrame(update);
  }, [refFrequency]);

  const startTuner = async () => {
    try {
      if (audioContext.current) await audioContext.current.close();
      
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.current.createMediaStreamSource(stream);
      
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 2048;
      source.connect(analyser.current);
      
      setIsListening(true);
      requestRef.current = requestAnimationFrame(update);
    } catch (err) {
      console.error("Mic access denied", err);
      alert("Please allow microphone access to use the tuner.");
    }
  };

  return { data, isListening, startTuner, refFrequency, setRefFrequency };
};

// Autocorrelate function remains as you have it
function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);

  // Ignore silence
  if (rms < 0.05) return -1; 

  let r1 = 0, r2 = SIZE - 1, threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  const trimmedBuffer = buffer.slice(r1, r2);
  const newSize = trimmedBuffer.length;

  const c = new Array(newSize).fill(0);
  for (let i = 0; i < newSize; i++) {
    for (let j = 0; j < newSize - i; j++) {
      c[i] = c[i] + trimmedBuffer[j] * trimmedBuffer[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  return sampleRate / maxpos;
}