import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Flame,
  Globe,
  Hash,
  KeyRound,
  Swords,
  Timer,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { RIVAL_PRESETS } from '../lib/ranks';
import { ResultCard } from '../components/ResultCard';
import { TypingArena } from '../components/TypingArena';
import type {
  GeneratedPassage,
  Language,
  RivalDifficulty,
  TypingResult,
} from '../types';

interface PracticePageProps {
  onOpenAdminAi: () => void;
}

const KEYWORD_PRESETS: { label: string; words: [string, string, string, string, string] }[] = [
  { label: 'Teknologi', words: ['algoritma', 'server', 'enkripsi', 'database', 'jaringan'] },
  { label: 'Medis', words: ['diagnosis', 'terapi', 'vaksin', 'anatomi', 'resep'] },
  { label: 'Bisnis', words: ['investasi', 'strategi', 'negosiasi', 'profit', 'audit'] },
  { label: 'Esports', words: ['turnamen', 'refleks', 'kombo', 'juara', 'arena'] },
];

export function PracticePage({ onOpenAdminAi }: PracticePageProps) {
  const { user, aiReady, refreshAiStatus } = useAuth();

  const [languages, setLanguages] = useState<Language[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(true);
  const [selectedLangId, setSelectedLangId] = useState<number>(0);

  const [keywords, setKeywords] = useState<string[]>(['', '', '', '', '']);
  const [rivalDifficulty, setRivalDifficulty] = useState<RivalDifficulty>('qualifier');

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [passage, setPassage] = useState<GeneratedPassage | null>(null);
  const [result, setResult] = useState<TypingResult | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [savedSession, setSavedSession] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    refreshAiStatus();
  }, [refreshAiStatus]);

  useEffect(() => {
    let active = true;
    setLoadingLanguages(true);
    api
      .getLanguages(false)
      .then((res) => {
        if (!active) return;
        setLanguages(res.languages);
        if (res.languages.length > 0) {
          setSelectedLangId((prev) => prev || res.languages[0].id);
        }
      })
      .catch(() => {
        if (active) setLanguages([]);
      })
      .finally(() => {
        if (active) setLoadingLanguages(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filledCount = keywords.filter((k) => k.trim().length > 0).length;
  const canStart = selectedLangId > 0 && filledCount === 5 && aiReady && !generating;

  const handleGenerate = async () => {
    setGenerateError(null);
    if (filledCount !== 5) {
      setGenerateError('Lengkapi tepat 5 kata utama bidang minat Anda terlebih dahulu.');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.generateTypingText({
        language_id: selectedLangId,
        keywords: keywords.map((k) => k.trim()),
      });
      setPassage(res);
      setResult(null);
      setSavedSession(false);
      setSaveError(null);
    } catch (err) {
      setGenerateError(
        err instanceof ApiError ? err.message : 'Gagal menghasilkan teks tes 1 menit dari Gemini AI.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleTypingComplete = async (typingResult: TypingResult) => {
    setResult(typingResult);
    if (!passage) return;

    setSavingSession(true);
    setSavedSession(false);
    setSaveError(null);
    try {
      await api.saveSession({
        language_id: passage.language.id,
        keywords: passage.keywords,
        ai_model: passage.model_used,
        generated_text: passage.text,
        wpm: typingResult.wpm,
        raw_wpm: typingResult.raw_wpm,
        accuracy: typingResult.accuracy,
        total_chars: typingResult.total_chars,
        correct_chars: typingResult.correct_chars,
        incorrect_chars: typingResult.incorrect_chars,
        word_count: typingResult.word_count,
        duration_seconds: typingResult.duration_seconds,
      });
      setSavedSession(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Gagal menyimpan hasil ke database.');
    } finally {
      setSavingSession(false);
    }
  };

  if (passage && result) {
    return (
      <div className="play-cockpit">
        <ResultCard
          passage={passage}
          result={result}
          saving={savingSession}
          saved={savedSession}
          saveError={saveError}
          onRetrySame={() => {
            setResult(null);
            setSavedSession(false);
            setSaveError(null);
          }}
          onGenerateNew={handleGenerate}
          onBackToSetup={() => {
            setPassage(null);
            setResult(null);
          }}
          regenerating={generating}
        />
      </div>
    );
  }

  if (passage) {
    return (
      <div className="stack-md">
        {generateError && <div className="alert alert-error">{generateError}</div>}
        <TypingArena
          passage={passage}
          rivalDifficulty={rivalDifficulty}
          onComplete={handleTypingComplete}
          onRegenerate={handleGenerate}
          onBackToSetup={() => setPassage(null)}
          regenerating={generating}
        />
      </div>
    );
  }

  return (
    <div className="play-cockpit">
      <div className="cockpit-head">
        <div>
          <h1 className="cockpit-title">
            <Timer size={24} color="#ffb800" />
            TES KECEPATAN MENGETIK <span>1 MENIT</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
            Pilih bahasa, masukkan 5 kata utama bidang minat Anda, lalu mulai tes 60 detik.
          </p>
        </div>

        <span className={`badge ${aiReady ? 'badge-emerald' : 'badge-rose'}`} style={{ padding: '6px 12px' }}>
          {aiReady ? '● AI Generator Siap' : '● AI Belum Diatur Admin'}
        </span>
      </div>

      {!aiReady && (
        <div className="alert alert-warning" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8, flex: 1 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>
              {user?.role === 'admin'
                ? 'API key Google AI Studio belum dikonfigurasi. Atur melalui Admin HQ agar seluruh peserta bisa bermain.'
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

      <div className="card card-arena stack-md">
        {/* 1. Pilih Bahasa */}
        <div className="form-group">
          <div className="form-label">
            <span className="row" style={{ gap: 6 }}>
              <Globe size={15} color="#00f0ff" />
              1. Pilih Bahasa
            </span>
          </div>

          {loadingLanguages ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>Memuat bahasa...</span>
          ) : (
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
          )}
        </div>

        {/* 2. 5 Kata Utama Bidang Minat */}
        <div className="form-group">
          <div className="form-label">
            <span className="row" style={{ gap: 6 }}>
              <Hash size={15} color="#00e599" />
              2. Masukkan 5 Kata Utama Bidang yang Diminati
            </span>
            <span className={`badge ${filledCount === 5 ? 'badge-emerald' : 'badge-slate'}`}>
              {filledCount === 5 ? (
                <>
                  <CheckCircle2 size={12} /> 5/5 Siap
                </>
              ) : (
                `${filledCount} / 5 Kata`
              )}
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
                  placeholder={`Ketik kata ${idx + 1}...`}
                  value={kw}
                  maxLength={40}
                  onChange={(e) => {
                    const val = e.target.value;
                    setKeywords((prev) => prev.map((item, i) => (i === idx ? val : item)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canStart) handleGenerate();
                  }}
                />
              </div>
            ))}
          </div>

          <div className="preset-row">
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Isi cepat:</span>
            {KEYWORD_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="preset-chip"
                onClick={() => setKeywords([...preset.words])}
              >
                <Zap size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Lawan Pace Bot & Mulai Tes 1 Menit */}
        <div
          className="row-between"
          style={{ paddingTop: 14, borderTop: '1px solid var(--border)', gap: 14 }}
        >
          <div className="form-group" style={{ gap: 6 }}>
            <span className="form-label" style={{ fontSize: '0.72rem' }}>
              <span className="row" style={{ gap: 5 }}>
                <Swords size={13} color="#ffb800" /> Lawan Pace Bot (Opsional)
              </span>
            </span>
            <div className="pill-strip">
              {RIVAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`choice-pill ${rivalDifficulty === preset.id ? 'active-gold' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  onClick={() => setRivalDifficulty(preset.id)}
                  title={preset.subtitle}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-race"
            onClick={handleGenerate}
            disabled={!canStart}
          >
            {generating ? <span className="spinner" /> : <Flame size={19} />}
            {generating ? 'MENYIAPKAN SOAL AI...' : 'MULAI TES 1 MENIT'}
          </button>
        </div>

        {generateError && <div className="alert alert-error">{generateError}</div>}
      </div>
    </div>
  );
}
