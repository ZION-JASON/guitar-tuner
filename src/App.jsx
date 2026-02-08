import { useTuner } from './hooks/useTuner';
import TunerDisplay from './components/TunerDisplay';
import './App.css';

function App() {
  const { data, isListening, startTuner, refFrequency, setRefFrequency } = useTuner();

  return (
    <div className="App">
      <header className="tuner-header">
        <div className="status-group">
          <div className={`status-dot ${isListening ? 'active' : ''}`}></div>
          <span className="status-text">{isListening ? 'SYSTEM ACTIVE' : 'STANDBY'}</span>
        </div>
        
        <div className="ref-selector">
          {[432, 440, 442].map((f) => (
            <button 
              key={f}
              className={refFrequency === f ? 'active' : ''}
              onClick={() => setRefFrequency(f)}
            >
              {f}Hz
            </button>
          ))}
        </div>
      </header>

      <main className="tuner-main">
        {!isListening ? (
          <div className="welcome-container">
            <h1 className="glitch-text">PRO TUNER</h1>
            <button className="init-button" onClick={startTuner}>INITIALIZE</button>
          </div>
        ) : (
          <TunerDisplay 
            note={data.noteName} 
            cents={data.cents} 
            frequency={data.frequency} 
          />
        )}
      </main>

      {isListening && (
        <footer className="tuner-footer">
          <div className="readout-item">
            <small>STABILITY</small>
            <span className={data.frequency > 0 ? 'highlight' : ''}>
              {data.frequency > 0 ? 'LOCKED' : 'SEARCHING'}
            </span>
          </div>
          <div className="readout-item">
            <small>OFFSET</small>
            <span>{Math.round(data.cents)}%</span>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;