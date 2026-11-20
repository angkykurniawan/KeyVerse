import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Globe,
  Hash,
  Play,
  RotateCcw,
  Swords,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { getRankTier } from '../lib/ranks';
import { playKeySound } from '../lib/sound';
import type { GeneratedPassage, Language } from '../types';

const VERSUS_DURATION_MS = 60_000;

export type BotDifficulty = 'easy' | 'medium' | 'hard';

interface BotRacer {
  id: string;
  name: string;
  tag: string;
  targetWpm: number;
  color: string;
}

const DIFFICULTY_CONFIG: Record<
  BotDifficulty,
  { label: string; badge: string; desc: string; bots: BotRacer[] }
> = {
  easy: {
    label: 'EASY (Rookie Heat)',
    badge: 'badge-emerald',
    desc: 'Lawan 2 bot pemula dengan kecepatan santai 35 - 48 WPM. Cocok untuk pemanasan.',
    bots: [
      { id: 'bot-1', name: 'NOVA-35', tag: 'ROOKIE', targetWpm: 35, color: '#00e599' },
      { id: 'bot-2', name: 'STRIKER-48', tag: 'PACER', targetWpm: 48, color: '#38bdf8' },
    ],
  },
  medium: {
    label: 'MEDIUM (Pro League)',
    badge: 'badge-cyan',
    desc: 'Lawan 3 bot cepat dan tangguh 62 - 82 WPM. Uji ketahanan akurasi dan kecepatan Anda.',
    bots: [
      { id: 'bot-1', name: 'VOLT-62', tag: 'PRO', targetWpm: 62, color: '#00f0ff' },
      { id: 'bot-2', name: 'PHANTOM-75', tag: 'ELITE', targetWpm: 75, color: '#c084fc' },
      { id: 'bot-3', name: 'CYBER-82', tag: 'CHALLENGER', targetWpm: 82, color: '#fb923c' },
    ],
  },
  hard: {
    label: 'HARD (Grand Championship)',
    badge: 'badge-amber',
    desc: 'Lawan 3 bot monster super cepat 90 - 115 WPM. Hanya untuk pengetik tingkat Master!',
    bots: [
      { id: 'bot-1', name: 'APEX-90', tag: 'MASTER', targetWpm: 90, color: '#ffb800' },
      { id: 'bot-2', name: 'TITAN-102', tag: 'GRANDMASTER', targetWpm: 102, color: '#a3e635' },
      { id: 'bot-3', name: 'HYPERION-115', tag: 'CHAMPION', targetWpm: 115, color: '#ff2e88' },
    ],
  },
};

const KEYWORD_PRESETS: { label: string; words: [string, string, string, string, string] }[] = [
  { label: 'Teknologi', words: ['algoritma', 'server', 'enkripsi', 'database', 'jaringan'] },
  { label: 'Esports', words: ['turnamen', 'refleks', 'kombo', 'juara', 'arena'] },
  { label: 'Medis', words: ['diagnosis', 'terapi', 'vaksin', 'anatomi', 'resep'] },
  { label: 'Bisnis', words: ['investasi', 'strategi', 'negosiasi', 'profit', 'audit'] },
];

