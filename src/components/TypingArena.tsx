import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Flame,
  Keyboard as KeyboardIcon,
  RotateCcw,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRivalPreset } from '../lib/ranks';
import { playKeySound } from '../lib/sound';
import type {
  GeneratedPassage,
  RivalDifficulty,
  TypingResult,
  TypingTimelinePoint,
} from '../types';

const TEST_DURATION_MS = 60_000;

interface TypingArenaProps {
  passage: GeneratedPassage;
  rivalDifficulty: RivalDifficulty;
  onComplete: (result: TypingResult) => void;
  onRegenerate: () => void;
  onBackToSetup: () => void;
  regenerating: boolean;
}

interface WordSubmission {
  typed: string;
  target: string;
  correct: boolean;
}

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
];

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.ceil(Math.max(0, remainingMs) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function TypingArena({
  passage,
  rivalDifficulty,
  onComplete,
  onRegenerate,
  onBackToSetup,
  regenerating,
}: TypingArenaProps) {
  const { user } = useAuth();
  const rivalPreset = useMemo(() => getRivalPreset(rivalDifficulty), [rivalDifficulty]);
  const baseWords = useMemo(
    () => passage.text.trim().split(/\s+/).filter(Boolean),
    [passage.text]
  );

  // Word list yang otomatis memanjang bila pengetik sangat cepat dalam 1 menit
  const [words, setWords] = useState<string[]>(baseWords);
  const [wordIndex, setWordIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [history, setHistory] = useState<WordSubmission[]>([]);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lastKeyFlash, setLastKeyFlash] = useState<{ key: string; ok: boolean } | null>(null);
  const [scrollY, setScrollY] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const finishedRef = useRef(false);
  const timelineRef = useRef<TypingTimelinePoint[]>([]);
  const lastRecordedSecRef = useRef(0);

  // Refs untuk baca state paling fresh ketika 60 detik berakhir
  const historyRef = useRef<WordSubmission[]>([]);
  const currentInputRef = useRef('');
  const wordsRef = useRef<string[]>(baseWords);
  const wordIndexRef = useRef(0);
  const maxComboRef = useRef(0);
  const soundRef = useRef(true);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    currentInputRef.current = currentInput;
  }, [currentInput]);
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);
  useEffect(() => {
    wordIndexRef.current = wordIndex;
  }, [wordIndex]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  const computeMetrics = useCallback(
    (subs: WordSubmission[], activeTyped: string, activeTarget: string) => {
      let correctChars = 0;
      let incorrectChars = 0;
      let correctWords = 0;
      let wrongWords = 0;

      for (const item of subs) {
        if (item.correct) {
          correctWords++;
          correctChars += item.target.length + 1; // +1 untuk spasi pemisah kata
        } else {
          wrongWords++;
          // Hitung karakter benar/salah sebenarnya untuk transparansi akurasi
          const maxLen = Math.max(item.typed.length, item.target.length);
          for (let i = 0; i < maxLen; i++) {
            if (item.typed[i] === item.target[i]) {
              // Tetap tidak dihitung ke Net WPM jika kata salah, namun masuk statistik
            }
            incorrectChars++;
          }
        }
      }

      // Evaluasi kata yang sedang diketik saat ini secara per-karakter
      let activeCorrect = 0;
      let activeIncorrect = 0;
      for (let i = 0; i < activeTyped.length; i++) {
        if (activeTyped[i] === activeTarget[i]) activeCorrect++;
        else activeIncorrect++;
      }

      const netCorrectChars = correctChars + activeCorrect;
      const totalIncorrectChars = incorrectChars + activeIncorrect;
      const totalTypedChars =
        subs.reduce((acc, s) => acc + s.typed.length + 1, 0) + activeTyped.length;
      const totalEvaluated = netCorrectChars + totalIncorrectChars;
      const accuracy =
        totalEvaluated > 0
          ? Number(Math.max(0, Math.min(100, (netCorrectChars / totalEvaluated) * 100)).toFixed(1))
          : 100;

      return {
        netCorrectChars,
        totalIncorrectChars,
        totalTypedChars,
        correctWords,
        wrongWords,
        accuracy,
      };
    },
    []
  );

  const finishTest = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const subs = historyRef.current;
    const curTyped = currentInputRef.current;
    const curTarget = wordsRef.current[wordIndexRef.current] || '';
    const m = computeMetrics(subs, curTyped, curTarget);

    const finalWpm = Number(Math.max(0, m.netCorrectChars / 5).toFixed(1));
    const finalRawWpm = Number(Math.max(0, m.totalTypedChars / 5).toFixed(1));

    let finalPlacement = 1;
    rivalPreset.bots.forEach((bot) => {
      if (bot.targetWpm > finalWpm) finalPlacement++;
    });

    const finalTimeline = [
      ...timelineRef.current,
      { sec: 60, wpm: Math.round(finalWpm) },
    ];

    if (soundRef.current) {
      playKeySound('complete');
    }

    onComplete({
      wpm: finalWpm,
      raw_wpm: finalRawWpm,
      accuracy: m.accuracy,
      total_chars: m.totalTypedChars,
      correct_chars: m.netCorrectChars,
      incorrect_chars: m.totalIncorrectChars,
      word_count: m.correctWords,
      duration_seconds: 60,
      max_combo: maxComboRef.current,
      placement: finalPlacement,
      total_racers: 1 + rivalPreset.bots.length,
      timeline: finalTimeline,
    });
  }, [computeMetrics, onComplete, rivalPreset.bots]);

  const resetArena = useCallback(() => {
    setWords(baseWords);
    wordsRef.current = baseWords;
    setWordIndex(0);
    wordIndexRef.current = 0;
    setCurrentInput('');
    currentInputRef.current = '';
    setHistory([]);
    historyRef.current = [];
    setStartedAt(null);
    setElapsedMs(0);
    setCombo(0);
    setMaxCombo(0);
    maxComboRef.current = 0;
    setLastKeyFlash(null);
    setScrollY(0);
    finishedRef.current = false;
    timelineRef.current = [];
    lastRecordedSecRef.current = 0;
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [baseWords]);

  useEffect(() => {
    resetArena();
  }, [baseWords, resetArena]);

  // Timer 60 detik
  useEffect(() => {
    if (!startedAt || finishedRef.current) return;

    const interval = window.setInterval(() => {
      const ms = Date.now() - startedAt;
      if (ms >= TEST_DURATION_MS) {
        setElapsedMs(TEST_DURATION_MS);
        window.clearInterval(interval);
        finishTest();
        return;
      }

      setElapsedMs(ms);

      const sec = Math.floor(ms / 1000);
      if (sec >= 1 && sec > lastRecordedSecRef.current) {
        lastRecordedSecRef.current = sec;
        const curTarget = wordsRef.current[wordIndexRef.current] || '';
        const m = computeMetrics(historyRef.current, currentInputRef.current, curTarget);
        const liveWpm = Math.round(m.netCorrectChars / 5 / (ms / 60000));
        timelineRef.current.push({ sec, wpm: liveWpm });
      }
    }, 80);

    return () => window.clearInterval(interval);
  }, [startedAt, finishTest, computeMetrics]);

  // Auto-scroll baris aktif agar selalu nyaman dibaca di tengah viewport
  useEffect(() => {
    const el = activeWordRef.current;
    if (!el) return;
    setScrollY(Math.max(0, el.offsetTop - 20));
  }, [wordIndex]);

  const activeTargetWord = words[wordIndex] || '';
  const isCurrentMismatch =
    currentInput.length > 0 && !activeTargetWord.startsWith(currentInput);

  const handleInputChange = (val: string) => {
    if (finishedRef.current) return;

    // Mulai timer pada ketikan pertama
    if (!startedAt && val.trim().length > 0) {
      setStartedAt(Date.now());
    }

    // Jika user menekan spasi -> verifikasi kata & lanjut ke kata berikutnya!
    if (val.endsWith(' ')) {
      const submitted = val.trim();
      if (submitted.length === 0) {
        setCurrentInput('');
        return;
      }

      const isWordExactMatch = submitted === activeTargetWord;
      const nextHistory = [
        ...history,
        { typed: submitted, target: activeTargetWord, correct: isWordExactMatch },
      ];
      setHistory(nextHistory);
      historyRef.current = nextHistory;

      if (isWordExactMatch) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        if (nextCombo > maxCombo) {
          setMaxCombo(nextCombo);
          maxComboRef.current = nextCombo;
        }
        if (soundEnabled) playKeySound('correct');
      } else {
        setCombo(0);
        if (soundEnabled) playKeySound('error');
      }

      const nextIdx = wordIndex + 1;
      setWordIndex(nextIdx);
      wordIndexRef.current = nextIdx;
      setCurrentInput('');
      currentInputRef.current = '';

      // Perpanjang stok kata otomatis bila hampir habis sebelum 60 detik selesai
      if (nextIdx >= words.length - 25) {
        const extended = [...words, ...baseWords];
        setWords(extended);
        wordsRef.current = extended;
      }
      return;
    }

    // Umpan balik suara & flash keyboard berdasarkan kecocokan huruf asli yang diketik
    if (val.length > currentInput.length) {
      const lastIdx = val.length - 1;
      const typedChar = val[lastIdx];
      const ok = typedChar === activeTargetWord[lastIdx];
      if (showKeyboard) {
        setLastKeyFlash({ key: typedChar.toLowerCase(), ok });
        window.setTimeout(() => setLastKeyFlash(null), 120);
      }
      if (soundEnabled) {
        playKeySound(ok ? 'correct' : 'error');
      }
    }

    // Simpan PERSIS karakter yang diketik user (tidak pernah diubah menjadi huruf teks target!)
    setCurrentInput(val);
    currentInputRef.current = val;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      resetArena();
    }
  };

  const stats = useMemo(() => {
    const m = computeMetrics(history, currentInput, activeTargetWord);
    const minutes = Math.max(elapsedMs, 500) / 60000;
    const netWpm = startedAt ? Math.max(0, Math.round(m.netCorrectChars / 5 / minutes)) : 0;

    const timePct = Math.min(100, (elapsedMs / TEST_DURATION_MS) * 100);
    const maxScaleWpm = Math.max(85, netWpm + 10, ...rivalPreset.bots.map((b) => b.targetWpm + 5));

    const racers = [
      {
        id: 'player',
        name: user?.username?.toUpperCase() || 'ANDA',
        color: '#ffb800',
        wpm: netWpm,
        barPct: startedAt ? Math.min(98, (netWpm / maxScaleWpm) * timePct * 1.15) : 0,
        isPlayer: true,
      },
      ...rivalPreset.bots.map((bot, idx) => {
        const wave = 1 + Math.sin(elapsedMs / (1800 + idx * 650)) * 0.04;
        const botWpm = startedAt ? Math.round(bot.targetWpm * wave) : bot.targetWpm;
        return {
          id: bot.id,
          name: bot.name,
          color: bot.color,
          wpm: botWpm,
          barPct: startedAt ? Math.min(98, (botWpm / maxScaleWpm) * timePct * 1.15) : 0,
          isPlayer: false,
        };
      }),
    ];

    const sorted = [...racers].sort((a, b) => b.wpm - a.wpm);
    const posMap = new Map<string, number>();
    sorted.forEach((r, idx) => posMap.set(r.id, idx + 1));

    return {
      netWpm,
      accuracy: m.accuracy,
      correctWords: m.correctWords,
      wrongWords: m.wrongWords,
      racers,
      posMap,
    };
  }, [history, currentInput, activeTargetWord, elapsedMs, startedAt, computeMetrics, rivalPreset, user]);

  const remainingMs = Math.max(0, TEST_DURATION_MS - elapsedMs);
  const isUrgent = startedAt !== null && remainingMs <= 10_000;
  const timeProgressPct = Math.min(100, (elapsedMs / TEST_DURATION_MS) * 100);
  const nextExpectedChar = (
    currentInput.length < activeTargetWord.length
      ? activeTargetWord[currentInput.length]
      : ' '
  ).toLowerCase();

  return (
    <div className="play-cockpit">
      {/* Compact Top Bar */}
      <div className="arena-strip">
        <div className="timer-hero">
          <Timer size={26} color={isUrgent ? '#ff3b5c' : '#ffb800'} />
          <div>
            <div className="metric-chip-label">SISA WAKTU</div>
            <div className={`timer-clock ${isUrgent ? 'urgent' : ''}`}>
              {formatCountdown(remainingMs)}
            </div>
          </div>
        </div>

        <div className="live-metrics-inline">
          <div className="metric-chip">
            <span className="metric-chip-label">KECEPATAN</span>
            <span className="metric-chip-val" style={{ color: 'var(--gold)' }}>
              {stats.netWpm} <span style={{ fontSize: '0.76rem' }}>WPM</span>
            </span>
          </div>
          <div className="metric-chip">
            <span className="metric-chip-label">AKURASI</span>
            <span className="metric-chip-val" style={{ color: 'var(--emerald)' }}>
              {stats.accuracy}%
            </span>
          </div>
          <div className="metric-chip">
            <span className="metric-chip-label">KATA BENAR / SALAH</span>
            <span className="metric-chip-val" style={{ fontSize: '1.15rem' }}>
              <span style={{ color: 'var(--emerald)' }}>{stats.correctWords}</span>
              <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
              <span style={{ color: 'var(--rose)' }}>{stats.wrongWords}</span>
            </span>
          </div>
          <div className="metric-chip">
            <span className="metric-chip-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Flame size={11} color={combo >= 10 ? '#ff2e88' : '#ffb800'} /> STREAK
            </span>
            <span className="metric-chip-val" style={{ color: combo >= 10 ? 'var(--magenta)' : 'var(--cyan)' }}>
              {combo}x
            </span>
          </div>
        </div>

        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => setSoundEnabled((s) => !s)}
            title={soundEnabled ? 'Matikan suara' : 'Aktifkan suara'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            className={`btn btn-icon ${showKeyboard ? 'btn-cyan' : 'btn-secondary'}`}
            onClick={() => setShowKeyboard((k) => !k)}
            title="Keyboard virtual"
          >
            <KeyboardIcon size={16} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetArena}>
            <RotateCcw size={14} />
            Ulangi
          </button>
          <button
            type="button"
            className="btn btn-cyan btn-sm"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? <span className="spinner" /> : <Sparkles size={14} />}
            Teks Baru
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBackToSetup}>
            <ArrowLeft size={14} />
            Ubah
          </button>
        </div>
      </div>

      {/* Slim Race Track */}
      {rivalPreset.bots.length > 0 && (
        <div className="slim-race-strip">
          {stats.racers.map((r) => {
            const pos = stats.posMap.get(r.id) || 1;
            const leftPct = Math.max(3, Math.min(97, r.barPct));
            return (
              <div key={r.id} className="slim-lane">
                <div className="racer-label" style={{ fontSize: '0.76rem' }}>
                  <span className={`racer-pos p${pos}`} style={{ width: 21, height: 21, fontSize: '0.68rem' }}>
                    #{pos}
                  </span>
                  <span style={{ color: r.isPlayer ? 'var(--gold)' : 'var(--text-secondary)' }}>
                    {r.name}
                  </span>
                </div>
                <div className="slim-track">
                  <div
                    className="slim-fill"
                    style={{
                      width: `${Math.max(2, r.barPct)}%`,
                      background: `linear-gradient(90deg, transparent, ${r.color}aa)`,
                    }}
                  />
                  <div
                    className="slim-dot"
                    style={{ left: `${leftPct}%`, background: r.color, boxShadow: `0 0 12px ${r.color}` }}
                  />
                </div>
                <div className="racer-wpm" style={{ fontSize: '0.75rem', color: r.color }}>
                  {r.wpm} WPM
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Target Words Viewport + Real Visible Input Box */}
      <div
        className={`focus-typing-box focused ${isCurrentMismatch ? 'flash-error' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="focus-viewport">
          <div className="focus-words" style={{ transform: `translateY(-${scrollY}px)` }}>
            {words.map((word, idx) => {
              const past = history[idx];
              const isActive = idx === wordIndex;

              if (past) {
                return (
                  <span
                    key={idx}
                    className={`f-word ${past.correct ? 'word-correct' : 'word-wrong'}`}
                    title={past.correct ? 'Benar' : `Anda ketik: "${past.typed}" (seharusnya "${past.target}")`}
                  >
                    {word}
                  </span>
                );
              }

              if (isActive) {
                const extraChars =
                  currentInput.length > word.length ? currentInput.slice(word.length) : '';
                return (
                  <span
                    key={idx}
                    ref={activeWordRef}
                    className={`f-word ${isCurrentMismatch ? 'active-word-wrong' : 'active-word'}`}
                  >
                    {word.split('').map((ch, cIdx) => {
                      let cls = 'f-char';
                      if (cIdx < currentInput.length) {
                        cls += currentInput[cIdx] === ch ? ' ok' : ' err';
                      }
                      return (
                        <span key={cIdx} className={cls}>
                          {ch}
                        </span>
                      );
                    })}
                    {extraChars && (
                      <span className="f-char extra-err">{extraChars}</span>
                    )}
                  </span>
                );
              }

              return (
                <span key={idx} className="f-word">
                  <span className="f-char">{word}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* REAL VISIBLE TYPING INPUT — Menampilkan huruf ASLI yang diketik user */}
        <div className={`live-type-deck ${isCurrentMismatch ? 'is-wrong' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            className="live-type-input"
            value={currentInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={startedAt ? `Ketik: ${activeTargetWord}` : `Ketik "${activeTargetWord}" lalu tekan Spasi...`}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Input ketikan kata saat ini"
          />

          {currentInput.length === 0 ? (
            <span className="live-match-pill idle">Target: {activeTargetWord}</span>
          ) : isCurrentMismatch ? (
            <span className="live-match-pill err">✗ Salah! Target: {activeTargetWord}</span>
          ) : currentInput === activeTargetWord ? (
            <span className="live-match-pill ok">✓ Cocok — Tekan Spasi</span>
          ) : (
            <span className="live-match-pill ok">✓ Sesuai</span>
          )}
        </div>

        {/* Time bar */}
        <div className="time-progress-bar">
          <div
            className={`time-progress-fill ${isUrgent ? 'urgent' : ''}`}
            style={{ width: `${100 - timeProgressPct}%` }}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 4px' }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="badge badge-amber">{passage.language.native_name}</span>
          <span className="badge badge-slate mono">{passage.model_used}</span>
          {passage.keywords.map((kw, i) => (
            <span key={i} className="kw-tag mono">
              #{kw}
            </span>
          ))}
        </div>
        <span>Tekan Spasi untuk lanjut kata berikutnya • Tab = mulai ulang 1 menit</span>
      </div>

      {/* Optional Virtual Keyboard */}
      {showKeyboard && (
        <div className="keyboard-stage" aria-hidden="true">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="kb-row">
              {row.map((k) => {
                const isNext = nextExpectedChar === k;
                const isHit = lastKeyFlash?.key === k && lastKeyFlash.ok;
                const isMiss = lastKeyFlash?.key === k && !lastKeyFlash.ok;
                return (
                  <div
                    key={k}
                    className={`kb-key ${isHit ? 'hit' : isMiss ? 'miss' : isNext ? 'next' : ''}`}
                  >
                    {k}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="kb-row">
            <div
              className={`kb-key space ${
                lastKeyFlash?.key === ' '
                  ? lastKeyFlash.ok
                    ? 'hit'
                    : 'miss'
                  : nextExpectedChar === ' '
                    ? 'next'
                    : ''
              }`}
            >
              SPACE
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
