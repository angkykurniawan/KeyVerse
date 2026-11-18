import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  LayoutDashboard,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import type { AdminAiConfig, AdminOverview, AiModel, Language, User } from '../types';

export type AdminTab = 'overview' | 'users' | 'languages' | 'ai';

interface AdminPageProps {
  initialTab?: AdminTab;
}

export function AdminPage({ initialTab = 'users' }: AdminPageProps) {
  const { user: currentUser, refreshAiStatus } = useAuth();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin AI Config state
  const [aiConfig, setAiConfig] = useState<AdminAiConfig | null>(null);
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [aiModelError, setAiModelError] = useState<string | null>(null);
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);
  const [selectedModelPref, setSelectedModelPref] = useState('auto');
  const [savingAi, setSavingAi] = useState(false);

  // User modal state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [uName, setUName] = useState('');
  const [uUsername, setUUsername] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<'user' | 'admin'>('user');
  const [uActive, setUActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  // Language modal state
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editingLang, setEditingLang] = useState<Language | null>(null);
  const [lCode, setLCode] = useState('');
  const [lName, setLName] = useState('');
  const [lNativeName, setLNativeName] = useState('');
  const [lHint, setLHint] = useState('');
  const [lActive, setLActive] = useState(true);
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, usersRes, langsRes, aiRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminUsers(),
        api.getLanguages(true),
        api.getAdminAiConfig(),
      ]);
      setOverview(ovRes.overview);
      setUsers(usersRes.users);
      setLanguages(langsRes.languages);
      setAiConfig(aiRes.config);
      setAiModels(aiRes.models);
      setAiModelError(aiRes.model_error);
      setSelectedModelPref(aiRes.config.preferred_model || 'auto');
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal memuat data admin.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // --- Admin AI Config Handlers ---
  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAi(true);
    setFeedback(null);
    try {
      const payload: { api_key?: string; preferred_model?: string } = {
        preferred_model: selectedModelPref,
      };
      if (aiKeyInput.trim()) {
        payload.api_key = aiKeyInput.trim();
      }
      const res = await api.saveAdminAiConfig(payload);
      setAiConfig(res.config);
      setAiModels(res.models);
      setAiModelError(res.model_error);
      setSelectedModelPref(res.config.preferred_model || 'auto');
      setAiKeyInput('');
      setFeedback({ type: 'success', message: res.message });
      await refreshAiStatus();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal menyimpan konfigurasi AI.',
      });
    } finally {
      setSavingAi(false);
    }
  };

  const handleResetAiToEnv = async () => {
    if (!window.confirm('Hapus API key khusus dari database dan kembali menggunakan GEMINI_API_KEY di .env?')) {
      return;
    }
    setSavingAi(true);
    setFeedback(null);
    try {
      const res = await api.saveAdminAiConfig({ reset_to_env: true });
      setAiConfig(res.config);
      setAiModels(res.models);
      setAiModelError(res.model_error);
      setSelectedModelPref(res.config.preferred_model || 'auto');
      setAiKeyInput('');
      setFeedback({ type: 'success', message: res.message });
      await refreshAiStatus();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal mereset API key.',
      });
    } finally {
      setSavingAi(false);
    }
  };

  const handleRefreshAiModels = async () => {
    setSavingAi(true);
    setFeedback(null);
    try {
      const res = await api.getAdminAiConfig();
      setAiConfig(res.config);
      setAiModels(res.models);
      setAiModelError(res.model_error);
      setSelectedModelPref(res.config.preferred_model || 'auto');
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal memuat ulang model.',
      });
    } finally {
      setSavingAi(false);
    }
  };

  // --- User Modal Handlers ---
  const openCreateUser = () => {
    setEditingUser(null);
    setUName('');
    setUUsername('');
    setUEmail('');
    setUPassword('');
    setURole('user');
    setUActive(true);
    setUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUName(u.name);
    setUUsername(u.username);
    setUEmail(u.email);
    setUPassword('');
    setURole(u.role);
    setUActive(u.is_active);
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    setFeedback(null);
    try {
      if (editingUser) {
        const res = await api.updateUser(editingUser.id, {
          name: uName.trim(),
          username: uUsername.trim(),
          email: uEmail.trim(),
          role: uRole,
          is_active: uActive,
          ...(uPassword.trim() ? { password: uPassword } : {}),
        });
        setFeedback({ type: 'success', message: res.message });
      } else {
        const res = await api.createUser({
          name: uName.trim(),
          username: uUsername.trim(),
          email: uEmail.trim(),
          password: uPassword,
          role: uRole,
          is_active: uActive,
        });
        setFeedback({ type: 'success', message: res.message });
      }
      setUserModalOpen(false);
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal menyimpan pengguna.',
      });
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (!window.confirm(`Hapus pengguna "${u.name}" (${u.username})? Seluruh riwayat latihannya juga akan terhapus.`)) {
      return;
    }
    setFeedback(null);
    try {
      const res = await api.deleteUser(u.id);
      setFeedback({ type: 'success', message: res.message });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal menghapus pengguna.',
      });
    }
  };

  // --- Language Modal Handlers ---
  const openCreateLang = () => {
    setEditingLang(null);
    setLCode('');
    setLName('');
    setLNativeName('');
    setLHint('');
    setLActive(true);
    setLangModalOpen(true);
  };

  const openEditLang = (l: Language) => {
    setEditingLang(l);
    setLCode(l.code);
    setLName(l.name);
    setLNativeName(l.native_name);
    setLHint(l.prompt_hint || '');
    setLActive(l.is_active);
    setLangModalOpen(true);
  };

  const handleSaveLang = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLang(true);
    setFeedback(null);
    try {
      if (editingLang) {
        const res = await api.updateLanguage(editingLang.id, {
          code: lCode.trim(),
          name: lName.trim(),
          native_name: lNativeName.trim() || lName.trim(),
          prompt_hint: lHint.trim(),
          is_active: lActive,
        });
        setFeedback({ type: 'success', message: res.message });
      } else {
        const res = await api.createLanguage({
          code: lCode.trim(),
          name: lName.trim(),
          native_name: lNativeName.trim() || lName.trim(),
          prompt_hint: lHint.trim(),
          is_active: lActive,
        });
        setFeedback({ type: 'success', message: res.message });
      }
      setLangModalOpen(false);
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal menyimpan bahasa.',
      });
    } finally {
      setSavingLang(false);
    }
  };

  const handleToggleLangActive = async (l: Language) => {
    setFeedback(null);
    try {
      await api.updateLanguage(l.id, { is_active: !l.is_active });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal mengubah status bahasa.',
      });
    }
  };

  const handleDeleteLang = async (l: Language) => {
    if (!window.confirm(`Hapus bahasa "${l.native_name}"?`)) return;
    setFeedback(null);
    try {
      const res = await api.deleteLanguage(l.id);
      setFeedback({ type: 'success', message: res.message });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Gagal menghapus bahasa.',
      });
    }
  };

  return (
    <div className="stack-md">
      <div className="hero-banner">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <span className="live-tag">ADMIN HQ</span>
            <span className="badge badge-amber">TOURNAMENT CONTROL</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={28} color="#ffb800" />
            PUSAT KENDALI <span>ADMINISTRATOR</span>
          </h1>
          <p className="page-subtitle">
            Kelola pendaftaran peserta, sirkuit multi-bahasa, serta konfigurasi Google AI Studio API Key & model untuk seluruh sistem.
          </p>
        </div>

        <div className="row">
          <button type="button" className="btn btn-primary" onClick={openCreateUser}>
            <UserPlus size={16} />
            Daftarkan Peserta
          </button>
          <button type="button" className="btn btn-cyan" onClick={openCreateLang}>
            <Plus size={16} />
            Tambah Bahasa
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="subtabs">
        <button
          type="button"
          className={`subtab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          <Users size={16} />
          Kelola Pengguna ({users.length})
        </button>
        <button
          type="button"
          className={`subtab ${tab === 'languages' ? 'active' : ''}`}
          onClick={() => setTab('languages')}
        >
          <Globe size={16} />
          Kelola Bahasa ({languages.length})
        </button>
        <button
          type="button"
          className={`subtab ${tab === 'ai' ? 'active' : ''}`}
          onClick={() => setTab('ai')}
        >
          <KeyRound size={16} />
          Konfigurasi AI & API Key
          {!aiConfig?.has_api_key && (
            <span className="badge badge-rose" style={{ marginLeft: 4 }}>
              Belum Diatur
            </span>
          )}
        </button>
        <button
          type="button"
          className={`subtab ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <LayoutDashboard size={16} />
          Ringkasan
        </button>
      </div>

      {loading ? (
        <div className="card empty-state">Memuat data administrator...</div>
      ) : (
        <>
          {/* TAB: KONFIGURASI AI & API KEY (ADMIN ONLY) */}
          {tab === 'ai' && (
            <div className="card card-arena stack-md">
              <div className="card-header" style={{ marginBottom: 4 }}>
                <div className="card-title">
                  <KeyRound size={19} color="#00f0ff" />
                  Pengaturan Google AI Studio API Key & Model (Global)
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRefreshAiModels}
                  disabled={savingAi}
                >
                  <RefreshCw size={14} className={savingAi ? 'spinner' : ''} />
                  Refresh Daftar Model
                </button>
              </div>

              <div className={`alert ${aiConfig?.has_api_key ? 'alert-success' : 'alert-warning'}`}>
                <Sparkles size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Status API Key Aktif:</strong>{' '}
                  {aiConfig?.key_source === 'admin_db' && (
                    <>
                      Menggunakan API Key tersimpan dari <strong>Admin HQ (terenkripsi)</strong> —{' '}
                      <span className="mono">{aiConfig.masked_key}</span>. Berlaku untuk seluruh peserta.
                    </>
                  )}
                  {aiConfig?.key_source === 'server_env' && (
                    <>
                      Menggunakan <strong>GEMINI_API_KEY dari file .env</strong> —{' '}
                      <span className="mono">{aiConfig.masked_key}</span>. Berlaku untuk seluruh peserta.
                    </>
                  )}
                  {(!aiConfig || aiConfig.key_source === 'none') && (
                    <>
                      Belum ada API key yang diatur di Admin HQ maupun file <span className="mono">.env</span>.
                      Peserta belum dapat memulai tes sampai API key dimasukkan.
                    </>
                  )}
                </div>
              </div>

              {aiModelError && <div className="alert alert-error">Gagal memuat daftar model: {aiModelError}</div>}

              <form onSubmit={handleSaveAiConfig} className="stack-md">
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-gemini-key">
                    <span>
                      {aiConfig?.has_api_key
                        ? 'Ganti API Key Google AI Studio (kosongkan jika hanya mengubah pilihan model)'
                        : 'Masukkan API Key Google AI Studio'}
                    </span>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#00f0ff', textDecoration: 'none' }}
                    >
                      Buka Google AI Studio ↗
                    </a>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="admin-gemini-key"
                      type={showAiKey ? 'text' : 'password'}
                      className="input mono"
                      style={{ paddingRight: 42 }}
                      placeholder={aiConfig?.masked_key ? `Aktif: ${aiConfig.masked_key}` : 'AIzaSy...'}
                      value={aiKeyInput}
                      onChange={(e) => setAiKeyInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => setShowAiKey((s) => !s)}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                      aria-label="Tampilkan atau sembunyikan API key"
                    >
                      {showAiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    API key disimpan terenkripsi AES-256 di database (atau gunakan GEMINI_API_KEY di .env). User biasa tidak dapat melihat maupun mengubah API key.
                  </span>
                </div>

                {/* Pilihan Model sesuai yang tersedia pada API Key */}
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-ai-model">
                    <span className="row" style={{ gap: 6 }}>
                      <Cpu size={15} color="#ffb800" />
                      Model AI yang Digunakan (Tergantung API Key Aktif — {aiModels.length} model ditemukan)
                    </span>
                  </label>
                  <select
                    id="admin-ai-model"
                    className="select mono"
                    value={selectedModelPref}
                    onChange={(e) => setSelectedModelPref(e.target.value)}
                    disabled={aiModels.length === 0 && !aiKeyInput.trim()}
                  >
                    <option value="auto">
                      Otomatis — Rekomendasi Terbaik {aiModels[0] ? `(${aiModels[0].id})` : '(sesuai API key)'}
                    </option>
                    {aiModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id} — {m.display_name} {m.recommended ? '★' : ''}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Mode <strong>Otomatis</strong> akan memilih model aktif terbaru dari API key dan otomatis berpindah ke model cadangan jika suatu model limit/tidak tersedia.
                  </span>
                </div>

                <div className="row-between" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div>
                    {aiConfig?.key_source === 'admin_db' && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleResetAiToEnv}
                        disabled={savingAi}
                      >
                        <RotateCcw size={15} />
                        Kembali ke Default .env
                      </button>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={savingAi}>
                    {savingAi ? <span className="spinner" /> : <CheckCircle2 size={16} />}
                    {savingAi ? 'Memverifikasi & Menyimpan...' : 'Verifikasi & Simpan Konfigurasi AI'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: RINGKASAN */}
          {tab === 'overview' && overview && (
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Total Pengguna</div>
                <div className="kpi-val">{overview.total_users}</div>
                <div className="kpi-sub">
                  {overview.active_users} aktif • {overview.learner_count} peserta
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Bahasa Tersedia</div>
                <div className="kpi-val" style={{ color: 'var(--cyan)' }}>
                  {overview.active_languages}
                </div>
                <div className="kpi-sub">dari {overview.total_languages} total bahasa</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Total Sesi Latihan</div>
                <div className="kpi-val" style={{ color: 'var(--emerald)' }}>
                  {overview.total_sessions}
                </div>
                <div className="kpi-sub">Tercatat di database</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Rata-rata / Rekor WPM</div>
                <div className="kpi-val" style={{ color: 'var(--gold)' }}>
                  {overview.avg_wpm}
                </div>
                <div className="kpi-sub">
                  Rekor: {overview.best_wpm} WPM • Akurasi {overview.avg_accuracy}%
                </div>
              </div>
            </div>
          )}

          {/* TAB: KELOLA PENGGUNA */}
          {tab === 'users' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Daftar Akun Pengguna</div>
                <button type="button" className="btn btn-primary btn-sm" onClick={openCreateUser}>
                  <UserPlus size={15} />
                  Daftarkan User Baru
                </button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama & Email</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Latihan</th>
                      <th>Avg WPM</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {u.email}
                          </div>
                        </td>
                        <td className="mono">{u.username}</td>
                        <td>
                          <span className={`role-badge ${u.role}`}>{u.role}</span>
                        </td>
                        <td>
                          <span className={`badge ${u.is_active ? 'badge-emerald' : 'badge-rose'}`}>
                            {u.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="mono">{u.session_count ?? 0} sesi</td>
                        <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>
                          {u.avg_wpm ?? 0}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditUser(u)}
                            >
                              <Edit3 size={13} />
                              Edit
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteUser(u)}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: KELOLA BAHASA */}
          {tab === 'languages' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Bahasa Latihan Mengetik</div>
                <button type="button" className="btn btn-primary btn-sm" onClick={openCreateLang}>
                  <Plus size={15} />
                  Tambah Bahasa
                </button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Nama Bahasa</th>
                      <th>Panduan Prompt AI</th>
                      <th>Sesi</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {languages.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <span className="badge badge-cyan mono">{l.code}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{l.native_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {l.name}
                          </div>
                        </td>
                        <td style={{ maxWidth: 320, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {l.prompt_hint || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="mono">{l.session_count ?? 0}</td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${l.is_active ? 'badge-emerald' : 'badge-rose'}`}
                            style={{ border: 'none', cursor: 'pointer' }}
                            onClick={() => handleToggleLangActive(l)}
                            title="Klik untuk ubah status aktif"
                          >
                            {l.is_active ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditLang(l)}
                            >
                              <Edit3 size={13} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteLang(l)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Tambah / Edit User */}
      {userModalOpen && (
        <div className="modal-backdrop" onClick={() => setUserModalOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <UserPlus size={19} color="#ffb800" />
                {editingUser ? `Edit Pengguna: ${editingUser.username}` : 'Daftarkan Pengguna Baru'}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setUserModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="stack-md">
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input
                  type="text"
                  className="input"
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  placeholder="Contoh: Nadia Pratama"
                  required
                />
              </div>

              <div className="setup-grid">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="input mono"
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    placeholder="nadia.pratama"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="select"
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as 'user' | 'admin')}
                  >
                    <option value="user">User (Peserta)</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  placeholder="nadia@contoh.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {editingUser ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password (min. 6 karakter)'}
                </label>
                <input
                  type="password"
                  className="input"
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'Masukkan password awal'}
                  required={!editingUser}
                  minLength={editingUser ? 0 : 6}
                />
              </div>

              <label className="row" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={uActive}
                  onChange={(e) => setUActive(e.target.checked)}
                />
                Akun aktif (dapat login dan berlatih)
              </label>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setUserModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingUser}>
                  {savingUser ? <span className="spinner" /> : null}
                  {editingUser ? 'Simpan Perubahan' : 'Daftarkan Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Bahasa */}
      {langModalOpen && (
        <div className="modal-backdrop" onClick={() => setLangModalOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Globe size={19} color="#00f0ff" />
                {editingLang ? `Edit Bahasa: ${editingLang.native_name}` : 'Tambah Bahasa Baru'}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setLangModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLang} className="stack-md">
              <div className="setup-grid">
                <div className="form-group">
                  <label className="form-label">Kode Bahasa</label>
                  <input
                    type="text"
                    className="input mono"
                    value={lCode}
                    onChange={(e) => setLCode(e.target.value)}
                    placeholder="fr, ko-romaji, ar-latin"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nama (Inggris / AI)</label>
                  <input
                    type="text"
                    className="input"
                    value={lName}
                    onChange={(e) => setLName(e.target.value)}
                    placeholder="French"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Tampilan (Native)</label>
                <input
                  type="text"
                  className="input"
                  value={lNativeName}
                  onChange={(e) => setLNativeName(e.target.value)}
                  placeholder="Français"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Petunjuk Gaya Prompt AI (Opsional)</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={lHint}
                  onChange={(e) => setLHint(e.target.value)}
                  placeholder="Contoh: Gunakan kalimat formal sehari-hari yang jelas dan mudah diketik."
                />
              </div>

              <label className="row" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={lActive}
                  onChange={(e) => setLActive(e.target.checked)}
                />
                Aktifkan bahasa agar dapat dipilih oleh pengguna
              </label>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setLangModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingLang}>
                  {savingLang ? <span className="spinner" /> : null}
                  {editingLang ? 'Simpan Perubahan' : 'Tambah Bahasa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
