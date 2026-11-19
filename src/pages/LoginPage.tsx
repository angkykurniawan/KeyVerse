import { useState } from 'react';
import { Eye, EyeOff, Globe, Lock, LogIn, Trophy, Zap } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk ke arena.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        {/* Left Esports Arena Stage */}
        <div className="login-stage">
          <div>
            <div style={{ marginBottom: 22 }}>
              <BrandLogo size="lg" />
            </div>

            <span className="live-tag" style={{ marginBottom: 14 }}>
              <span className="live-dot" />
              COMPETITIVE ARENA READY
            </span>

            <h1 className="page-title" style={{ fontSize: '2.05rem', marginTop: 10 }}>
              ADU KECEPATAN KETIK <span>MULTI-BAHASA</span> BERBASIS AI
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6, fontSize: '0.92rem' }}>
              Masukkan 5 kata utama dari bidang pilihan Anda, biarkan Google AI Studio menghasilkan lintasan kata adaptif, dan kalahkan lawan Pace Bot di papan klasemen!
            </p>
          </div>

          <div className="stack-sm">
            <div
              className="row"
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(6, 8, 15, 0.7)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
              }}
            >
              <Zap size={18} color="#ffb800" />
              <div style={{ fontSize: '0.84rem' }}>
                <strong>Live Race Track & Speedometer WPM</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                  Kombo streak, keyboard interaktif, & pace bot real-time
                </div>
              </div>
            </div>

            <div
              className="row"
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(6, 8, 15, 0.7)',
                border: '1px solid rgba(255, 184, 0, 0.2)',
              }}
            >
              <Globe size={18} color="#00f0ff" />
              <div style={{ fontSize: '0.84rem' }}>
                <strong>Sirkuit Multi-Bahasa & Model AI Dinamis</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                  Pilihan model Gemini otomatis mengikuti API key yang aktif
                </div>
              </div>
            </div>

            <div
              className="row"
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(6, 8, 15, 0.7)',
                border: '1px solid rgba(255, 46, 136, 0.2)',
              }}
            >
              <Trophy size={18} color="#ff2e88" />
              <div style={{ fontSize: '0.84rem' }}>
                <strong>Podium & Klasemen Kejuaraan</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                  Rekor WPM, Tier Rank, dan riwayat tersimpan di database
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="login-form-pane">
          <div style={{ marginBottom: 22 }}>
            <div className="mobile-login-brand" style={{ marginBottom: 16 }}>
              <BrandLogo size="sm" />
            </div>
            <div className="display" style={{ fontSize: '1.35rem', fontWeight: 700, textTransform: 'uppercase' }}>
              RACER CHECK-IN
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 4 }}>
              Masuk untuk memulai pertandingan mengetik di arena KeyVerse.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="stack-md">
            <div className="form-group">
              <label className="form-label" htmlFor="login-identifier">
                Username / Email
              </label>
              <input
                id="login-identifier"
                type="text"
                className="input"
                placeholder="Masukkan username atau email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: 42 }}
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button
              type="submit"
              className="btn btn-race"
              style={{ width: '100%', padding: '13px' }}
              disabled={submitting}
            >
              {submitting ? <span className="spinner" /> : <LogIn size={17} />}
              {submitting ? 'MEMVERIFIKASI...' : 'MASUK KE ARENA'}
            </button>
          </form>

          {/* Demo Account Request Notice */}
          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(0, 240, 255, 0.05)',
              border: '1px solid rgba(0, 240, 255, 0.22)',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              lineHeight: 1.55,
            }}
          >
            <span>Untuk demo minta akun ke </span>
            <a
              href="mailto:kurniawan.angang2005@gmail.com"
              style={{
                color: 'var(--neon-cyan)',
                fontWeight: 600,
                textDecoration: 'underline',
                wordBreak: 'break-all',
              }}
            >
              kurniawan.angang2005@gmail.com
            </a>
          </div>

          <div
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: '0.76rem',
              color: 'var(--text-muted)',
            }}
          >
            <Lock size={13} />
            JWT Secured • KeyVerse Championship Engine
          </div>
        </div>
      </div>
    </div>
  );
}
