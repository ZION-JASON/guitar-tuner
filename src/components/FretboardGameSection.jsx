import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHROMATIC_NOTES, getFretboardMatrix } from '../utils/musicTheory';
import { getInstrumentMeta } from '../utils/frequencyUtils';
import { learnAudio } from '../utils/audioSynth';
import {
  BLITZ_DURATION_SEC,
  FRET_RANGES,
  GAME_MODES,
  NATURAL_NOTE_OPTIONS,
  NOTE_POOLS,
  QUIZ_ROUND_COUNT,
  buildFretboardQuestionPool,
  evaluateFretboardGuess,
  getFretRangeConfig,
  getOctaveAnchorCells,
  getStringFilterOptions,
  loadFretboardGameStats,
  pickNextFretboardQuestion,
  saveFretboardGameStats,
} from '../utils/fretboardGame';

const FRET_MARKERS = new Set([3, 5, 7, 9, 12, 15]);

const FretboardGameSection = ({ instrument = 'guitar', refFrequency = 440 }) => {
  const [gameMode, setGameMode] = useState('practice');
  const [fretRangeId, setFretRangeId] = useState('octave');
  const [notePool, setNotePool] = useState('natural');
  const [stringFilter, setStringFilter] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [peekNotes, setPeekNotes] = useState(false);

  const [target, setTarget] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [missedLog, setMissedLog] = useState([]);
  const [timeLeft, setTimeLeft] = useState(BLITZ_DURATION_SEC);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState(() => loadFretboardGameStats());
  const [newRecordBanner, setNewRecordBanner] = useState(false);

  const fretScrollRef = useRef(null);
  const blitzTimerRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);
  const questionStartRef = useRef(Date.now());
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const instMeta = getInstrumentMeta(instrument);
  const rangeConfig = useMemo(() => getFretRangeConfig(fretRangeId), [fretRangeId]);
  const stringOptions = useMemo(() => getStringFilterOptions(instrument), [instrument]);

  // Keep string filter valid when switching instrument (e.g., Guitar 6-string -> Bass 4-string)
  useEffect(() => {
    const valid = stringOptions.some((o) => o.id === stringFilter);
    if (!valid) {
      setStringFilter('all');
    }
  }, [stringOptions, stringFilter]);

  const fretboardData = useMemo(
    () => getFretboardMatrix(0, 'major', rangeConfig.maxFret, instrument),
    [rangeConfig.maxFret, instrument]
  );

  const questionPool = useMemo(
    () =>
      buildFretboardQuestionPool({
        instrument,
        fretRangeId,
        notePool,
        stringFilter,
      }),
    [instrument, fretRangeId, notePool, stringFilter]
  );

  const guessButtons = useMemo(
    () => (notePool === 'natural' ? NATURAL_NOTE_OPTIONS : CHROMATIC_NOTES),
    [notePool]
  );

  const octaveAnchorIds = useMemo(() => {
    if (!showHint || !target) return new Set();
    const anchors = getOctaveAnchorCells(questionPool, target);
    return new Set(anchors.map((a) => `${a.stringNum}:${a.fret}`));
  }, [showHint, target, questionPool]);

  const playTargetSound = useCallback(
    (cell) => {
      if (!cell || !soundEnabled) return;
      learnAudio.playPluckedNote(cell.midi, refFrequency, 0, null, 0.62, instrument);
    },
    [soundEnabled, refFrequency, instrument]
  );

  const startFreshSession = useCallback(
    (nextMode = gameMode, nextPool = questionPool) => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      if (blitzTimerRef.current) {
        clearInterval(blitzTimerRef.current);
        blitzTimerRef.current = null;
      }
      const firstQ = pickNextFretboardQuestion(nextPool, null);
      setTarget(firstQ);
      setAnswerResult(null);
      setQuestionNum(1);
      setScore(0);
      setAttempts(0);
      setStreak(0);
      setSessionBestStreak(0);
      setMissedLog([]);
      setShowHint(false);
      setSessionDone(false);
      setNewRecordBanner(false);
      setTimeLeft(BLITZ_DURATION_SEC);
      if (nextMode !== 'practice') {
        setPeekNotes(false);
      }
      questionStartRef.current = Date.now();
    },
    [gameMode, questionPool]
  );

  // Re-initialize round cleanly whenever core config changes
  useEffect(() => {
    startFreshSession(gameMode, questionPool);
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      if (blitzTimerRef.current) clearInterval(blitzTimerRef.current);
    };
  }, [gameMode, questionPool, startFreshSession]);

  // Countdown timer for 60s Blitz mode (starts immediately when in Blitz & not finished)
  useEffect(() => {
    if (gameMode !== 'blitz60' || sessionDone) return undefined;

    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    blitzTimerRef.current = id;

    return () => {
      clearInterval(id);
      if (blitzTimerRef.current === id) blitzTimerRef.current = null;
    };
  }, [gameMode, sessionDone]);

  // Finalize Blitz session when clock reaches 0
  useEffect(() => {
    if (gameMode !== 'blitz60' || timeLeft > 0 || sessionDone) return;
    setSessionDone(true);
    const prevStats = statsRef.current;
    const isRecord = score > prevStats.bestBlitzScore && score > 0;
    const updated = saveFretboardGameStats({
      ...prevStats,
      bestBlitzScore: Math.max(prevStats.bestBlitzScore, score),
      bestStreak: Math.max(prevStats.bestStreak, sessionBestStreak),
      totalCorrect: prevStats.totalCorrect + score,
      totalAttempts: prevStats.totalAttempts + attempts,
    });
    setStats(updated);
    setNewRecordBanner(isRecord);
  }, [gameMode, timeLeft, sessionDone, score, attempts, sessionBestStreak]);

  // Auto-scroll target fret horizontally into center view on narrow screens
  useEffect(() => {
    if (!target || !fretScrollRef.current) return;
    const container = fretScrollRef.current;
    if (container.scrollWidth <= container.clientWidth) return;
    const totalCols = rangeConfig.maxFret + 1;
    const approxCellW = container.scrollWidth / totalCols;
    const targetLeft = Math.max(
      0,
      Math.round(target.fret * approxCellW - container.clientWidth * 0.45)
    );
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [target, rangeConfig.maxFret]);

  const advanceQuestion = useCallback(
    (currentTarget = target) => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      if (sessionDone) return;

      if (gameMode === 'quiz10' && questionNum >= QUIZ_ROUND_COUNT) {
        setSessionDone(true);
        return;
      }

      const nextQ = pickNextFretboardQuestion(questionPool, currentTarget);
      setTarget(nextQ);
      setAnswerResult(null);
      setShowHint(false);
      setQuestionNum((prev) => prev + 1);
      questionStartRef.current = Date.now();
      playTargetSound(nextQ);
    },
    [target, sessionDone, gameMode, questionNum, questionPool, playTargetSound]
  );

  const handleGuess = useCallback(
    (guessedPc) => {
      if (!target || sessionDone || answerResult) return;

      const elapsed = Date.now() - questionStartRef.current;
      const evaluation = evaluateFretboardGuess(target, guessedPc, elapsed);
      setAnswerResult(evaluation);
      playTargetSound(target);

      const nextAttempts = attempts + 1;
      const nextScore = evaluation.isCorrect ? score + 1 : score;
      const nextStreak = evaluation.isCorrect ? streak + 1 : 0;
      const nextBestStreak = Math.max(sessionBestStreak, nextStreak);

      setAttempts(nextAttempts);
      setScore(nextScore);
      setStreak(nextStreak);
      setSessionBestStreak(nextBestStreak);

      if (!evaluation.isCorrect) {
        setMissedLog((prev) => [
          ...prev,
          {
            id: `${questionNum}-${target.id}`,
            stringLabel: target.stringLabel,
            fret: target.fret,
            midi: target.midi,
            correctLabel: target.dualLabel,
            guessedLabel: evaluation.guessedLabel,
          },
        ]);
      }

      // Check Quiz10 completion or update lifetime Practice stats
      if (gameMode === 'quiz10' && questionNum >= QUIZ_ROUND_COUNT) {
        const prevStats = statsRef.current;
        const isRecord = nextScore > prevStats.bestQuizScore && nextScore > 0;
        const updated = saveFretboardGameStats({
          ...prevStats,
          bestQuizScore: Math.max(prevStats.bestQuizScore, nextScore),
          bestStreak: Math.max(prevStats.bestStreak, nextBestStreak),
          totalCorrect: prevStats.totalCorrect + nextScore,
          totalAttempts: prevStats.totalAttempts + nextAttempts,
        });
        setStats(updated);
        setNewRecordBanner(isRecord);
        autoAdvanceTimerRef.current = setTimeout(() => {
          setSessionDone(true);
        }, 700);
      } else if (gameMode === 'practice') {
        const prevStats = statsRef.current;
        const updated = saveFretboardGameStats({
          ...prevStats,
          bestStreak: Math.max(prevStats.bestStreak, nextBestStreak),
          totalCorrect: prevStats.totalCorrect + (evaluation.isCorrect ? 1 : 0),
          totalAttempts: prevStats.totalAttempts + 1,
        });
        setStats(updated);
      } else if (gameMode === 'blitz60') {
        autoAdvanceTimerRef.current = setTimeout(() => {
          advanceQuestion(target);
        }, evaluation.isCorrect ? 380 : 720);
      }
    },
    [
      target,
      sessionDone,
      answerResult,
      playTargetSound,
      attempts,
      score,
      streak,
      sessionBestStreak,
      questionNum,
      gameMode,
      advanceQuestion,
    ]
  );

  // Desktop keyboard shortcuts (A-G to guess natural note, Space to hear, Enter to advance)
  useEffect(() => {
    const KEY_TO_PC = {
      c: 0,
      d: 2,
      e: 4,
      f: 5,
      g: 7,
      a: 9,
      b: 11,
    };

    const onKeyDown = (e) => {
      if (
        e.target &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'SELECT' ||
          e.target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.key === 'Enter' && answerResult && !sessionDone) {
        e.preventDefault();
        advanceQuestion(target);
        return;
      }

      if (e.key === ' ' && target && !sessionDone) {
        e.preventDefault();
        learnAudio.playPluckedNote(target.midi, refFrequency, 0, null, 0.62, instrument);
        return;
      }

      const lower = e.key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(KEY_TO_PC, lower) && !answerResult && !sessionDone) {
        let pc = KEY_TO_PC[lower];
        if (e.shiftKey && notePool === 'chromatic') {
          pc = (pc + 1) % 12;
        }
        if (notePool === 'natural' && ![0, 2, 4, 5, 7, 9, 11].includes(pc)) return;
        e.preventDefault();
        handleGuess(pc);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answerResult, sessionDone, target, refFrequency, instrument, notePool, advanceQuestion, handleGuess]);

  const accuracyPct = attempts > 0 ? Math.round((score / attempts) * 100) : 100;

  return (
    <section
      aria-label="Fretboard Note Learning Game"
      className="flex flex-col gap-4"
    >
      {/* Controls & Mode Setup Panel */}
      <div className="glass-panel rounded-[4px] p-3.5 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg sm:text-xl text-white">
              {instMeta.label} Fretboard Note Trainer
            </h2>
            <p className="mt-0.5 font-sans text-xs sm:text-sm text-slate-300">
              Identify the highlighted fret on the neck. Use open-string landmarks, 5th/7th-fret anchors, and the 12th-fret octave to master every note.
            </p>
          </div>

          <div
            role="group"
            aria-label="Fretboard Game Mode"
            className="grid grid-cols-3 sm:inline-flex items-center gap-1 glass-recessed rounded-[3px] p-1 shrink-0 w-full lg:w-auto"
          >
            {GAME_MODES.map((m) => {
              const active = gameMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGameMode(m.id)}
                  className={`min-h-[38px] px-1.5 sm:px-3 py-1.5 rounded-[2px] font-mono text-[11px] sm:text-xs font-semibold whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors ${
                    active
                      ? 'bg-cyan-400 text-slate-950 shadow-[0_2px_10px_rgba(34,211,238,0.28)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {m.id === 'quiz10' ? (
                    <>
                      <span className="sm:hidden">10-Quiz</span>
                      <span className="hidden sm:inline">{m.label}</span>
                    </>
                  ) : (
                    m.label
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Row: Fret Range, Note Pool, String Focus, Helpers */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 pt-2.5 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap sm:items-center gap-1.5 w-full xl:w-auto">
            {/* Fret Range */}
            <div
              role="group"
              aria-label="Fret Range"
              className="grid grid-cols-3 sm:inline-flex items-center gap-1 glass-recessed rounded-[3px] p-1 w-full sm:w-auto shrink-0"
            >
              {FRET_RANGES.map((r) => {
                const active = fretRangeId === r.id;
                const compactLabel =
                  r.id === 'beginner'
                    ? '0–5 Open'
                    : r.id === 'octave'
                      ? '0–12 Oct'
                      : '0–15 Neck';
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFretRangeId(r.id)}
                    className={`min-h-[34px] px-1.5 sm:px-2 py-1 rounded-[2px] font-mono text-[10px] sm:text-[11px] font-semibold whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {compactLabel}
                  </button>
                );
              })}
            </div>

            {/* Natural vs All 12 Chromatic Notes */}
            <div
              role="group"
              aria-label="Note Pool Difficulty"
              className="grid grid-cols-2 sm:inline-flex items-center gap-1 glass-recessed rounded-[3px] p-1 w-full sm:w-auto shrink-0"
            >
              {NOTE_POOLS.map((np) => {
                const active = notePool === np.id;
                const compactLabel = np.id === 'natural' ? 'Natural C–B' : 'All 12';
                return (
                  <button
                    key={np.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setNotePool(np.id)}
                    className={`min-h-[34px] px-1.5 sm:px-2 py-1 rounded-[2px] font-mono text-[10px] sm:text-[11px] font-semibold whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {compactLabel}
                  </button>
                );
              })}
            </div>

            {/* String Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <label
                htmlFor="fretgame-string-select"
                className="font-mono text-[11px] text-slate-400 whitespace-nowrap shrink-0"
              >
                Strings:
              </label>
              <div className="relative flex-1 sm:flex-initial">
                <select
                  id="fretgame-string-select"
                  value={stringFilter}
                  onChange={(e) => setStringFilter(e.target.value)}
                  className="appearance-none w-full min-h-[36px] pl-2 pr-6 py-1 rounded-[2px] border border-white/18 bg-slate-950/90 text-white font-mono text-[11px] font-semibold cursor-pointer focus:border-cyan-300 focus:outline-none"
                >
                  {stringOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  data-smooth-svg="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="square"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              aria-pressed={soundEnabled}
              className={`min-h-[36px] px-2.5 py-1 rounded-[2px] border font-mono text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                soundEnabled
                  ? 'bg-cyan-400/18 text-cyan-200 border-cyan-300/45'
                  : 'bg-white/[0.04] text-slate-400 border-white/14'
              }`}
            >
              Sound: {soundEnabled ? 'On' : 'Off'}
            </button>

            <button
              type="button"
              onClick={() => setShowHint((prev) => !prev)}
              aria-pressed={showHint}
              disabled={sessionDone || Boolean(answerResult)}
              className={`min-h-[36px] px-2.5 py-1 rounded-[2px] border font-mono text-[11px] font-semibold whitespace-nowrap disabled:opacity-40 cursor-pointer transition-colors ${
                showHint
                  ? 'bg-amber-400/20 text-amber-200 border-amber-300/50'
                  : 'bg-white/[0.05] text-slate-300 border-white/15 hover:bg-white/[0.1]'
              }`}
            >
              {showHint ? 'Hide Octaves' : 'Hint (Octaves)'}
            </button>

            {gameMode === 'practice' && (
              <button
                type="button"
                onClick={() => setPeekNotes((prev) => !prev)}
                aria-pressed={peekNotes}
                className={`min-h-[36px] px-2.5 py-1 rounded-[2px] border font-mono text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  peekNotes
                    ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/45'
                    : 'bg-white/[0.05] text-slate-300 border-white/15 hover:bg-white/[0.1]'
                }`}
              >
                {peekNotes ? 'Hide Labels' : 'Study Neck'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live HUD Strip */}
      <div className="glass-panel rounded-[4px] px-3.5 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 border border-white/12">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs tabular-nums">
          <div>
            <span className="text-slate-400">Score </span>
            <span className="text-white font-bold text-sm">
              {gameMode === 'quiz10' ? `${score} / ${QUIZ_ROUND_COUNT}` : score}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Streak </span>
            <span className="text-emerald-300 font-bold text-sm">{streak}</span>
            <span className="text-slate-400 text-[11px]"> (Best {Math.max(stats.bestStreak, sessionBestStreak)})</span>
          </div>
          <div>
            <span className="text-slate-400">Acc </span>
            <span className="text-cyan-300 font-bold text-sm">{accuracyPct}%</span>
          </div>
          {gameMode === 'blitz60' && (
            <div>
              <span className="text-slate-400">Time </span>
              <span
                className={`font-bold text-sm ${
                  timeLeft <= 10 ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                {timeLeft}s
              </span>
            </div>
          )}
          {gameMode === 'quiz10' && !sessionDone && (
            <div>
              <span className="text-slate-400">Round </span>
              <span className="text-cyan-200 font-bold text-sm">
                {Math.min(QUIZ_ROUND_COUNT, questionNum)} / {QUIZ_ROUND_COUNT}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {target && !sessionDone && (
            <button
              type="button"
              onClick={() =>
                learnAudio.playPluckedNote(target.midi, refFrequency, 0, null, 0.65, instrument)
              }
              className="min-h-[36px] px-3 py-1 rounded-[2px] border border-cyan-300/40 bg-cyan-400/12 hover:bg-cyan-400/22 text-cyan-200 font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
            >
              Hear Note
            </button>
          )}
          <button
            type="button"
            onClick={() => startFreshSession(gameMode, questionPool)}
            className="min-h-[36px] px-3 py-1 rounded-[2px] border border-white/16 bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 font-mono text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
          >
            {sessionDone ? 'Play Again' : 'New Round'}
          </button>
        </div>
      </div>

      {/* End-of-Round Summary Screen (Quiz10 or Blitz60 Finished) */}
      {sessionDone ? (
        <div className="glass-panel rounded-[4px] p-5 sm:p-6 border border-cyan-300/40 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-xl sm:text-2xl text-white">
                {gameMode === 'blitz60' ? '60s Blitz Complete' : '10-Round Quiz Complete'}
              </h3>
              <p className="mt-0.5 font-mono text-xs text-cyan-300">
                {newRecordBanner
                  ? 'New Personal Best! Your fretboard recall speed just leveled up.'
                  : `${instMeta.label} · ${rangeConfig.label} · ${
                      notePool === 'natural' ? 'Natural Notes' : 'All 12 Notes'
                    }`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => startFreshSession(gameMode, questionPool)}
              className="min-h-[44px] px-5 py-2 rounded-[2px] border border-cyan-300 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
            >
              Play Again
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
            <div className="glass-recessed rounded-[3px] p-3 border border-white/10">
              <div className="text-[11px] text-slate-400">Final Score</div>
              <div className="mt-0.5 text-xl font-bold text-white tabular-nums">
                {gameMode === 'quiz10' ? `${score} / ${QUIZ_ROUND_COUNT}` : score}
              </div>
            </div>
            <div className="glass-recessed rounded-[3px] p-3 border border-white/10">
              <div className="text-[11px] text-slate-400">Accuracy</div>
              <div className="mt-0.5 text-xl font-bold text-cyan-300 tabular-nums">
                {accuracyPct}%
              </div>
            </div>
            <div className="glass-recessed rounded-[3px] p-3 border border-white/10">
              <div className="text-[11px] text-slate-400">Round Streak</div>
              <div className="mt-0.5 text-xl font-bold text-emerald-300 tabular-nums">
                {sessionBestStreak}
              </div>
            </div>
            <div className="glass-recessed rounded-[3px] p-3 border border-white/10">
              <div className="text-[11px] text-slate-400">Best Saved</div>
              <div className="mt-0.5 text-xl font-bold text-amber-300 tabular-nums">
                {gameMode === 'blitz60' ? stats.bestBlitzScore : `${stats.bestQuizScore} / 10`}
              </div>
            </div>
          </div>

          {missedLog.length > 0 ? (
            <div className="glass-recessed rounded-[3px] p-3.5 border border-white/10 flex flex-col gap-2">
              <div className="font-display font-semibold text-sm text-white">
                Notes to Review ({missedLog.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {missedLog.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      learnAudio.playPluckedNote(m.midi, refFrequency, 0, null, 0.62, instrument)
                    }
                    className="rounded-[2px] border border-white/12 bg-white/[0.04] hover:bg-white/[0.1] px-3 py-2 flex items-center justify-between gap-2 text-left font-mono text-xs cursor-pointer transition-colors"
                  >
                    <span className="text-slate-200">
                      {m.stringLabel} Fret {m.fret}
                    </span>
                    <span className="text-rose-300 line-through text-[11px]">
                      {m.guessedLabel}
                    </span>
                    <span className="text-emerald-300 font-bold">
                      {m.correctLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-recessed rounded-[3px] p-3.5 border border-emerald-300/35 font-mono text-xs text-emerald-200">
              Clean sweep — zero missed notes this round!
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Interactive Fretboard Stage */}
          <div className="glass-panel rounded-[4px] p-3 sm:p-4 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-xs text-slate-300">
                {target ? (
                  <>
                    Target Highlighted:{' '}
                    <span className="text-amber-300 font-bold">
                      String {target.stringLabel} · {target.fret === 0 ? 'Open (Fret 0)' : `Fret ${target.fret}`}
                    </span>
                  </>
                ) : (
                  'Loading neck...'
                )}
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {rangeConfig.maxFret > 5 ? 'Scroll neck horizontally if needed' : 'Open position fits whole view'}
              </span>
            </div>

            <div
              ref={fretScrollRef}
              className="overflow-x-auto pb-1.5"
              role="region"
              aria-label="Interactive Fretboard Game Neck"
            >
              <div
                className="select-none"
                style={{
                  minWidth:
                    rangeConfig.maxFret <= 5
                      ? '100%'
                      : rangeConfig.maxFret <= 12
                        ? '760px'
                        : '920px',
                }}
              >
                {/* Fret Header Row */}
                <div
                  className="grid gap-1 mb-2"
                  style={{
                    gridTemplateColumns: `52px repeat(${rangeConfig.maxFret + 1}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="font-mono text-[11px] text-slate-400 flex items-center justify-center">
                    Str
                  </div>
                  {Array.from({ length: rangeConfig.maxFret + 1 }).map((_, fret) => {
                    const isTargetFret = target && target.fret === fret;
                    return (
                      <div
                        key={`fg-hdr-${fret}`}
                        className={`text-center font-mono text-[11px] py-1 rounded-[2px] ${
                          isTargetFret
                            ? 'text-amber-200 font-bold bg-amber-400/20 border border-amber-300/45'
                            : FRET_MARKERS.has(fret)
                              ? 'text-cyan-300 font-semibold'
                              : 'text-slate-400'
                        }`}
                      >
                        {fret === 0 ? 'Open' : fret}
                      </div>
                    );
                  })}
                </div>

                {/* String Rows */}
                <div className="flex flex-col gap-1.5 rounded-[3px] bg-slate-950/75 border border-white/12 p-2.5">
                  {fretboardData.rows.map((row) => {
                    const wireThickness = Math.max(1.6, 1.5 + (row.stringNum - 1) * 0.55);
                    const isTargetString = target && target.stringNum === row.stringNum;
                    return (
                      <div
                        key={`fg-row-${row.stringNum}`}
                        className="grid items-center gap-1"
                        style={{
                          gridTemplateColumns: `52px repeat(${rangeConfig.maxFret + 1}, minmax(0, 1fr))`,
                        }}
                      >
                        <div
                          className={`font-mono text-xs font-semibold text-center py-1 rounded-[2px] ${
                            isTargetString
                              ? 'text-amber-200 bg-amber-400/15'
                              : 'text-slate-300'
                          }`}
                        >
                          {row.label}
                        </div>

                        {row.cells.map((cell) => {
                          const isTargetCell =
                            target &&
                            target.stringNum === row.stringNum &&
                            target.fret === cell.fret;
                          const isOctaveHint = octaveAnchorIds.has(`${row.stringNum}:${cell.fret}`);
                          const showNoteLabel =
                            isTargetCell && answerResult
                              ? target.sharpName
                              : peekNotes && (notePool === 'chromatic' || [0, 2, 4, 5, 7, 9, 11].includes(cell.pc))
                                ? cell.noteName
                                : null;

                          let markerStyle = '';
                          let markerText = '';

                          if (isTargetCell) {
                            if (answerResult) {
                              markerStyle = answerResult.isCorrect
                                ? 'bg-emerald-400 text-slate-950 border-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.75)]'
                                : 'bg-rose-400 text-slate-950 border-rose-200 shadow-[0_0_16px_rgba(251,113,133,0.75)]';
                              markerText = target.sharpName;
                            } else {
                              markerStyle =
                                'bg-amber-300 text-slate-950 border-white shadow-[0_0_18px_rgba(252,211,77,0.8)] animate-pulse';
                              markerText = '?';
                            }
                          } else if (isOctaveHint) {
                            markerStyle =
                              'bg-cyan-400/25 text-cyan-200 border-cyan-300/75';
                            markerText = '★';
                          } else if (showNoteLabel) {
                            markerStyle =
                              'bg-white/[0.1] text-slate-200 border-white/25';
                            markerText = showNoteLabel;
                          }

                          return (
                            <button
                              key={`fg-c-${row.stringNum}-${cell.fret}`}
                              type="button"
                              onClick={() => {
                                if (gameMode === 'practice' || answerResult) {
                                  learnAudio.playPluckedNote(
                                    cell.midi,
                                    refFrequency,
                                    0,
                                    null,
                                    0.56,
                                    instrument
                                  );
                                }
                              }}
                              aria-label={`String ${row.label} fret ${cell.fret}${
                                isTargetCell
                                  ? answerResult
                                    ? ` — note is ${target.dualLabel}`
                                    : ' — target note to guess'
                                  : ''
                              }`}
                              className={`relative h-9 flex items-center justify-center rounded-[2px] transition-colors ${
                                cell.fret === 0
                                  ? 'border-r-[3px] border-r-slate-200/80 bg-white/[0.04]'
                                  : 'border-r border-r-white/15 hover:bg-white/[0.05]'
                              } ${isTargetCell ? 'bg-amber-400/12' : ''}`}
                            >
                              <span
                                aria-hidden="true"
                                className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-gradient-to-b from-slate-300/50 to-slate-500/40 pointer-events-none"
                                style={{ height: `${wireThickness}px` }}
                              />
                              {markerText && (
                                <span
                                  className={`relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-[3px] border-2 font-mono text-xs font-extrabold flex items-center justify-center ${markerStyle}`}
                                >
                                  {markerText}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Fretboard Inlay Dots Footer */}
                <div
                  className="grid gap-1 mt-1.5"
                  style={{
                    gridTemplateColumns: `52px repeat(${rangeConfig.maxFret + 1}, minmax(0, 1fr))`,
                  }}
                >
                  <div />
                  {Array.from({ length: rangeConfig.maxFret + 1 }).map((_, fret) => (
                    <div
                      key={`fg-dot-${fret}`}
                      className="flex items-center justify-center gap-1 h-3"
                    >
                      {FRET_MARKERS.has(fret) && (
                        <>
                          <span className="w-2 h-2 rounded-[1px] bg-slate-500/75" />
                          {fret === 12 && (
                            <span className="w-2 h-2 rounded-[1px] bg-slate-500/75" />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Note Guess Pad */}
          <div className="glass-panel rounded-[4px] p-3.5 sm:p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-display font-bold text-base text-white">
                Which note is highlighted?
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {notePool === 'natural'
                  ? 'Tap a natural note (or press A–G on keyboard)'
                  : 'Tap any chromatic note (A–G or Shift+Letter for sharp)'}
              </span>
            </div>

            <div
              role="group"
              aria-label="Note Guess Choices"
              className={
                notePool === 'natural'
                  ? 'grid grid-cols-4 sm:grid-cols-7 gap-2'
                  : 'grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2'
              }
            >
              {guessButtons.map((note) => {
                const isAnswer = answerResult && answerResult.targetPc === note.index;
                const isChosenWrong =
                  answerResult &&
                  !answerResult.isCorrect &&
                  answerResult.guessedPc === note.index;

                let btnClass =
                  'bg-white/[0.06] hover:bg-cyan-400/20 border-white/16 hover:border-cyan-300/60 text-white';
                if (isAnswer) {
                  btnClass =
                    'bg-emerald-400 border-emerald-200 text-slate-950 shadow-[0_0_14px_rgba(52,211,153,0.45)]';
                } else if (isChosenWrong) {
                  btnClass =
                    'bg-rose-500/30 border-rose-300 text-rose-100';
                } else if (answerResult) {
                  btnClass =
                    'bg-white/[0.03] border-white/10 text-slate-500';
                }

                return (
                  <button
                    key={`guess-${note.index}`}
                    type="button"
                    disabled={Boolean(answerResult)}
                    onClick={() => handleGuess(note.index)}
                    className={`min-h-[48px] px-2 py-2 rounded-[2px] border font-mono text-sm font-bold whitespace-nowrap active:scale-[0.97] disabled:cursor-default cursor-pointer transition-colors ${btnClass}`}
                  >
                    {note.label}
                  </button>
                );
              })}
            </div>

            {/* Feedback & Landmark Tip Banner */}
            <div
              aria-live="polite"
              className={`rounded-[3px] p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                answerResult
                  ? answerResult.isCorrect
                    ? 'bg-emerald-400/12 border-emerald-300/45'
                    : 'bg-rose-500/12 border-rose-300/45'
                  : 'glass-recessed border-white/10'
              }`}
            >
              {answerResult ? (
                <>
                  <div className="flex flex-col gap-0.5">
                    <div
                      className={`font-display font-bold text-sm sm:text-base ${
                        answerResult.isCorrect ? 'text-emerald-200' : 'text-rose-200'
                      }`}
                    >
                      {answerResult.feedbackTitle}
                    </div>
                    <p className="font-sans text-xs text-slate-300">
                      {answerResult.landmarkTip}
                    </p>
                  </div>

                  {gameMode !== 'blitz60' && (
                    <button
                      type="button"
                      onClick={() => advanceQuestion(target)}
                      className="min-h-[42px] px-4 py-1.5 rounded-[2px] border border-cyan-300 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      {gameMode === 'quiz10' && questionNum >= QUIZ_ROUND_COUNT
                        ? 'See Final Score →'
                        : 'Next Note →'}
                    </button>
                  )}
                </>
              ) : (
                <p className="font-mono text-xs text-slate-300">
                  {showHint
                    ? 'Cyan ★ stars show the same note elsewhere on the neck — trace the octave shape!'
                    : target
                      ? `Find the note on ${target.stringLabel}, ${
                          target.fret === 0 ? 'Open String' : `Fret ${target.fret}`
                        }.`
                      : 'Ready to play.'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default FretboardGameSection;
