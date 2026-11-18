import {
  Award,
  CheckCircle2,
  Clock,
  Flame,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { getRankTier } from '../lib/ranks';
import type { GeneratedPassage, TypingResult } from '../types';

interface ResultCardProps {
  passage: GeneratedPassage;
  result: TypingResult;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  onRetrySame: () => void;
  onGenerateNew: () => void;
  onBackToSetup: () => void;
  regenerating: boolean;
}

export function ResultCard({
  passage,
  result,
  saving,
  saved,
  saveError,
  onRetrySame,
  onGenerateNew,
  onBackToSetup,
  regenerating,
}: ResultCardProps) {
  const rankTier = getRankTier(result.wpm);
  const placeLabel =
    result.total_racers === 1
      ? 'TIME TRIAL SELESAI!'
      : result.placement === 1
        ? 'JUARA #1 HEAT INI!'
        : `FINISH POSISI #${result.placement}`;

  const points =
    result.timeline.length >= 2
      ? result.timeline
      : [
          { sec: 0, wpm: 0 },
          { sec: 1, wpm: Math.round(result.wpm) },
        ];
  const maxWpm = Math.max(30, ...points.map((p) => p.wpm));
  const width = 560;
  const height = 120;
  const padX = 14;
  const padY = 14;

  const coords = points.map((pt, idx) => {
    const x = padX + (idx / Math.max(1, points.length - 1)) * (width - padX * 2);
    const y = height - padY - (pt.wpm / maxWpm) * (height - padY * 2);
    return { x, y, ...pt };
  });

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${coords[0].x.toFixed(1)},${height - padY} ${polyline} ${coords[coords.length - 1].x.toFixed(1)},${height - padY}`;

  return (
    <div className="stack-md">
      {/* Victory Stage Banner */}
      <div className="victory-banner">
        <div className="row" style={{ gap: 16 }}>
          <div className={`placement-emblem p${Math.min(3, result.placement)}`}>
            <Trophy size={22} />
            <span style={{ fontSize: '1.15rem', marginTop: 2 }}>#{result.placement}</span>
          </div>

          <div>
            <div className="row" style={{ gap: 8 }}>
              <span className="live-tag" style={{ background: 'rgba(0, 229, 153, 0.16)', borderColor: 'rgba(0, 229, 153, 0.5)', color: '#00e599' }}>
                FINISH LINE
              </span>
              <span className="badge badge-cyan mono">{passage.model_used}</span>
            </div>
            <h2 className="page-title" style={{ marginTop: 6, fontSize: '1.65rem' }}>
              {placeLabel}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 2 }}>
              Arena <strong>{passage.language.native_name}</strong> • {result.word_count} kata selesai dalam{' '}
              <strong className="mono">{result.duration_seconds}s</strong>
            </p>
          </div>
        </div>

        <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
          <div
            className="rank-tier-pill"
            style={{ color: rankTier.color, boxShadow: `0 0 24px ${rankTier.glow}` }}
          >
            <Award size={18} />
            TIER: {rankTier.label}
          </div>
          {saving && (
            <span className="badge badge-cyan">
              <span className="spinner" style={{ width: 12, height: 12 }} />
              Mencatat ke Klasemen...
            </span>
          )}
          {saved && !saving && (
            <span className="badge badge-emerald">
              <CheckCircle2 size={14} />
              Tersimpan ke Database & Klasemen
            </span>
          )}
        </div>
      </div>

      {saveError && <div className="alert alert-error">{saveError}</div>}

      {/* Telemetry Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderColor: 'rgba(255, 184, 0, 0.4)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap size={14} color="#ffb800" /> NET WPM
          </div>
          <div className="kpi-val" style={{ color: 'var(--gold)', fontSize: '2.2rem' }}>
            {result.wpm}
          </div>
          <div className="kpi-sub">Raw Speed: {result.raw_wpm} WPM</div>
        </div>

        <div className="kpi-card" style={{ borderColor: 'rgba(0, 229, 153, 0.35)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Target size={14} color="#00e599" /> AKURASI
          </div>
          <div className="kpi-val" style={{ color: 'var(--emerald)', fontSize: '2.2rem' }}>
            {result.accuracy}%
          </div>
          <div className="kpi-sub">
            Benar {result.correct_chars} • Salah {result.incorrect_chars}
          </div>
        </div>

        <div className="kpi-card" style={{ borderColor: 'rgba(255, 46, 136, 0.35)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Flame size={14} color="#ff2e88" /> MAX COMBO
          </div>
          <div className="kpi-val" style={{ color: 'var(--magenta)', fontSize: '2.2rem' }}>
            {result.max_combo}x
          </div>
          <div className="kpi-sub">Rentetan huruf sempurna</div>
        </div>

        <div className="kpi-card" style={{ borderColor: 'rgba(0, 240, 255, 0.35)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={14} color="#00f0ff" /> WAKTU TEMPUH
          </div>
          <div className="kpi-val" style={{ color: 'var(--cyan)', fontSize: '2.2rem' }}>
            {result.duration_seconds}s
          </div>
          <div className="kpi-sub">{result.total_chars} total karakter</div>
        </div>
      </div>

      {/* Telemetry Speed Curve */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="display" style={{ fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Telemetri Kecepatan Heat (WPM / Detik)
          </span>
          <span className="badge badge-amber mono">
            PEAK: {Math.max(...points.map((p) => p.wpm))} WPM
          </span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 120, display: 'block' }}>
          <defs>
            <linearGradient id="sessionWpmGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#sessionWpmGrad)" />
          <polyline
            fill="none"
            stroke="#00f0ff"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
          {coords.map((c, idx) => (
            <circle key={idx} cx={c.x} cy={c.y} r="3.4" fill="#ffb800" stroke="#06080f" strokeWidth="1" />
          ))}
        </svg>

        <div className="row-between" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="kw-tags">
            <span className="display" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 4 }}>
              5 KATA MISI:
            </span>
            {passage.keywords.map((kw, i) => (
              <span key={`${kw}-${i}`} className="kw-tag mono">
                #{kw}
              </span>
            ))}
          </div>

          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={onRetrySame}>
              <RotateCcw size={16} />
              Rematch Teks Ini
            </button>
            <button type="button" className="btn btn-race" onClick={onGenerateNew} disabled={regenerating}>
              {regenerating ? <span className="spinner" /> : <Sparkles size={17} />}
              Heat Baru (AI Generate)
            </button>
            <button type="button" className="btn btn-ghost" onClick={onBackToSetup}>
              Kembali ke Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
