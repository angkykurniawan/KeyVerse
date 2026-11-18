import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Clock,
  Crown,
  Filter,
  Medal,
  Target,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { getRankTier } from '../lib/ranks';
import { ProgressChart } from '../components/ProgressChart';
import type {
  Language,
  LanguageProgressStat,
  LeaderboardEntry,
  SessionSummary,
  TypingSessionRecord,
} from '../types';

type HistoryView = 'leaderboard' | 'personal';

export function HistoryPage() {
  const [view, setView] = useState<HistoryView>('leaderboard');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [filterLangId, setFilterLangId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<SessionSummary>({
    total_sessions: 0,
    best_wpm: 0,
    avg_wpm: 0,
    avg_accuracy: 0,
    total_words: 0,
    total_duration_seconds: 0,
  });
  const [byLanguage, setByLanguage] = useState<LanguageProgressStat[]>([]);
  const [trend, setTrend] = useState<TypingSessionRecord[]>([]);
  const [sessions, setSessions] = useState<TypingSessionRecord[]>([]);

  const loadData = useCallback(async (langId: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const [sessRes, lbRes] = await Promise.all([
        api.getSessions(langId),
        api.getLeaderboard(langId),
      ]);
      setSummary(sessRes.summary);
      setByLanguage(sessRes.by_language);
      setTrend(sessRes.trend);
      setSessions(sessRes.sessions);
      setLeaderboard(lbRes.leaderboard);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data klasemen & progres.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .getLanguages(false)
      .then((res) => setLanguages(res.languages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData(filterLangId);
  }, [filterLangId, loadData]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Hapus catatan heat ini dari riwayat Anda?')) return;
    try {
      await api.deleteSession(id);
      loadData(filterLangId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus catatan.');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const myTier = getRankTier(summary.best_wpm);
  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="stack-md">
      {/* Header Banner */}
      <div className="hero-banner">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <span className="live-tag">HALL OF SPEED</span>
            <span
              className="badge"
              style={{
                color: myTier.color,
                border: `1px solid ${myTier.color}`,
                background: 'rgba(6, 8, 15, 0.7)',
              }}
            >
              <Award size={12} /> TIER ANDA: {myTier.label}
            </span>
          </div>
          <h1 className="page-title">
            KLASEMEN <span>& TELEMETRI PROGRES</span>
          </h1>
          <p className="page-subtitle">
            Bandingkan rekor WPM Anda di Papan Peringkat Kejuaraan atau pantau kurva kecepatan dan akurasi pribadi.
          </p>
        </div>

        <div className="row">
          <Filter size={16} color="#00f0ff" />
          <select
            className="select"
            style={{ width: 220 }}
            value={filterLangId ?? ''}
            onChange={(e) => setFilterLangId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Semua Sirkuit Bahasa</option>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.native_name} ({l.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* View Switcher */}
      <div className="subtabs">
        <button
          type="button"
          className={`subtab ${view === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setView('leaderboard')}
        >
          <Trophy size={16} />
          Papan Peringkat Kejuaraan ({leaderboard.length})
        </button>
        <button
          type="button"
          className={`subtab ${view === 'personal' ? 'active' : ''}`}
          onClick={() => setView('personal')}
        >
          <BarChart3 size={16} />
          Telemetri & Riwayat Saya ({summary.total_sessions})
        </button>
      </div>

      {loading ? (
        <div className="card empty-state">Memuat data kejuaraan...</div>
      ) : view === 'leaderboard' ? (
        <>
          {/* TOP 3 PODIUM */}
          {top3.length > 0 && (
            <div className="podium-grid">
              {top3.map((entry) => {
                const tier = getRankTier(entry.best_wpm);
                const rankBg =
                  entry.rank === 1
                    ? 'linear-gradient(135deg, #ffd700, #ff8c00)'
                    : entry.rank === 2
                      ? 'linear-gradient(135deg, #00f0ff, #0284c7)'
                      : 'linear-gradient(135deg, #ff2e88, #be185d)';
                return (
                  <div key={entry.user_id} className={`podium-card rank-${entry.rank}`}>
                    <div
                      className="podium-crown"
                      style={{ background: rankBg, color: entry.rank === 3 ? '#fff' : '#06080f' }}
                    >
                      {entry.rank === 1 ? <Crown size={22} /> : <Medal size={20} />}
                    </div>
                    <div className="display" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      POSISI #{entry.rank}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.08rem', marginTop: 4 }}>
                      {entry.name} {entry.is_me && <span className="badge badge-amber">ANDA</span>}
                    </div>
                    <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      @{entry.username}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: '2.1rem',
                        fontWeight: 800,
                        color: entry.rank === 1 ? 'var(--gold)' : entry.rank === 2 ? 'var(--cyan)' : 'var(--magenta)',
                        marginTop: 10,
                      }}
                    >
                      {entry.best_wpm} <span style={{ fontSize: '0.85rem' }}>WPM</span>
                    </div>
                    <div className="row" style={{ justifyContent: 'center', marginTop: 8, gap: 8 }}>
                      <span className="badge badge-emerald">{entry.avg_accuracy}% ACC</span>
                      <span
                        className="badge"
                        style={{ color: tier.color, border: `1px solid ${tier.color}66` }}
                      >
                        {tier.shortLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Standings Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Trophy size={18} color="#ffb800" />
                Klasemen Lengkap Peserta Terdaftar
              </div>
              <span className="badge badge-slate">Diurutkan berdasarkan Rekor WPM</span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="empty-state">
                <h3>Belum ada rekor balapan</h3>
                <p>Selesaikan heat pertama Anda di Arena Lomba untuk merebut posisi #1 di Podium!</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Peserta</th>
                      <th>Tier</th>
                      <th>Rekor WPM</th>
                      <th>Avg WPM</th>
                      <th>Akurasi</th>
                      <th>Total Heat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row) => {
                      const tier = getRankTier(row.best_wpm);
                      return (
                        <tr key={row.user_id} className={row.is_me ? 'is-me-row' : ''}>
                          <td>
                            <span className={`racer-pos ${row.rank <= 3 ? `p${row.rank}` : ''}`}>
                              #{row.rank}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>
                              {row.name}{' '}
                              {row.is_me && (
                                <span className="badge badge-amber" style={{ marginLeft: 4 }}>
                                  ANDA
                                </span>
                              )}
                            </div>
                            <div className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              @{row.username}
                            </div>
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                color: tier.color,
                                border: `1px solid ${tier.color}55`,
                                background: 'rgba(6, 8, 15, 0.5)',
                              }}
                            >
                              {tier.label}
                            </span>
                          </td>
                          <td className="mono" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--gold)' }}>
                            {row.best_wpm} WPM
                          </td>
                          <td className="mono" style={{ color: 'var(--cyan)' }}>
                            {row.avg_wpm}
                          </td>
                          <td className="mono" style={{ color: 'var(--emerald)', fontWeight: 700 }}>
                            {row.avg_accuracy}%
                          </td>
                          <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                            {row.total_races}x
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Personal KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trophy size={13} color="#ffb800" /> REKOR WPM
              </div>
              <div className="kpi-val" style={{ color: 'var(--gold)' }}>
                {summary.best_wpm}
              </div>
              <div className="kpi-sub">Kecepatan puncak pribadi</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={13} color="#00f0ff" /> RATA-RATA WPM
              </div>
              <div className="kpi-val" style={{ color: 'var(--cyan)' }}>
                {summary.avg_wpm}
              </div>
              <div className="kpi-sub">Dari {summary.total_sessions} heat</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Target size={13} color="#00e599" /> RATA-RATA AKURASI
              </div>
              <div className="kpi-val" style={{ color: 'var(--emerald)' }}>
                {summary.avg_accuracy}%
              </div>
              <div className="kpi-sub">Presisi ketikan</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} color="#94a3b8" /> TOTAL KATA
              </div>
              <div className="kpi-val">{summary.total_words}</div>
              <div className="kpi-sub">
                {Math.round(summary.total_duration_seconds / 60)} menit di arena
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <BarChart3 size={18} color="#ffb800" />
                Grafik Perkembangan WPM & Akurasi
              </div>
              <span className="badge badge-slate">30 Heat Terakhir</span>
            </div>
            <ProgressChart sessions={trend} />
          </div>

          {/* Per-Language Stats */}
          {byLanguage.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Statistik Per Sirkuit Bahasa</div>
              </div>
              <div className="kpi-grid">
                {byLanguage.map((item) => (
                  <div
                    key={item.language_id}
                    className="kpi-card"
                    style={{
                      background: 'var(--bg-input)',
                      cursor: 'pointer',
                      borderColor:
                        filterLangId === item.language_id ? 'var(--cyan)' : 'var(--border)',
                    }}
                    onClick={() =>
                      setFilterLangId((prev) => (prev === item.language_id ? null : item.language_id))
                    }
                  >
                    <div className="row-between">
                      <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{item.native_name}</span>
                      <span className="badge badge-slate">{item.sessions} heat</span>
                    </div>
                    <div className="row" style={{ marginTop: 10, gap: 16 }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>AVG WPM</div>
                        <div className="mono" style={{ fontWeight: 700, color: 'var(--gold)' }}>
                          {item.avg_wpm}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>BEST</div>
                        <div className="mono" style={{ fontWeight: 700, color: 'var(--cyan)' }}>
                          {item.best_wpm}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>AKURASI</div>
                        <div className="mono" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                          {item.avg_accuracy}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal History Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Catatan Heat Tersimpan</div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {sessions.length} catatan
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="empty-state">
                <h3>Belum ada catatan heat</h3>
                <p>Masuk ke Arena Lomba dan selesaikan putaran pertama Anda!</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Bahasa</th>
                      <th>5 Kata Misi</th>
                      <th>WPM</th>
                      <th>Akurasi</th>
                      <th>Durasi</th>
                      <th>AI Engine</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {formatDate(s.created_at)}
                        </td>
                        <td>
                          <span className="badge badge-amber">{s.language_native_name}</span>
                        </td>
                        <td>
                          <div className="kw-tags">
                            {s.keywords.map((kw, i) => (
                              <span key={`${s.id}-${i}`} className="kw-tag mono">
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="mono" style={{ fontWeight: 800, color: 'var(--gold)' }}>
                          {s.wpm}
                        </td>
                        <td className="mono" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                          {s.accuracy}%
                        </td>
                        <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                          {s.duration_seconds}s
                        </td>
                        <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--cyan)' }}>
                          {s.ai_model}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => handleDelete(s.id)}
                            title="Hapus catatan"
                            aria-label="Hapus catatan"
                          >
                            <Trash2 size={15} color="#ff6b85" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
