import { useTuner } from './hooks/useTuner';
import TunerDisplay from './components/TunerDisplay';

function App() {
  const { data, isListening, startTuner } = useTuner();

  return (
    <div className="App">
      <h1>Web Tuner</h1>
      {!isListening ? (
        <button onClick={startTuner}>Start Tuner</button>
      ) : (
        /* Explicitly passing props helps debug casing issues */
        <TunerDisplay 
          note={data.noteName} 
          cents={data.cents} 
          frequency={data.frequency} 
        />
      )}
    </div>
  );
}

export default App; // Ensure this export is at the bottom!