function formatClock(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface WordSubmission {
  typed: string;
  target: string;
  correct: boolean;
}

export function VersusPage({ onOpenAdminAi: _onOpenAdminAi }: { onOpenAdminAi?: () => void }) {
  const { user, aiReady, refreshAiStatus } = useAuth();

  // Setup State
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLangId, setSelectedLangId] = useState<number>(0);
  const [keywords, setKeywords] = useState<string[]>(['', '', '', '', '']);

  // Race State
  const [gameState, setGameState] = useState<'lobby' | 'countdown' | 'racing' | 'finished'>('lobby');
  const [passage, setPassage] = useState<GeneratedPassage | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [countdownSec, setCountdownSec] = useState<number>(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Typing Inputs
  const [words, setWords] = useState<string[]>([]);
  const [baseWords, setBaseWords] = useState<string[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [history, setHistory] = useState<WordSubmission[]>([]);
  const [scrollY, setScrollY] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const finishedRef = useRef(false);

  const [playerMetrics, setPlayerMetrics] = useState({
    wpm: 0,
    raw_wpm: 0,
    accuracy: 100,
    correct_chars: 0,
    incorrect_chars: 0,
    total_chars: 0,
  });

  useEffect(() => {
    refreshAiStatus();
    api
      .getLanguages(false)
      .then((res) => {
        setLanguages(res.languages);
        if (res.languages.length > 0) {
          setSelectedLangId((prev) => prev || res.languages[0].id);
        }
      })
      .catch(() => {});
  }, [refreshAiStatus]);

  // Generate soal & mulai Countdown
  const handleStartRace = async () => {
    setError(null);
    const cleanKeywords = keywords.map((k) => k.trim());
    if (cleanKeywords.some((k) => !k)) {
      setError('Lengkapi tepat 5 kata utama topik balapan terlebih dahulu.');
      return;
    }

    setStarting(true);
    try {
      const res = await api.generateTypingText({
        language_id: selectedLangId,
        keywords: cleanKeywords,
      });
      setPassage(res);

      const split = res.text.trim().split(/\s+/).filter(Boolean);
      setBaseWords(split);
      setWords(split);
      setWordIndex(0);
      setCurrentInput('');
      setHistory([]);
      setElapsedMs(0);
      setScrollY(0);
      finishedRef.current = false;
      setPlayerMetrics({
        wpm: 0,
        raw_wpm: 0,
        accuracy: 100,
        correct_chars: 0,
        incorrect_chars: 0,
        total_chars: 0,
      });

      // Mulai Countdown 3 detik
      setGameState('countdown');
      setCountdownSec(3);

      let count = 3;
      const countTimer = window.setInterval(() => {
        count--;
        if (count > 0) {
          setCountdownSec(count);
          if (soundEnabled) playKeySound('correct');
        } else {
          window.clearInterval(countTimer);
          setCountdownSec(0);
          setGameState('racing');
          if (soundEnabled) playKeySound('complete');
          setTimeout(() => inputRef.current?.focus(), 40);
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyiapkan soal balapan AI.');
    } finally {
      setStarting(false);
    }
  };

  // Timer 60 Detik saat balapan berjalan
  useEffect(() => {
    if (gameState !== 'racing' || finishedRef.current) return;

    const startTimestamp = Date.now();
    const interval = window.setInterval(() => {
      const diff = Date.now() - startTimestamp;
      if (diff >= VERSUS_DURATION_MS) {
        setElapsedMs(VERSUS_DURATION_MS);
        finishedRef.current = true;
        setGameState('finished');
        if (soundEnabled) playKeySound('complete');
        window.clearInterval(interval);
        return;
      }
      setElapsedMs(diff);
    }, 100);

    return () => window.clearInterval(interval);
  }, [gameState, soundEnabled]);

  // Simpan hasil ke database otomatis saat balapan selesai
  useEffect(() => {
    if (gameState === 'finished' && passage) {
      api.saveSession({
        language_id: passage.language.id,
        keywords: passage.keywords,
        ai_model: passage.model_used,
        generated_text: passage.text,
        wpm: playerMetrics.wpm,
        raw_wpm: playerMetrics.raw_wpm,
        accuracy: playerMetrics.accuracy,
        total_chars: playerMetrics.total_chars,
        correct_chars: playerMetrics.correct_chars,
        incorrect_chars: playerMetrics.incorrect_chars,
        word_count: passage.word_count,
        duration_seconds: 60,
      }).catch(() => {});
    }
  }, [gameState, passage, playerMetrics]);

  // Scroll viewport typing
  useEffect(() => {
    const el = activeWordRef.current;
    if (!el) return;
    setScrollY(Math.max(0, el.offsetTop - 20));
  }, [wordIndex]);

  // Hitung metrics player secara real-time
  const activeTargetWord = words[wordIndex] || '';
  const isCurrentMismatch = currentInput.length > 0 && !activeTargetWord.startsWith(currentInput);

  const handleInputChange = (val: string) => {
    if (gameState !== 'racing' || finishedRef.current) return;

    let nextHistory = history;
    let nextInput = val;

    if (val.endsWith(' ')) {
      const submitted = val.trim();
      if (submitted.length === 0) {
        setCurrentInput('');
        return;
      }

      const isCorrect = submitted === activeTargetWord;
      nextHistory = [...history, { typed: submitted, target: activeTargetWord, correct: isCorrect }];
      setHistory(nextHistory);
      if (soundEnabled) playKeySound(isCorrect ? 'correct' : 'error');

      const nextIdx = wordIndex + 1;
      setWordIndex(nextIdx);
      setCurrentInput('');

      // Auto extend words jika player mengetik sangat cepat
      if (nextIdx >= words.length - 20 && baseWords.length > 0) {
        setWords((prev) => [...prev, ...baseWords]);
      }
    } else {
      if (val.length > currentInput.length) {
        const lastIdx = val.length - 1;
        const ok = val[lastIdx] === activeTargetWord[lastIdx];
        if (soundEnabled) playKeySound(ok ? 'correct' : 'error');
      }
      setCurrentInput(val);
      nextInput = val;
    }

    // Evaluasi statistik player
    let correctChars = 0;
    let incorrectChars = 0;
    for (const item of nextHistory) {
      if (item.correct) correctChars += item.target.length + 1;
      else incorrectChars += Math.max(item.typed.length, item.target.length);
    }
    for (let i = 0; i < nextInput.length; i++) {
      if (nextInput[i] === activeTargetWord[i]) correctChars++;
      else incorrectChars++;
    }

    const totalEvaluated = correctChars + incorrectChars;
    const accuracy =
      totalEvaluated > 0
        ? Number(Math.max(0, Math.min(100, (correctChars / totalEvaluated) * 100)).toFixed(1))
        : 100;
    const minutes = Math.max(elapsedMs, 500) / 60000;
    const wpm = Number(Math.max(0, correctChars / 5 / minutes).toFixed(1));
    const rawWpm = Number(Math.max(0, totalEvaluated / 5 / minutes).toFixed(1));

    setPlayerMetrics({
      wpm,
      raw_wpm: rawWpm,
      accuracy,
      correct_chars: correctChars,
      incorrect_chars: incorrectChars,
      total_chars: totalEvaluated,
    });
  };

  // Hitung progres simulasi bots & live ranking
  const activeBots = DIFFICULTY_CONFIG[difficulty].bots;
  const timeProgressFactor = Math.min(1, elapsedMs / VERSUS_DURATION_MS);

  const racers = useMemo(() => {
    // 1. Player Data
    const playerRacer = {
      id: 'player',
      name: user?.name || 'Racer Anda',
      username: user?.username || 'anda',
      isPlayer: true,
      wpm: playerMetrics.wpm,
      accuracy: playerMetrics.accuracy,
      color: '#ffb800', // Gold
      progress: Math.min(98, Math.max(4, timeProgressFactor * 98 * (playerMetrics.wpm / Math.max(70, playerMetrics.wpm + 10)))),
    };

    // 2. Bots Data (bergerak natural dengan simulasi waktu)
    const botRacers = activeBots.map((bot, idx) => {
      // Sedikit jitter fluktuasi WPM agar terasa seperti lawan nyata
      const jitter = Math.sin((elapsedMs / 1000) * 1.5 + idx) * 3;
      const liveWpm = Math.max(10, Math.round(bot.targetWpm + jitter));
      const targetPct = Math.min(98, (bot.targetWpm / 120) * 98);
      const progress = Math.min(98, Math.max(4, timeProgressFactor * targetPct));

      return {
        id: bot.id,
        name: bot.name,
        username: bot.tag,
        isPlayer: false,
        wpm: liveWpm,
        accuracy: 98 - idx,
        color: bot.color,
        progress,
      };
    });

    const all = [playerRacer, ...botRacers];

    // Urutkan peringkat berdasarkan WPM tertinggi
    all.sort((a, b) => b.wpm - a.wpm);
    return all.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [user, playerMetrics, activeBots, timeProgressFactor, elapsedMs]);

  const playerCurrentRank = racers.find((r) => r.isPlayer)?.rank || 1;
  const remainingTimeMs = Math.max(0, VERSUS_DURATION_MS - elapsedMs);
  const isUrgent = gameState === 'racing' && remainingTimeMs <= 10_000;

  // =========================================================================
  // VIEW: COUNTDOWN / RACING / FINISHED
  // =========================================================================
  if (gameState !== 'lobby') {
    return (
      <div className="play-cockpit">
        {/* Top Status Header */}
        <div className="arena-strip" style={{ padding: '12px 18px' }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="live-tag">
              <span className="live-dot" />
              {gameState === 'countdown' ? 'BERSIAP!' : gameState === 'racing' ? 'BALAPAN ADU KETIK 1 MENIT' : 'SELESAI'}
            </span>
            <span className={`badge ${DIFFICULTY_CONFIG[difficulty].badge}`}>
              {DIFFICULTY_CONFIG[difficulty].label}
            </span>
            <span className="badge badge-slate">{passage?.language.native_name || 'Bahasa'}</span>
          </div>

          <div className="row" style={{ gap: 12 }}>
            {gameState === 'racing' && (
              <div className="row" style={{ gap: 14 }}>
                <div className="row" style={{ gap: 6 }}>
                  <Timer size={20} color={isUrgent ? '#ff3b5c' : '#ffb800'} />
                  <span className={`timer-clock ${isUrgent ? 'urgent' : ''}`} style={{ fontSize: '1.7rem', minWidth: 74 }}>
                    {formatClock(remainingTimeMs)}
                  </span>
                </div>
                <span className="mono" style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '1.2rem' }}>
                  {Math.round(playerMetrics.wpm)} WPM
                </span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                  {playerMetrics.accuracy}%
                </span>
                <span className="badge badge-amber" style={{ fontWeight: 800 }}>
                  POSISI #{playerCurrentRank}
                </span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={() => setSoundEnabled((s) => !s)}
              title="Efek Suara Keyboard"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button type="button" className="btn btn-danger btn-sm" onClick={() => setGameState('lobby')}>
              Keluar Balapan
            </button>
          </div>
        </div>

        {/* 1. COUNTDOWN SCREEN */}
        {gameState === 'countdown' && (
          <div className="card card-arena" style={{ textAlign: 'center', padding: '54px 24px' }}>
            <div className="display" style={{ fontSize: '1rem', color: 'var(--cyan)', fontWeight: 700, letterSpacing: '0.15em' }}>
              BALAPAN DIMULAI DALAM...
            </div>
            <div className="mono" style={{ fontSize: '6rem', fontWeight: 900, color: 'var(--gold)', margin: '12px 0' }}>
              {countdownSec > 0 ? countdownSec : 'GASSS!'}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Siapkan jari Anda di keyboard! Lawan bot siap melaju kencang!
            </p>
          </div>
        )}

        {/* 2. REAL-TIME RACE TRACK (SEPANJANG BALAPAN & HASIL) */}
        {(gameState === 'racing' || gameState === 'finished') && (
          <div className="slim-race-strip" style={{ marginBottom: 14 }}>
            {racers.map((r) => {
              const leftPct = Math.max(3, Math.min(97, r.progress));
              return (
                <div key={r.id} className="slim-lane">
                  <div className="racer-label" style={{ fontSize: '0.78rem' }}>
                    <span className={`racer-pos p${Math.min(3, r.rank)}`} style={{ width: 22, height: 22, fontSize: '0.7rem' }}>
                      #{r.rank}
                    </span>
                    <span style={{ color: r.isPlayer ? 'var(--gold)' : 'var(--text-primary)', fontWeight: r.isPlayer ? 800 : 600 }}>
                      {r.name} {r.isPlayer && '(ANDA)'}
                    </span>
                  </div>
                  <div className="slim-track">
                    <div
                      className="slim-fill"
                      style={{
                        width: `${leftPct}%`,
                        background: `linear-gradient(90deg, transparent, ${r.color}bb)`,
                      }}
                    />
                    <div
                      className="slim-dot"
                      style={{
                        left: `${leftPct}%`,
                        background: r.color,
                        boxShadow: `0 0 14px ${r.color}`,
                        transform: 'translate(-50%, -50%) scale(1.1)',
                      }}
                    />
                  </div>
                  <div className="racer-wpm" style={{ fontSize: '0.78rem', color: r.color, fontWeight: 700 }}>
                    {r.wpm} WPM
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. FOCUS TYPING BOX */}
        {gameState === 'racing' && (
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
                      <span key={idx} className={`f-word ${past.correct ? 'word-correct' : 'word-wrong'}`}>
                        {word}
                      </span>
                    );
                  }

                  if (isActive) {
                    const extraChars = currentInput.length > word.length ? currentInput.slice(word.length) : '';
                    return (
                      <span key={idx} ref={activeWordRef} className={`f-word ${isCurrentMismatch ? 'active-word-wrong' : 'active-word'}`}>
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
                        {extraChars && <span className="f-char extra-err">{extraChars}</span>}
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

            <div className={`live-type-deck ${isCurrentMismatch ? 'is-wrong' : ''}`}>
              <input
                ref={inputRef}
                type="text"
                className="live-type-input"
                value={currentInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`Ketik: ${activeTargetWord} lalu tekan Spasi...`}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
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

            <div className="time-progress-bar">
              <div
                className={`time-progress-fill ${isUrgent ? 'urgent' : ''}`}
                style={{ width: `${Math.max(0, (remainingTimeMs / VERSUS_DURATION_MS) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* 4. FINISH PODIUM RESULT */}
        {gameState === 'finished' && (
          <div className="card card-arena stack-md">
            <div className="row-between">
              <div>
                <h2 className="cockpit-title" style={{ fontSize: '1.45rem' }}>
                  {playerCurrentRank === 1 ? (
                    <>
                      <Crown size={26} color="#ffb800" />
                      SELAMAT! ANDA <span>JUARA 1</span>!
                    </>
                  ) : (
                    <>
                      <Trophy size={24} color="#00f0ff" />
                      HASIL BALAPAN <span>ADU KETIK 1 MENIT</span>
                    </>
                  )}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 4 }}>
                  Hasil balapan Anda telah otomatis tercatat ke Riwayat & Papan Klasemen!
                </p>
              </div>

              <div className="row" style={{ gap: 10 }}>
                <button type="button" className="btn btn-race" onClick={handleStartRace} disabled={starting}>
                  <RotateCcw size={16} />
                  {starting ? 'MEMUAT...' : 'TANDING ULANG'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setGameState('lobby')}>
                  Ganti Sirkuit / Kesulitan
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Podium</th>
                    <th>Pembalap</th>
                    <th>Kecepatan (WPM)</th>
                    <th>Akurasi</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {racers.map((r) => {
                    const tier = getRankTier(r.wpm);
                    return (
                      <tr key={r.id} className={r.isPlayer ? 'is-me-row' : ''}>
                        <td>
                          <span className={`racer-pos ${r.rank <= 3 ? `p${r.rank}` : ''}`}>
                            #{r.rank}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>
                            {r.name} {r.isPlayer && <span className="badge badge-amber">ANDA</span>}
                          </div>
                          <div className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {r.username}
                          </div>
                        </td>
                        <td className="mono" style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '1.1rem' }}>
                          {r.wpm} WPM
                        </td>
                        <td className="mono" style={{ color: 'var(--emerald)', fontWeight: 700 }}>
                          {r.accuracy}%
                        </td>
                        <td>
                          <span className="badge" style={{ color: tier.color, border: `1px solid ${tier.color}55` }}>
                            {tier.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: BOT ARENA LOBBY (LANGSUNG PILIH & GAS BALAPAN TANPA ROOM CODE)
  // =========================================================================
  const filledCount = keywords.filter((k) => k.trim().length > 0).length;
  const canStart = selectedLangId > 0 && filledCount === 5 && !starting;

  return (
    <div className="play-cockpit">
      {/* Header */}
      <div className="cockpit-head">
        <div>
          <h1 className="cockpit-title">
            <Swords size={26} color="#ff2e88" />
            ADU KETIK <span>LAWAN BOT ESPORTS</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
            Tantang bot pembalap AI dalam sprint ketik 60 detik. Tanpa perlu buat room, langsung pilih kesulitan dan gass!
          </p>
        </div>

        <span className={`badge ${aiReady ? 'badge-emerald' : 'badge-amber'}`} style={{ padding: '6px 14px' }}>
          {aiReady ? '● Mesin AI Siap' : '● Mode Adaptif Aktif'}
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card card-arena stack-lg">
        {/* 1. PILIH TINGKAT KESULITAN BOT (EASY, MEDIUM, HARD) */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Zap size={16} color="#ffb800" />
            1. PILIH TINGKAT KESULITAN BOT:
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((diff) => {
              const cfg = DIFFICULTY_CONFIG[diff];
              const isSelected = difficulty === diff;
              return (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`kpi-card`}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '16px',
                    borderRadius: 12,
                    background: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                    borderColor: isSelected ? 'var(--cyan)' : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: isSelected ? '0 0 16px rgba(0, 240, 255, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.96rem', color: isSelected ? 'var(--cyan)' : 'var(--text-primary)' }}>
                      {cfg.label}
                    </span>
                    {isSelected && <CheckCircle2 size={18} color="#00f0ff" />}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5, marginBottom: 10 }}>
                    {cfg.desc}
                  </p>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {cfg.bots.map((b) => (
                      <span key={b.id} className="badge mono" style={{ color: b.color, borderColor: `${b.color}55`, fontSize: '0.72rem' }}>
                        {b.name}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. PILIH BAHASA */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Globe size={16} color="#00f0ff" />
            2. PILIH BAHASA LINTASAN KETIK:
          </label>
          <div className="lang-pill-row">
            {languages.map((lang) => (
              <button
                key={lang.id}
                type="button"
                className={`lang-pill ${selectedLangId === lang.id ? 'active' : ''}`}
                onClick={() => setSelectedLangId(lang.id)}
              >
                <span>{lang.native_name}</span>
                <span className="mono" style={{ fontSize: '0.7rem', opacity: 0.75 }}>
                  ({lang.code})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. 5 KATA UTAMA */}
        <div>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Hash size={16} color="#ff2e88" />
              3. MASUKKAN 5 KATA UTAMA TOPIK BALAPAN:
            </label>
            <span className="mono" style={{ fontSize: '0.78rem', color: filledCount === 5 ? 'var(--emerald)' : 'var(--gold)' }}>
              {filledCount}/5 Terisi
            </span>
          </div>

          <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Preset Cepat:</span>
            {KEYWORD_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setKeywords([...p.words])}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 8,
            }}
          >
            {keywords.map((kw, i) => (
              <input
                key={i}
                type="text"
                className="input mono"
                placeholder={`Kata #${i + 1}`}
                value={kw}
                onChange={(e) => {
                  const copy = [...keywords];
                  copy[i] = e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
                  setKeywords(copy);
                }}
              />
            ))}
          </div>
        </div>

        {/* TOMBOL GAS BALAPAN */}
        <div style={{ paddingTop: 8 }}>
          <button
            type="button"
            className="btn btn-race"
            style={{ width: '100%', padding: '16px', fontSize: '1.15rem' }}
            disabled={!canStart}
            onClick={handleStartRace}
          >
            {starting ? <span className="spinner" /> : <Play size={20} />}
            {starting ? 'MENYIAPKAN SIRKUIT BALAP...' : 'GAS BALAPAN 1 MENIT SEKARANG!'}
          </button>
        </div>
      </div>
    </div>
  );
}
