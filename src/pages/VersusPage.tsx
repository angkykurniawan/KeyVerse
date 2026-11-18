import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  DoorOpen,
  Flame,
  Globe,
  Hash,
  KeyRound,
  LogIn,
  Play,
  RefreshCw,
  RotateCcw,
  Swords,
  Timer,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { getRankTier } from '../lib/ranks';
import { playKeySound } from '../lib/sound';
import type { Language, OpenRoomSummary, RaceRoom } from '../types';

const VERSUS_DURATION_MS = 60_000;

interface VersusPageProps {
  onOpenAdminAi: () => void;
}

interface WordSubmission {
  typed: string;
  target: string;
  correct: boolean;
}

const RACER_COLORS = [
  '#00f0ff',
  '#ff2e88',
  '#00e599',
  '#c084fc',
  '#fb923c',
  '#38bdf8',
  '#a3e635',
];

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

export function VersusPage({ onOpenAdminAi }: VersusPageProps) {
  const { user, aiReady, refreshAiStatus } = useAuth();

  const [lobbyTab, setLobbyTab] = useState<'join' | 'create'>('join');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLangId, setSelectedLangId] = useState<number>(0);
  const [keywords, setKeywords] = useState<string[]>(['', '', '', '', '']);

  const [openRooms, setOpenRooms] = useState<OpenRoomSummary[]>([]);
  const [loadingOpenRooms, setLoadingOpenRooms] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [room, setRoom] = useState<RaceRoom | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [countdownSec, setCountdownSec] = useState<number>(0);

  // Real-input 1-minute multiplayer typing state
  const [words, setWords] = useState<string[]>([]);
  const [baseWords, setBaseWords] = useState<string[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [history, setHistory] = useState<WordSubmission[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [localFinished, setLocalFinished] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const lastSyncRef = useRef<number>(0);
  const finishedRef = useRef(false);
  const latestMetricsRef = useRef({
    progress: 0,
    wpm: 0,
    raw_wpm: 0,
    accuracy: 100,
    correct_chars: 0,
    incorrect_chars: 0,
    duration_seconds: 0,
    finished: false,
  });

  useEffect(() => {
    refreshAiStatus();
  }, [refreshAiStatus]);

  useEffect(() => {
    api
      .getLanguages(false)
      .then((res) => {
        setLanguages(res.languages);
        if (res.languages.length > 0) {
          setSelectedLangId((prev) => prev || res.languages[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const loadOpenRooms = useCallback(async () => {
    setLoadingOpenRooms(true);
    try {
      const res = await api.getOpenRooms();
      setOpenRooms(res.rooms);
    } catch {
    } finally {
      setLoadingOpenRooms(false);
    }
  }, []);

  useEffect(() => {
    if (room) return;
    loadOpenRooms();
    const timer = window.setInterval(loadOpenRooms, 5000);
    return () => window.clearInterval(timer);
  }, [room, loadOpenRooms]);

  const resetLocalTyping = useCallback((baseText = '') => {
    const split = baseText.trim() ? baseText.trim().split(/\s+/).filter(Boolean) : [];
    setBaseWords(split);
    setWords(split);
    setWordIndex(0);
    setCurrentInput('');
    setHistory([]);
    setElapsedMs(0);
    setLocalFinished(false);
    setScrollY(0);
    finishedRef.current = false;
    lastSyncRef.current = 0;
    latestMetricsRef.current = {
      progress: 0,
      wpm: 0,
      raw_wpm: 0,
      accuracy: 100,
      correct_chars: 0,
      incorrect_chars: 0,
      duration_seconds: 0,
      finished: false,
    };
  }, []);

  const pushProgress = useCallback(
    async (roomCode: string, payload: typeof latestMetricsRef.current) => {
      try {
        const res = await api.sendRoomProgress(roomCode, payload);
        setRoom(res.room);
      } catch {}
    },
    []
  );

  // Poll active room
  useEffect(() => {
    if (!room) return;
    const intervalMs =
      room.status === 'racing' || room.status === 'countdown'
        ? 800
        : room.status === 'waiting'
          ? 1200
          : 2500;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.getRoom(room.code);
        if (cancelled) return;
        const nextRoom = res.room;
        setClockOffsetMs(nextRoom.server_time_ms - Date.now());

        if (
          nextRoom.generated_text !== room.generated_text ||
          (room.status === 'finished' && nextRoom.status === 'waiting')
        ) {
          resetLocalTyping(nextRoom.generated_text);
        }
        setRoom(nextRoom);
      } catch {}
    };

    const id = window.setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [room, resetLocalTyping]);

  // Synchronized countdown
  useEffect(() => {
    if (!room || room.status !== 'countdown' || !room.starts_at_ms) {
      setCountdownSec(0);
      return;
    }
    const tick = () => {
      const serverNow = Date.now() + clockOffsetMs;
      const diff = (room.starts_at_ms || 0) - serverNow;
      setCountdownSec(diff <= 0 ? 0 : Math.ceil(diff / 1000));
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [room, clockOffsetMs]);

  // Synchronized 60-second race timer
  useEffect(() => {
    if (!room || room.status !== 'racing' || !room.starts_at_ms || localFinished) return;
    setTimeout(() => inputRef.current?.focus(), 40);

    const id = window.setInterval(() => {
      const serverNow = Date.now() + clockOffsetMs;
      const elapsed = Math.max(0, serverNow - (room.starts_at_ms || serverNow));
      if (elapsed >= VERSUS_DURATION_MS && !finishedRef.current) {
        finishedRef.current = true;
        setElapsedMs(VERSUS_DURATION_MS);
        setLocalFinished(true);
        if (soundEnabled) playKeySound('complete');
        const finalPayload = {
          ...latestMetricsRef.current,
          progress: 100,
          duration_seconds: 60,
          finished: true,
        };
        latestMetricsRef.current = finalPayload;
        pushProgress(room.code, finalPayload);
        window.clearInterval(id);
        return;
      }
      setElapsedMs(elapsed);
    }, 80);

    return () => window.clearInterval(id);
  }, [room, clockOffsetMs, localFinished, soundEnabled, pushProgress]);

  useEffect(() => {
    const el = activeWordRef.current;
    if (!el) return;
    setScrollY(Math.max(0, el.offsetTop - 20));
  }, [wordIndex]);

  const evaluateMetrics = useCallback(
    (subs: WordSubmission[], activeTyped: string, activeTarget: string, ms: number) => {
      let correctChars = 0;
      let incorrectChars = 0;
      for (const item of subs) {
        if (item.correct) {
          correctChars += item.target.length + 1;
        } else {
          incorrectChars += Math.max(item.typed.length, item.target.length);
        }
      }
      for (let i = 0; i < activeTyped.length; i++) {
        if (activeTyped[i] === activeTarget[i]) correctChars++;
        else incorrectChars++;
      }

      const totalTyped =
        subs.reduce((acc, s) => acc + s.typed.length + 1, 0) + activeTyped.length;
      const evaluated = correctChars + incorrectChars;
      const accuracy =
        evaluated > 0
          ? Number(Math.max(0, Math.min(100, (correctChars / evaluated) * 100)).toFixed(1))
          : 100;
      const minutes = Math.max(ms, 500) / 60000;
      const wpm = Number(Math.max(0, correctChars / 5 / minutes).toFixed(1));
      const rawWpm = Number(Math.max(0, totalTyped / 5 / minutes).toFixed(1));

      return {
        progress: Number(Math.min(99, (ms / VERSUS_DURATION_MS) * 100).toFixed(1)),
        wpm,
        raw_wpm: rawWpm,
        accuracy,
        correct_chars: correctChars,
        incorrect_chars: incorrectChars,
        duration_seconds: Number((ms / 1000).toFixed(2)),
        finished: false,
      };
    },
    []
  );

  const handleCreateRoom = async () => {
    setError(null);
    const cleanKeywords = keywords.map((k) => k.trim());
    if (cleanKeywords.some((k) => !k)) {
      setError('Isi penuh tepat 5 kata utama terlebih dahulu.');
      return;
    }

    setCreatingRoom(true);
    try {
      const res = await api.createRoom({
        language_id: selectedLangId,
        keywords: cleanKeywords,
      });
      resetLocalTyping(res.room.generated_text);
      setClockOffsetMs(res.room.server_time_ms - Date.now());
      setRoom(res.room);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat room adu ketik.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async (codeToJoin?: string) => {
    const cleanCode = (codeToJoin ?? joinCode).trim().toUpperCase();
    if (!cleanCode) {
      setError('Masukkan kode room dari kawan Anda.');
      return;
    }
    setError(null);
    setJoiningRoom(true);
    try {
      const res = await api.joinRoom(cleanCode);
      resetLocalTyping(res.room.generated_text);
      setClockOffsetMs(res.room.server_time_ms - Date.now());
      setRoom(res.room);
      setJoinCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal bergabung ke room.');
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleStartRace = async () => {
    if (!room) return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.startRoom(room.code);
      setClockOffsetMs(res.room.server_time_ms - Date.now());
      setRoom(res.room);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memulai balapan.');
    } finally {
      setStarting(false);
    }
  };

  const handleToggleReady = async () => {
    if (!room) return;
    const me = room.participants.find((p) => p.is_me);
    try {
      const res = await api.setRoomReady(room.code, !(me?.is_ready ?? false));
      setRoom(res.room);
    } catch {}
  };

  const handleRematch = async () => {
    if (!room) return;
    setRematching(true);
    setError(null);
    try {
      const res = await api.rematchRoom(room.code);
      resetLocalTyping(res.room.generated_text);
      setClockOffsetMs(res.room.server_time_ms - Date.now());
      setRoom(res.room);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat soal rematch.');
    } finally {
      setRematching(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) return;
    try {
      await api.leaveRoom(room.code);
    } catch {}
    resetLocalTyping('');
    setRoom(null);
    loadOpenRooms();
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const activeTargetWord = words[wordIndex] || '';
  const isCurrentMismatch =
    currentInput.length > 0 && !activeTargetWord.startsWith(currentInput);

  const handleInputChange = (val: string) => {
    if (!room || room.status !== 'racing' || localFinished || finishedRef.current) return;

    const serverNow = Date.now() + clockOffsetMs;
    const ms = Math.max(500, serverNow - (room.starts_at_ms || serverNow));

    let nextHistory = history;
    let nextInput = val;
    let nextTarget = activeTargetWord;

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
      nextInput = '';
      setCurrentInput('');

      let nextWords = words;
      if (nextIdx >= words.length - 25 && baseWords.length > 0) {
        nextWords = [...words, ...baseWords];
        setWords(nextWords);
      }
      nextTarget = nextWords[nextIdx] || '';
    } else {
      if (val.length > currentInput.length) {
        const lastIdx = val.length - 1;
        const ok = val[lastIdx] === activeTargetWord[lastIdx];
        if (soundEnabled) playKeySound(ok ? 'correct' : 'error');
      }
      setCurrentInput(val);
    }

    const metrics = evaluateMetrics(nextHistory, nextInput, nextTarget, ms);
    latestMetricsRef.current = metrics;

    const now = Date.now();
    if (now - lastSyncRef.current >= 700) {
      lastSyncRef.current = now;
      pushProgress(room.code, metrics);
    }
  };

  const liveParticipants = useMemo(() => {
    if (!room) return [];
    const merged = room.participants.map((p, idx) => {
      const color = p.is_me ? '#ffb800' : RACER_COLORS[idx % RACER_COLORS.length];
      if (p.is_me && room.status === 'racing') {
        const m = latestMetricsRef.current;
        return {
          ...p,
          color,
          wpm: m.wpm || p.wpm,
          accuracy: m.accuracy,
          finished: localFinished || p.finished,
        };
      }
      return { ...p, color };
    });

    const sorted = [...merged].sort((a, b) => {
      if (Math.abs(b.wpm - a.wpm) > 0.05) return b.wpm - a.wpm;
      return b.accuracy - a.accuracy;
    });
    const rankMap = new Map<number, number>();
    sorted.forEach((item, i) => rankMap.set(item.user_id, i + 1));

    const maxWpm = Math.max(85, ...merged.map((m) => m.wpm + 5));
    const timeFactor = room.status === 'finished' ? 1 : Math.min(1, elapsedMs / VERSUS_DURATION_MS);

    return merged.map((p) => ({
      ...p,
      liveRank: rankMap.get(p.user_id) || p.rank,
      barPct: Math.min(98, (p.wpm / maxWpm) * Math.max(0.15, timeFactor) * 100),
    }));
  }, [room, currentInput, history, localFinished, elapsedMs]);

  const filledCount = keywords.filter((k) => k.trim().length > 0).length;
  const canCreate = selectedLangId > 0 && filledCount === 5 && aiReady && !creatingRoom;

  // =========================================================================
  // ACTIVE ROOM VIEW
  // =========================================================================
  if (room) {
    const me = room.participants.find((p) => p.is_me);
    const rankedFinal = [...liveParticipants].sort((a, b) => a.liveRank - b.liveRank);
    const remainingMs = Math.max(0, VERSUS_DURATION_MS - elapsedMs);
    const isUrgent = room.status === 'racing' && remainingMs <= 10_000;

    return (
      <div className="play-cockpit">
        <div className="arena-strip" style={{ padding: '12px 18px' }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="live-tag">
              <span className="live-dot" />
              {room.status === 'waiting'
                ? 'MENUNGGU KAWAN'
                : room.status === 'countdown'
                  ? 'BERSIAP!'
                  : room.status === 'racing'
                    ? 'ADU KETIK 1 MENIT'
                    : 'SELESAI'}
            </span>
            <span className="badge badge-amber mono" style={{ fontSize: '0.84rem' }}>
              KODE: {room.code}
            </span>
            <button type="button" className="btn btn-cyan btn-sm" onClick={handleCopyCode}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Tersalin!' : 'Salin'}
            </button>
            <span className="badge badge-slate">{room.language.native_name}</span>
          </div>

          <div className="row" style={{ gap: 8 }}>
            {room.status === 'racing' && (
              <div className="row" style={{ gap: 14, marginRight: 6 }}>
                <div className="row" style={{ gap: 6 }}>
                  <Timer size={20} color={isUrgent ? '#ff3b5c' : '#ffb800'} />
                  <span
                    className={`timer-clock ${isUrgent ? 'urgent' : ''}`}
                    style={{ fontSize: '1.7rem', minWidth: 74 }}
                  >
                    {formatClock(remainingMs)}
                  </span>
                </div>
                <span className="mono" style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '1.1rem' }}>
                  {Math.round(latestMetricsRef.current.wpm)} WPM
                </span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                  {latestMetricsRef.current.accuracy}%
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={() => setSoundEnabled((s) => !s)}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleLeaveRoom}>
              <DoorOpen size={14} />
              Keluar
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* WAITING ROOM */}
        {room.status === 'waiting' && (
          <div className="card card-arena stack-md">
            <div className="victory-banner" style={{ padding: '20px 24px' }}>
              <div>
                <div className="display" style={{ fontSize: '0.76rem', color: 'var(--cyan)', fontWeight: 700 }}>
                  BAGIKAN KODE ROOM KE KAWAN ANDA
                </div>
                <div className="row" style={{ marginTop: 6, gap: 12 }}>
                  <span className="mono" style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--gold)' }}>
                    {room.code}
                  </span>
                  <button type="button" className="btn btn-primary" onClick={handleCopyCode}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Tersalin!' : 'Salin Kode'}
                  </button>
                </div>
                <div className="kw-tags" style={{ marginTop: 8 }}>
                  <span className="badge badge-cyan">Durasi: 1 Menit</span>
                  {room.keywords.map((kw, i) => (
                    <span key={i} className="kw-tag mono">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
                <span className="badge badge-cyan" style={{ fontSize: '0.84rem', padding: '6px 12px' }}>
                  <Users size={15} /> {room.participants.length} / 8 Peserta
                </span>
                {room.is_host ? (
                  <button type="button" className="btn btn-race" onClick={handleStartRace} disabled={starting}>
                    {starting ? <span className="spinner" /> : <Play size={18} />}
                    {starting ? 'MEMULAI...' : 'MULAI ADU KETIK 1 MENIT!'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`btn ${me?.is_ready ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleToggleReady}
                  >
                    <CheckCircle2 size={16} />
                    {me?.is_ready ? 'SIAP (KLIK BATAL)' : 'SAYA SIAP!'}
                  </button>
                )}
              </div>
            </div>

            <div className="kpi-grid">
              {liveParticipants.map((p) => (
                <div
                  key={p.user_id}
                  className="kpi-card"
                  style={{
                    borderColor: p.is_me ? 'var(--gold)' : `${p.color}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '14px 16px',
                  }}
                >
                  <div>
                    <div className="row" style={{ gap: 6 }}>
                      {p.is_host && <Crown size={15} color="#ffb800" />}
                      <span style={{ fontWeight: 700 }}>{p.name}</span>
                      {p.is_me && <span className="badge badge-amber">ANDA</span>}
                    </div>
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      @{p.username}
                    </div>
                  </div>
                  <span className={`badge ${p.is_ready ? 'badge-emerald' : 'badge-slate'}`}>
                    {p.is_ready ? 'SIAP' : 'TUNGGU'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COUNTDOWN */}
        {room.status === 'countdown' && (
          <div className="card card-arena" style={{ textAlign: 'center', padding: '52px 24px' }}>
            <div className="display" style={{ fontSize: '0.95rem', color: 'var(--cyan)', fontWeight: 700, letterSpacing: '0.15em' }}>
              ADU KETIK 1 MENIT DIMULAI DALAM...
            </div>
            <div className="mono" style={{ fontSize: '5.5rem', fontWeight: 800, color: 'var(--gold)', margin: '10px 0' }}>
              {countdownSec > 0 ? countdownSec : 'GO!'}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Siapkan jari di keyboard — semua peserta mulai serentak!</p>
          </div>
        )}

        {/* SLIM LIVE RACE TRACK */}
        {(room.status === 'racing' || room.status === 'finished') && (
          <div className="slim-race-strip">
            {liveParticipants.map((p) => {
              const leftPct = Math.max(3, Math.min(97, p.barPct));
              return (
                <div key={p.user_id} className="slim-lane">
                  <div className="racer-label" style={{ fontSize: '0.76rem' }}>
                    <span className={`racer-pos p${Math.min(3, p.liveRank)}`} style={{ width: 21, height: 21, fontSize: '0.68rem' }}>
                      #{p.liveRank}
                    </span>
                    <span style={{ color: p.is_me ? 'var(--gold)' : 'var(--text-primary)' }}>
                      {p.username}
                    </span>
                  </div>
                  <div className="slim-track">
                    <div
                      className="slim-fill"
                      style={{
                        width: `${Math.max(2, p.barPct)}%`,
                        background: `linear-gradient(90deg, transparent, ${p.color}bb)`,
                      }}
                    />
                    <div
                      className="slim-dot"
                      style={{ left: `${leftPct}%`, background: p.color, boxShadow: `0 0 12px ${p.color}` }}
                    />
                  </div>
                  <div className="racer-wpm" style={{ fontSize: '0.75rem', color: p.color }}>
                    {Math.round(p.wpm)} WPM
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* REAL-INPUT 3-LINE FOCUS TYPING BOX */}
        {room.status === 'racing' && !localFinished && (
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
                <span className="live-match-pill ok">✓ Cocok — Spasi</span>
              ) : (
                <span className="live-match-pill ok">✓ Sesuai</span>
              )}
            </div>

            <div className="time-progress-bar">
              <div
                className={`time-progress-fill ${isUrgent ? 'urgent' : ''}`}
                style={{ width: `${Math.max(0, 100 - (elapsedMs / VERSUS_DURATION_MS) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* FINISH PODIUM */}
        {(localFinished || room.status === 'finished') && (
          <div className="card card-arena stack-md">
            <div className="row-between">
              <div>
                <h2 className="cockpit-title" style={{ fontSize: '1.35rem' }}>
                  <Trophy size={22} color="#ffb800" />
                  HASIL AKHIR <span>ADU KETIK 1 MENIT</span>
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: 2 }}>
                  Skor 1 menit otomatis tersimpan ke database & klasemen global.
                </p>
              </div>
              <div className="row">
                {room.is_host && (
                  <button type="button" className="btn btn-race" onClick={handleRematch} disabled={rematching}>
                    {rematching ? <span className="spinner" /> : <RotateCcw size={16} />}
                    {rematching ? 'SOAL BARU...' : 'REMATCH 1 MENIT'}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={handleLeaveRoom}>
                  Kembali
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Posisi</th>
                    <th>Peserta</th>
                    <th>WPM (1 Menit)</th>
                    <th>Akurasi</th>
                    <th>Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedFinal.map((p) => {
                    const tier = getRankTier(p.wpm);
                    return (
                      <tr key={p.user_id} className={p.is_me ? 'is-me-row' : ''}>
                        <td>
                          <span className={`racer-pos ${p.liveRank <= 3 ? `p${p.liveRank}` : ''}`}>
                            #{p.liveRank}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>
                            {p.name} {p.is_me && <span className="badge badge-amber">ANDA</span>}
                          </div>
                          <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            @{p.username}
                          </div>
                        </td>
                        <td className="mono" style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '1.05rem' }}>
                          {p.wpm} WPM
                        </td>
                        <td className="mono" style={{ color: 'var(--emerald)', fontWeight: 700 }}>
                          {p.accuracy}%
                        </td>
                        <td>
                          <span className="badge" style={{ color: tier.color, border: `1px solid ${tier.color}55` }}>
                            {tier.shortLabel}
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
  // CLEAN 2-TAB VERSUS LOBBY
  // =========================================================================
  return (
    <div className="play-cockpit">
      <div className="cockpit-head">
        <div>
          <h1 className="cockpit-title">
            <Swords size={24} color="#ff2e88" />
            ADU KETIK 1 MENIT <span>DENGAN KAWAN</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
            Bertanding 60 detik serentak bersama kawan (hingga 8 peserta) dengan teks AI yang sama.
          </p>
        </div>

        <span className={`badge ${aiReady ? 'badge-emerald' : 'badge-rose'}`} style={{ padding: '6px 12px' }}>
          {aiReady ? '● AI Generator Siap' : '● AI Belum Diatur Admin'}
        </span>
      </div>

      <div className="subtabs">
        <button
          type="button"
          className={`subtab ${lobbyTab === 'join' ? 'active' : ''}`}
          onClick={() => setLobbyTab('join')}
        >
          <LogIn size={16} />
          Gabung Room Kawan ({openRooms.length})
        </button>
        <button
          type="button"
          className={`subtab ${lobbyTab === 'create' ? 'active' : ''}`}
          onClick={() => setLobbyTab('create')}
        >
          <Flame size={16} />
          Buat Room Baru
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {lobbyTab === 'join' ? (
        <div className="card card-arena stack-md">
          <div className="form-group">
            <span className="form-label">Masukkan Kode Room dari Kawan</span>
            <div className="row">
              <input
                type="text"
                className="input mono"
                style={{ flex: 1, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}
                placeholder="CONTOH: KV7X2A"
                maxLength={10}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinRoom();
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '12px 22px' }}
                onClick={() => handleJoinRoom()}
                disabled={joiningRoom || !joinCode.trim()}
              >
                {joiningRoom ? <span className="spinner" /> : <Swords size={16} />}
                Gabung Room
              </button>
            </div>
          </div>

          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="form-label">Room Terbuka Saat Ini</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={loadOpenRooms} disabled={loadingOpenRooms}>
                <RefreshCw size={13} className={loadingOpenRooms ? 'spinner' : ''} />
                Refresh
              </button>
            </div>

            {openRooms.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '16px 0' }}>
                Belum ada room terbuka. Klik tab <strong>Buat Room Baru</strong> untuk mengundang kawan Anda!
              </div>
            ) : (
              <div className="stack-sm">
                {openRooms.map((r) => (
                  <div
                    key={r.code}
                    className="row-between"
                    style={{
                      padding: '11px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="badge badge-amber mono">{r.code}</span>
                        <span style={{ fontWeight: 700 }}>{r.host_name}</span>
                        <span className="badge badge-cyan">{r.language_native_name}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {r.participant_count} peserta • #{r.keywords.join(' #')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-cyan btn-sm"
                      onClick={() => handleJoinRoom(r.code)}
                      disabled={joiningRoom}
                    >
                      Gabung
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card card-arena stack-md">
          {!aiReady && (
            <div className="alert alert-warning" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 8, flex: 1 }}>
                <AlertCircle size={17} />
                <span>
                  {user?.role === 'admin'
                    ? 'API key Google AI Studio belum dikonfigurasi. Atur melalui Admin HQ.'
                    : 'Layanan AI belum diaktifkan oleh Administrator. Silakan hubungi Admin.'}
                </span>
              </div>
              {user?.role === 'admin' && (
                <button type="button" className="btn btn-cyan btn-sm" onClick={onOpenAdminAi}>
                  <KeyRound size={14} />
                  Atur di Admin HQ
                </button>
              )}
            </div>
          )}

          <div className="form-group">
            <span className="form-label">
              <span className="row" style={{ gap: 6 }}>
                <Globe size={15} color="#00f0ff" />
                1. Pilih Bahasa
              </span>
            </span>
            <div className="pill-strip">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  className={`choice-pill ${lang.id === selectedLangId ? 'active' : ''}`}
                  onClick={() => setSelectedLangId(lang.id)}
                >
                  <span className="mono" style={{ fontSize: '0.72rem', opacity: 0.75 }}>
                    {lang.code.toUpperCase()}
                  </span>
                  <span>{lang.native_name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">
              <span className="row" style={{ gap: 6 }}>
                <Hash size={15} color="#00e599" />
                2. Masukkan 5 Kata Utama Soal Balapan
              </span>
              <span className={`badge ${filledCount === 5 ? 'badge-emerald' : 'badge-slate'}`}>
                {filledCount} / 5 Kata
              </span>
            </div>

            <div className="keywords-grid">
              {keywords.map((kw, idx) => (
                <div key={idx} className={`keyword-slot ${kw.trim() ? 'filled' : ''}`}>
                  <div className="keyword-slot-head">
                    <span>KATA {idx + 1}</span>
                  </div>
                  <input
                    type="text"
                    placeholder={`Kata ${idx + 1}...`}
                    value={kw}
                    maxLength={40}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKeywords((prev) => prev.map((item, i) => (i === idx ? val : item)));
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="preset-row">
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Isi cepat:</span>
              {KEYWORD_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="preset-chip"
                  onClick={() => setKeywords([...p.words])}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row-between" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Durasi otomatis 1 menit • Model AI diatur terpusat oleh Admin.
            </span>
            <button
              type="button"
              className="btn btn-race"
              onClick={handleCreateRoom}
              disabled={!canCreate}
            >
              {creatingRoom ? <span className="spinner" /> : <Swords size={18} />}
              {creatingRoom ? 'MEMBUAT ROOM...' : 'BUAT ROOM 1 MENIT'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
