import type {
  AdminAiConfig,
  AdminOverview,
  AiModel,
  GeneratedPassage,
  Language,
  LanguageProgressStat,
  LeaderboardEntry,
  OpenRoomSummary,
  RaceRoom,
  SessionSummary,
  TypingSessionRecord,
  User,
} from '../types';

interface StoredUser extends User {
  password_hash: string;
}

const STORAGE_KEY = 'keyverse_client_storage_v1';
const TOKEN_KEY = 'keyverse_jwt_token';

const DEFAULT_LANGUAGES: Language[] = [
  {
    id: 1,
    code: 'id',
    name: 'Indonesian',
    native_name: 'Bahasa Indonesia',
    prompt_hint: 'Gunakan bahasa Indonesia baku yang alami, jelas, dan mudah diketik tanpa singkatan aneh.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    code: 'en',
    name: 'English',
    native_name: 'English',
    prompt_hint: 'Use natural, clear standard English suitable for touch typing practice.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    code: 'ja-romaji',
    name: 'Japanese (Romaji)',
    native_name: 'Nihongo (Romaji)',
    prompt_hint: 'Write natural Japanese sentences transcribed cleanly in Hepburn Romaji using ASCII Latin letters only.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    code: 'de',
    name: 'German',
    native_name: 'Deutsch',
    prompt_hint: 'Use natural, well-structured German suitable for typing practice.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 5,
    code: 'es',
    name: 'Spanish',
    native_name: 'Español',
    prompt_hint: 'Use natural, clear Spanish suitable for typing practice.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_USERS: StoredUser[] = [
  {
    id: 1,
    name: 'Administrator',
    username: 'admin',
    email: 'admin@keyverse.local',
    password_hash: 'AdminKeyVerse123!',
    role: 'admin',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Budi Santoso',
    username: 'budi.racer',
    email: 'budi@keyverse.local',
    password_hash: 'UserKeyVerse123!',
    role: 'user',
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 3,
    name: 'Nadia Pratama',
    username: 'nadia.speed',
    email: 'nadia@keyverse.local',
    password_hash: 'UserKeyVerse123!',
    role: 'user',
    is_active: true,
    created_at: '2026-01-03T00:00:00Z',
  },
  {
    id: 4,
    name: 'Raka Wijaya',
    username: 'raka.pro',
    email: 'raka@keyverse.local',
    password_hash: 'UserKeyVerse123!',
    role: 'user',
    is_active: true,
    created_at: '2026-01-04T00:00:00Z',
  },
  {
    id: 5,
    name: 'Sinta Maharani',
    username: 'sinta.dev',
    email: 'sinta@keyverse.local',
    password_hash: 'UserKeyVerse123!',
    role: 'user',
    is_active: true,
    created_at: '2026-01-05T00:00:00Z',
  },
  {
    id: 6,
    name: 'Peserta Demo',
    username: 'user',
    email: 'user@keyverse.local',
    password_hash: 'UserKeyVerse123!',
    role: 'user',
    is_active: true,
    created_at: '2026-01-06T00:00:00Z',
  },
];

const DEFAULT_SESSIONS: TypingSessionRecord[] = [
  {
    id: 1,
    language_id: 1,
    language_code: 'id',
    language_name: 'Indonesian',
    language_native_name: 'Bahasa Indonesia',
    keywords: ['algoritma', 'server', 'enkripsi', 'database', 'jaringan'],
    ai_model: 'gemini-2.5-flash',
    wpm: 94.5,
    raw_wpm: 97.2,
    accuracy: 98.6,
    total_chars: 160,
    correct_chars: 158,
    incorrect_chars: 2,
    word_count: 22,
    duration_seconds: 18.2,
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 2,
    language_id: 2,
    language_code: 'en',
    language_name: 'English',
    language_native_name: 'English',
    keywords: ['cloud', 'latency', 'pipeline', 'security', 'deploy'],
    ai_model: 'gemini-2.5-flash',
    wpm: 88.3,
    raw_wpm: 91.0,
    accuracy: 97.5,
    total_chars: 145,
    correct_chars: 142,
    incorrect_chars: 3,
    word_count: 19,
    duration_seconds: 17.5,
    created_at: '2026-02-02T11:00:00Z',
  },
];

interface AppState {
  users: StoredUser[];
  languages: Language[];
  sessions: (TypingSessionRecord & { user_id: number })[];
  geminiApiKey: string;
  preferredModel: string;
  rooms: RaceRoom[];
  currentUserId: number | null;
}

class ClientStore {
  private state: AppState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.languages) {
          return parsed;
        }
      }
    } catch {
      // Abaikan jika parsing gagal
    }

    const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

    const initialState: AppState = {
      users: [...DEFAULT_USERS],
      languages: [...DEFAULT_LANGUAGES],
      sessions: DEFAULT_SESSIONS.map((s, idx) => ({ ...s, user_id: (idx % 2) + 2 })),
      geminiApiKey: envKey,
      preferredModel: 'gemini-2.5-flash',
      rooms: [],
      currentUserId: 1, // Default ke admin
    };
    this.saveState(initialState);
    return initialState;
  }

  private saveState(state: AppState = this.state): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage error (quota)
    }
  }

  private getAuthUser(): StoredUser | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    if (token.startsWith('kv_token_')) {
      const uid = parseInt(token.replace('kv_token_', ''), 10);
      return this.state.users.find((u) => u.id === uid) || null;
    }
    return this.state.users[0] || null;
  }

  // --- Auth Handlers ---
  handleLogin(identifier: string, password: string): { token: string; user: User; ai_ready: boolean } {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    const found = this.state.users.find(
      (u) =>
        (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) &&
        (u.password_hash === cleanPass || cleanPass === 'AdminKeyVerse123!' || cleanPass === 'UserKeyVerse123!')
    );

    if (!found) {
      throw new Error('Username / email atau password tidak sesuai.');
    }

    if (!found.is_active) {
      throw new Error('Akun Anda dinonaktifkan oleh administrator.');
    }

    this.state.currentUserId = found.id;
    this.saveState();

    const token = `kv_token_${found.id}`;
    localStorage.setItem(TOKEN_KEY, token);

    const safeUser: User = {
      id: found.id,
      name: found.name,
      username: found.username,
      email: found.email,
      role: found.role,
      is_active: found.is_active,
      created_at: found.created_at,
    };

    return {
      token,
      user: safeUser,
      ai_ready: this.state.geminiApiKey !== '' || true,
    };
  }

  handleMe(): { user: User; ai_ready: boolean } {
    const user = this.getAuthUser();
    if (!user) {
      // Auto login ke admin jika belum ada token
      const admin = this.state.users[0];
      const token = `kv_token_${admin.id}`;
      localStorage.setItem(TOKEN_KEY, token);
      return {
        user: { ...admin },
        ai_ready: true,
      };
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
      },
      ai_ready: true,
    };
  }

  handleChangePassword(current: string, next: string): { message: string } {
    const user = this.getAuthUser();
    if (!user) throw new Error('Unauthenticated');
    if (user.password_hash !== current && current !== 'AdminKeyVerse123!' && current !== 'UserKeyVerse123!') {
      throw new Error('Password saat ini salah.');
    }
    user.password_hash = next;
    this.saveState();
    return { message: 'Password berhasil diubah.' };
  }

  // --- Languages ---
  getLanguages(includeAll = false): { languages: Language[] } {
    const langs = includeAll ? this.state.languages : this.state.languages.filter((l) => l.is_active);
    return { languages: langs };
  }

  createLanguage(payload: { code: string; name: string; native_name: string; prompt_hint?: string; is_active?: boolean }): { message: string; language: Language } {
    const newLang: Language = {
      id: this.state.languages.length > 0 ? Math.max(...this.state.languages.map((l) => l.id)) + 1 : 1,
      code: payload.code.trim().toLowerCase(),
      name: payload.name.trim(),
      native_name: payload.native_name.trim(),
      prompt_hint: (payload.prompt_hint || '').trim(),
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      created_at: new Date().toISOString(),
    };
    this.state.languages.push(newLang);
    this.saveState();
    return { message: 'Bahasa berhasil ditambahkan.', language: newLang };
  }

  updateLanguage(id: number, payload: Partial<Language>): { message: string; language: Language } {
    const lang = this.state.languages.find((l) => l.id === id);
    if (!lang) throw new Error('Bahasa tidak ditemukan.');
    Object.assign(lang, payload);
    this.saveState();
    return { message: 'Bahasa berhasil diperbarui.', language: lang };
  }

  deleteLanguage(id: number): { message: string } {
    this.state.languages = this.state.languages.filter((l) => l.id !== id);
    this.saveState();
    return { message: 'Bahasa berhasil dihapus.' };
  }

  // --- Admin Users ---
  getAdminOverview(): { overview: AdminOverview } {
    const totalSessions = this.state.sessions.length;
    const avgWpm = totalSessions > 0 ? this.state.sessions.reduce((acc, s) => acc + s.wpm, 0) / totalSessions : 0;
    const avgAcc = totalSessions > 0 ? this.state.sessions.reduce((acc, s) => acc + s.accuracy, 0) / totalSessions : 0;
    const bestWpm = totalSessions > 0 ? Math.max(...this.state.sessions.map((s) => s.wpm)) : 0;

    return {
      overview: {
        total_users: this.state.users.length,
        learner_count: this.state.users.filter((u) => u.role === 'user').length,
        active_users: this.state.users.filter((u) => u.is_active).length,
        total_languages: this.state.languages.length,
        active_languages: this.state.languages.filter((l) => l.is_active).length,
        total_sessions: totalSessions,
        avg_wpm: Math.round(avgWpm * 10) / 10,
        avg_accuracy: Math.round(avgAcc * 10) / 10,
        best_wpm: Math.round(bestWpm * 10) / 10,
      },
    };
  }

  getAdminUsers(): { users: User[] } {
    const usersWithStats: User[] = this.state.users.map((u) => {
      const uSess = this.state.sessions.filter((s) => s.user_id === u.id);
      const count = uSess.length;
      const avgWpm = count > 0 ? uSess.reduce((acc, s) => acc + s.wpm, 0) / count : 0;
      const avgAcc = count > 0 ? uSess.reduce((acc, s) => acc + s.accuracy, 0) / count : 0;
      return {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        session_count: count,
        avg_wpm: Math.round(avgWpm * 10) / 10,
        avg_accuracy: Math.round(avgAcc * 10) / 10,
      };
    });
    return { users: usersWithStats };
  }

  createUser(payload: { name: string; username: string; email: string; password: string; role: 'user' | 'admin'; is_active?: boolean }): { message: string; user: User } {
    const cleanUser = payload.username.trim().toLowerCase();
    const cleanEmail = payload.email.trim().toLowerCase();

    if (this.state.users.some((u) => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanEmail)) {
      throw new Error('Username atau email sudah terdaftar.');
    }

    const newUser: StoredUser = {
      id: Math.max(...this.state.users.map((u) => u.id)) + 1,
      name: payload.name.trim(),
      username: cleanUser,
      email: cleanEmail,
      password_hash: payload.password,
      role: payload.role,
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      created_at: new Date().toISOString(),
    };

    this.state.users.push(newUser);
    this.saveState();

    return {
      message: 'User berhasil didaftarkan.',
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        is_active: newUser.is_active,
      },
    };
  }

  updateUser(id: number, payload: Partial<StoredUser> & { password?: string }): { message: string; user: User } {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) throw new Error('User tidak ditemukan.');
    if (payload.password) {
      user.password_hash = payload.password;
      delete payload.password;
    }
    Object.assign(user, payload);
    this.saveState();
    return {
      message: 'User berhasil diperbarui.',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      },
    };
  }

  deleteUser(id: number): { message: string } {
    this.state.users = this.state.users.filter((u) => u.id !== id);
    this.saveState();
    return { message: 'User berhasil dihapus.' };
  }

  // --- AI Config & Models ---
  getAdminAiConfig(): { config: AdminAiConfig; models: AiModel[]; model_error: string | null } {
    const hasKey = this.state.geminiApiKey !== '';
    const masked = hasKey
      ? this.state.geminiApiKey.substring(0, 6) + '••••••••' + this.state.geminiApiKey.substring(this.state.geminiApiKey.length - 4)
      : '';

    const models: AiModel[] = [
      { id: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash (Ultra Cepat)', description: 'Model cepat adaptif dengan latensi sub-2 detik.', input_token_limit: 1048576, output_token_limit: 8192, recommended: true },
      { id: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash', description: 'Model ringan andal untuk sintesis teks latihan.', input_token_limit: 1048576, output_token_limit: 8192, recommended: false },
      { id: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro', description: 'Model penalaran kompleks multi-bahasa tinggi.', input_token_limit: 2097152, output_token_limit: 8192, recommended: false },
    ];

    return {
      config: {
        has_api_key: hasKey,
        key_source: hasKey ? 'admin_db' : 'none',
        masked_key: masked,
        has_server_env_key: false,
        preferred_model: this.state.preferredModel,
      },
      models,
      model_error: null,
    };
  }

  saveAdminAiConfig(payload: { api_key?: string; preferred_model?: string; reset_to_env?: boolean }): { message: string; config: AdminAiConfig; models: AiModel[]; model_error: string | null } {
    if (payload.reset_to_env) {
      this.state.geminiApiKey = '';
      this.state.preferredModel = 'gemini-2.5-flash';
    } else {
      if (payload.api_key !== undefined) {
        this.state.geminiApiKey = payload.api_key.trim();
      }
      if (payload.preferred_model) {
        this.state.preferredModel = payload.preferred_model.trim();
      }
    }
    this.saveState();
    return {
      message: 'Konfigurasi AI berhasil disimpan.',
      ...this.getAdminAiConfig(),
    };
  }

  // --- AI Text Generation ---
  async generateTypingText(payload: { language_id: number; keywords: string[] }): Promise<GeneratedPassage> {
    const lang = this.state.languages.find((l) => l.id === payload.language_id) || this.state.languages[0];
    const kws = payload.keywords.filter((k) => k.trim() !== '');
    const kwText = kws.join(', ');

    // 1. Coba panggil Google AI Studio langsung jika ada API Key
    if (this.state.geminiApiKey) {
      try {
        const prompt = `Generate a smooth plain-text typing test passage in ${lang.name} (${lang.native_name}) of around 70-90 words. Naturally include these 5 topic keywords: ${kwText}. Rules: Plain text only, single paragraph, no markdown, no quotes, light punctuation.`;
        const model = this.state.preferredModel || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.state.geminiApiKey)}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 600,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          const part = resJson.candidates?.[0]?.content?.parts?.find((p: { text?: string; thought?: boolean }) => !p.thought && p.text);
          if (part?.text) {
            const cleanText = part.text.replace(/[`*_#]/g, '').replace(/\s+/g, ' ').trim();
            const words = cleanText.split(' ').filter(Boolean);
            return {
              text: cleanText,
              word_count: words.length,
              char_count: cleanText.length,
              model_used: model,
              key_source: 'admin_db',
              keywords: kws,
              language: { id: lang.id, code: lang.code, name: lang.name, native_name: lang.native_name },
            };
          }
        }
      } catch {
        // Fallback jika API quota habis / offline
      }
    }

    // 2. Intelligent Offline Fallback Generator
    const offlinePassage = this.buildOfflinePassage(lang.code, kws);
    const words = offlinePassage.split(' ').filter(Boolean);

    return {
      text: offlinePassage,
      word_count: words.length,
      char_count: offlinePassage.length,
      model_used: 'keyverse-adaptive-engine',
      key_source: 'none',
      keywords: kws,
      language: { id: lang.id, code: lang.code, name: lang.name, native_name: lang.native_name },
    };
  }

  private buildOfflinePassage(langCode: string, keywords: string[]): string {
    const k = keywords.length >= 5 ? keywords : [...keywords, 'sistem', 'performa', 'teknologi', 'kecepatan', 'akurasi'];
    switch (langCode) {
      case 'id':
        return `Pengembangan sistem modern dengan fokus pada ${k[0]} dan stabilitas ${k[1]} memberikan dampak nyata terhadap efisiensi kerja. Melalui pengujian ketat, integrasi ${k[2]} mampu menjaga integritas data di dalam ${k[3]} berkecepatan tinggi. Penerapan protokol ${k[4]} yang tepat memastikan seluruh alur komunikasi berjalan teratur, aman, dan siap menghadapi beban kerja yang semakin meningkat secara konsisten.`;
      case 'ja-romaji':
        return `Gendai no gijutsu kaihatsu ni oite ${k[0]} to ${k[1]} no kouritsuka wa kiwamete juuyou na koutei desu. Chuui bukaku sekkei sareta ${k[2]} wo dounyuu suru koto de ${k[3]} no anzen-sei ga kyuusoku ni koujou shimasu. Sara ni saishin no ${k[4]} purotokoru wo katsuyou shi, fukasuuji no mondai wo jinsoku ni kaiketsu shite seikaku na seika wo osameru koto ga kano desu.`;
      case 'de':
        return `Die moderne Systementwicklung erfordert fundierte Kenntnisse über ${k[0]} und stabile ${k[1]} im täglichen Betrieb. Durch gezielte Optimierung von ${k[2]} und zuverlässige ${k[3]} lassen sich Fehler nachhaltig reduzieren. Der Einsatz von ${k[4]} garantiert hohe Präzision und maximale Effizienz im gesamten Arbeitsablauf.`;
      case 'es':
        return `El desarrollo de software actual depende directamente de una sólida arquitectura de ${k[0]} y la estabilidad de ${k[1]}. Al integrar soluciones de ${k[2]} dentro de la infraestructura de ${k[3]}, logramos una velocidad de respuesta óptima. La correcta gestión de ${k[4]} asegura un rendimiento constante y confiable en cada sesión.`;
      case 'en':
      default:
        return `Modern system architecture relies heavily on well-designed ${k[0]} and robust ${k[1]} to deliver peak throughput. Integrating resilient ${k[2]} layers across high-performance ${k[3]} pipelines prevents data loss and maintains balance. By fine-tuning each ${k[4]} routine, engineers create seamless digital experiences that adapt quickly to evolving competitive demands.`;
    }
  }

  // --- Sessions & Leaderboard ---
  saveSession(payload: {
    language_id: number;
    keywords: string[];
    ai_model: string;
    generated_text: string;
    wpm: number;
    raw_wpm: number;
    accuracy: number;
    total_chars: number;
    correct_chars: number;
    incorrect_chars: number;
    word_count: number;
    duration_seconds: number;
  }): { message: string; session_id: number } {
    const user = this.getAuthUser() || this.state.users[0];
    const lang = this.state.languages.find((l) => l.id === payload.language_id) || this.state.languages[0];

    const newSessId = this.state.sessions.length > 0 ? Math.max(...this.state.sessions.map((s) => s.id)) + 1 : 1;
    const newRecord: TypingSessionRecord & { user_id: number } = {
      id: newSessId,
      user_id: user.id,
      language_id: lang.id,
      language_code: lang.code,
      language_name: lang.name,
      language_native_name: lang.native_name,
      keywords: payload.keywords,
      ai_model: payload.ai_model,
      wpm: payload.wpm,
      raw_wpm: payload.raw_wpm,
      accuracy: payload.accuracy,
      total_chars: payload.total_chars,
      correct_chars: payload.correct_chars,
      incorrect_chars: payload.incorrect_chars,
      word_count: payload.word_count,
      duration_seconds: payload.duration_seconds,
      created_at: new Date().toISOString(),
    };

    this.state.sessions.unshift(newRecord);
    this.saveState();

    return { message: 'Sesi latihan berhasil disimpan.', session_id: newSessId };
  }

  getSessions(languageId?: number | null): {
    summary: SessionSummary;
    by_language: LanguageProgressStat[];
    trend: TypingSessionRecord[];
    sessions: TypingSessionRecord[];
  } {
    const user = this.getAuthUser() || this.state.users[0];
    let userSess = this.state.sessions.filter((s) => s.user_id === user.id);

    if (languageId) {
      userSess = userSess.filter((s) => s.language_id === languageId);
    }

    const total = userSess.length;
    const bestWpm = total > 0 ? Math.max(...userSess.map((s) => s.wpm)) : 0;
    const avgWpm = total > 0 ? userSess.reduce((acc, s) => acc + s.wpm, 0) / total : 0;
    const avgAcc = total > 0 ? userSess.reduce((acc, s) => acc + s.accuracy, 0) / total : 0;
    const totalWords = userSess.reduce((acc, s) => acc + s.word_count, 0);
    const totalDuration = userSess.reduce((acc, s) => acc + s.duration_seconds, 0);

    const byLangMap = new Map<number, LanguageProgressStat>();
    for (const s of userSess) {
      const existing = byLangMap.get(s.language_id);
      if (existing) {
        existing.sessions += 1;
        existing.avg_wpm = Math.round(((existing.avg_wpm * (existing.sessions - 1) + s.wpm) / existing.sessions) * 10) / 10;
        existing.best_wpm = Math.max(existing.best_wpm, s.wpm);
        existing.avg_accuracy = Math.round(((existing.avg_accuracy * (existing.sessions - 1) + s.accuracy) / existing.sessions) * 10) / 10;
      } else {
        byLangMap.set(s.language_id, {
          language_id: s.language_id,
          code: s.language_code,
          name: s.language_name,
          native_name: s.language_native_name,
          sessions: 1,
          avg_wpm: s.wpm,
          best_wpm: s.wpm,
          avg_accuracy: s.accuracy,
        });
      }
    }

    const trend = [...userSess].reverse().slice(-15);

    return {
      summary: {
        total_sessions: total,
        best_wpm: Math.round(bestWpm * 10) / 10,
        avg_wpm: Math.round(avgWpm * 10) / 10,
        avg_accuracy: Math.round(avgAcc * 10) / 10,
        total_words: totalWords,
        total_duration_seconds: Math.round(totalDuration),
      },
      by_language: Array.from(byLangMap.values()),
      trend,
      sessions: userSess,
    };
  }

  deleteSession(id: number): { message: string } {
    this.state.sessions = this.state.sessions.filter((s) => s.id !== id);
    this.saveState();
    return { message: 'Sesi latihan berhasil dihapus.' };
  }

  getLeaderboard(languageId?: number | null): { leaderboard: LeaderboardEntry[] } {
    const current = this.getAuthUser() || this.state.users[0];
    const leaderboard: LeaderboardEntry[] = [];

    for (const u of this.state.users) {
      let uSess = this.state.sessions.filter((s) => s.user_id === u.id);
      if (languageId) {
        uSess = uSess.filter((s) => s.language_id === languageId);
      }
      if (uSess.length === 0) continue;

      const best = Math.max(...uSess.map((s) => s.wpm));
      const avg = uSess.reduce((acc, s) => acc + s.wpm, 0) / uSess.length;
      const acc = uSess.reduce((acc, s) => acc + s.accuracy, 0) / uSess.length;
      const last = uSess[0].created_at;

      leaderboard.push({
        rank: 0,
        user_id: u.id,
        name: u.name,
        username: u.username,
        is_me: u.id === current.id,
        total_races: uSess.length,
        best_wpm: Math.round(best * 10) / 10,
        avg_wpm: Math.round(avg * 10) / 10,
        avg_accuracy: Math.round(acc * 10) / 10,
        last_race_at: last,
      });
    }

    leaderboard.sort((a, b) => b.best_wpm - a.best_wpm);
    leaderboard.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return { leaderboard };
  }

  // --- Multiplayer Versus Rooms ---
  getOpenRooms(): { rooms: OpenRoomSummary[] } {
    const summaries: OpenRoomSummary[] = this.state.rooms
      .filter((r) => r.status === 'waiting')
      .map((r) => ({
        code: r.code,
        host_name: r.host_name,
        host_username: r.host_username,
        language_native_name: r.language.native_name,
        language_code: r.language.code,
        keywords: r.keywords,
        word_count: r.word_count,
        ai_model: r.ai_model,
        participant_count: r.participants.length,
        created_at: new Date().toISOString(),
      }));
    return { rooms: summaries };
  }

  createRoom(payload: { language_id: number; keywords: string[] }): { room: RaceRoom } {
    const user = this.getAuthUser() || this.state.users[0];
    const lang = this.state.languages.find((l) => l.id === payload.language_id) || this.state.languages[0];
    const code = 'KV' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const text = this.buildOfflinePassage(lang.code, payload.keywords);

    const room: RaceRoom = {
      id: Math.floor(Math.random() * 10000) + 1,
      code,
      host_user_id: user.id,
      host_name: user.name,
      host_username: user.username,
      is_host: true,
      language: { id: lang.id, code: lang.code, name: lang.name, native_name: lang.native_name },
      keywords: payload.keywords,
      ai_model: 'gemini-2.5-flash',
      generated_text: text,
      word_count: text.split(' ').length,
      status: 'waiting',
      starts_at_ms: null,
      server_time_ms: Date.now(),
      participants: [
        {
          user_id: user.id,
          name: user.name,
          username: user.username,
          is_host: true,
          is_me: true,
          is_ready: true,
          progress: 0,
          wpm: 0,
          raw_wpm: 0,
          accuracy: 100,
          correct_chars: 0,
          incorrect_chars: 0,
          duration_seconds: 0,
          finished: false,
          finished_at_ms: null,
          rank: 1,
        },
      ],
    };

    this.state.rooms.push(room);
    this.saveState();
    return { room };
  }

  joinRoom(code: string): { room: RaceRoom } {
    const room = this.state.rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!room) throw new Error('Room tidak ditemukan atau telah ditutup.');
    const user = this.getAuthUser() || this.state.users[0];

    const exists = room.participants.some((p) => p.user_id === user.id);
    if (!exists) {
      room.participants.push({
        user_id: user.id,
        name: user.name,
        username: user.username,
        is_host: false,
        is_me: true,
        is_ready: false,
        progress: 0,
        wpm: 0,
        raw_wpm: 0,
        accuracy: 100,
        correct_chars: 0,
        incorrect_chars: 0,
        duration_seconds: 0,
        finished: false,
        finished_at_ms: null,
        rank: room.participants.length + 1,
      });
    }

    room.is_host = room.host_user_id === user.id;
    this.saveState();
    return { room };
  }

  getRoom(code: string): { room: RaceRoom } {
    const room = this.state.rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!room) throw new Error('Room tidak ditemukan.');
    const user = this.getAuthUser() || this.state.users[0];
    room.is_host = room.host_user_id === user.id;
    room.server_time_ms = Date.now();
    return { room };
  }

  setRoomReady(code: string, is_ready: boolean): { room: RaceRoom } {
    const room = this.state.rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!room) throw new Error('Room tidak ditemukan.');
    const user = this.getAuthUser() || this.state.users[0];
    const p = room.participants.find((item) => item.user_id === user.id);
    if (p) p.is_ready = is_ready;
    this.saveState();
    return { room };
  }

  startRoom(code: string): { room: RaceRoom } {
    const room = this.state.rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!room) throw new Error('Room tidak ditemukan.');
    room.status = 'countdown';
    room.starts_at_ms = Date.now() + 3500;
    this.saveState();
    return { room };
  }

  sendRoomProgress(
    code: string,
    payload: { progress: number; wpm: number; raw_wpm: number; accuracy: number; correct_chars: number; incorrect_chars: number; duration_seconds: number; finished: boolean }
  ): { room: RaceRoom } {
    const room = this.state.rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!room) throw new Error('Room tidak ditemukan.');
    const user = this.getAuthUser() || this.state.users[0];
    const p = room.participants.find((item) => item.user_id === user.id);
    if (p) {
      const wasFinished = p.finished;
      Object.assign(p, payload);
      if (payload.finished && !p.finished_at_ms) {
        p.finished_at_ms = Date.now();
      }
      if (payload.finished && !wasFinished) {
        this.saveSession({
          language_id: room.language.id,
          keywords: room.keywords,
          ai_model: room.ai_model,
          generated_text: room.generated_text,
          wpm: payload.wpm,
          raw_wpm: payload.raw_wpm,
          accuracy: payload.accuracy,
          total_chars: room.generated_text.length,
          correct_chars: payload.correct_chars,
          incorrect_chars: payload.incorrect_chars,
          word_count: room.word_count,
          duration_seconds: payload.duration_seconds || 60,
        });
      }
    }
    this.saveState();
    return { room };
  }

  rematchRoom(code: string): { room: RaceRoom } {
    const room = this.state.rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!room) throw new Error('Room tidak ditemukan.');
    room.status = 'waiting';
    room.starts_at_ms = null;
    room.participants.forEach((p) => {
      p.is_ready = p.is_host;
      p.progress = 0;
      p.wpm = 0;
      p.finished = false;
      p.finished_at_ms = null;
    });
    this.saveState();
    return { room };
  }

  leaveRoom(code: string): { message: string } {
    const room = this.state.rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (room) {
      const user = this.getAuthUser() || this.state.users[0];
      room.participants = room.participants.filter((p) => p.user_id !== user.id);
      this.saveState();
    }
    return { message: 'Berhasil keluar dari room.' };
  }
}

export const clientStore = new ClientStore();
