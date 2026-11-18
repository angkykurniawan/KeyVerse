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

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'keyverse_jwt_token';

export class ApiError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const realMethod = options.method || 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

  // Gunakan POST + X-HTTP-Method-Override untuk PUT/DELETE agar kompatibel dengan firewall InfinityFree
  let fetchMethod: string = realMethod;
  if (realMethod === 'PUT' || realMethod === 'DELETE') {
    fetchMethod = 'POST';
    headers['X-HTTP-Method-Override'] = realMethod;
  }

  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  } else if (fetchMethod === 'POST') {
    headers['Content-Type'] = 'application/json';
    bodyStr = '{}';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: fetchMethod,
    headers,
    body: fetchMethod === 'GET' ? undefined : bodyStr,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(`Respon server tidak valid (HTTP ${res.status}).`, res.status);
    }
  }

  if (!res.ok) {
    const msg =
      typeof data.error === 'string'
        ? data.error
        : res.status === 500
          ? 'Server API tidak merespon (HTTP 500). Pastikan server PHP API aktif (jalankan "npm run dev") atau periksa konfigurasi .env & database.'
          : `Permintaan gagal dengan status HTTP ${res.status}.`;
    throw new ApiError(msg, res.status, data.details as Record<string, unknown> | undefined);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (identifier: string, password: string) =>
    request<{ token: string; user: User; ai_ready: boolean }>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    }),

  me: () => request<{ user: User; ai_ready: boolean }>('/auth/me'),

  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: { current_password, new_password },
    }),

  // Languages
  getLanguages: (includeAll = false) =>
    request<{ languages: Language[] }>(`/languages${includeAll ? '?all=1' : ''}`),

  createLanguage: (payload: {
    code: string;
    name: string;
    native_name: string;
    prompt_hint?: string;
    is_active?: boolean;
  }) =>
    request<{ message: string; language: Language }>('/admin/languages', {
      method: 'POST',
      body: payload,
    }),

  updateLanguage: (
    id: number,
    payload: Partial<{
      code: string;
      name: string;
      native_name: string;
      prompt_hint: string;
      is_active: boolean;
    }>
  ) =>
    request<{ message: string; language: Language }>(`/admin/languages/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  deleteLanguage: (id: number) =>
    request<{ message: string }>(`/admin/languages/${id}`, {
      method: 'DELETE',
    }),

  // Admin Users, Overview & AI Config (ADMIN ONLY)
  getAdminOverview: () => request<{ overview: AdminOverview }>('/admin/overview'),

  getAdminUsers: () => request<{ users: User[] }>('/admin/users'),

  createUser: (payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: 'user' | 'admin';
    is_active?: boolean;
  }) =>
    request<{ message: string; user: User }>('/admin/users', {
      method: 'POST',
      body: payload,
    }),

  updateUser: (
    id: number,
    payload: Partial<{
      name: string;
      username: string;
      email: string;
      password: string;
      role: 'user' | 'admin';
      is_active: boolean;
    }>
  ) =>
    request<{ message: string; user: User }>(`/admin/users/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  deleteUser: (id: number) =>
    request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),

  getAdminAiConfig: () =>
    request<{ config: AdminAiConfig; models: AiModel[]; model_error: string | null }>(
      '/admin/ai-config'
    ),

  saveAdminAiConfig: (payload: {
    api_key?: string;
    preferred_model?: string;
    reset_to_env?: boolean;
  }) =>
    request<{
      message: string;
      config: AdminAiConfig;
      models: AiModel[];
      model_error: string | null;
    }>('/admin/ai-config', {
      method: 'POST',
      body: payload,
    }),

  // AI Status & Text Generation (untuk semua user)
  getAiStatus: () =>
    request<{ ai_ready: boolean; preferred_model: string }>('/ai/status'),

  generateTypingText: (payload: { language_id: number; keywords: string[] }) =>
    request<GeneratedPassage>('/ai/generate', {
      method: 'POST',
      body: payload,
    }),

  // Sessions & Progress
  saveSession: (payload: {
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
  }) =>
    request<{ message: string; session_id: number }>('/sessions', {
      method: 'POST',
      body: payload,
    }),

  getSessions: (languageId?: number | null) => {
    const qs = languageId ? `?language_id=${languageId}` : '';
    return request<{
      summary: SessionSummary;
      by_language: LanguageProgressStat[];
      trend: TypingSessionRecord[];
      sessions: TypingSessionRecord[];
    }>(`/sessions${qs}`);
  },

  deleteSession: (id: number) =>
    request<{ message: string }>(`/sessions/${id}`, {
      method: 'DELETE',
    }),

  getLeaderboard: (languageId?: number | null) => {
    const qs = languageId ? `?language_id=${languageId}` : '';
    return request<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard${qs}`);
  },

  // Multiplayer Versus Rooms
  getOpenRooms: () => request<{ rooms: OpenRoomSummary[] }>('/rooms/open'),

  createRoom: (payload: { language_id: number; keywords: string[] }) =>
    request<{ room: RaceRoom }>('/rooms', {
      method: 'POST',
      body: payload,
    }),

  joinRoom: (code: string) =>
    request<{ room: RaceRoom }>('/rooms/join', {
      method: 'POST',
      body: { code },
    }),

  getRoom: (code: string) => request<{ room: RaceRoom }>(`/rooms/${encodeURIComponent(code)}`),

  setRoomReady: (code: string, is_ready: boolean) =>
    request<{ room: RaceRoom }>(`/rooms/${encodeURIComponent(code)}/ready`, {
      method: 'POST',
      body: { is_ready },
    }),

  startRoom: (code: string) =>
    request<{ room: RaceRoom }>(`/rooms/${encodeURIComponent(code)}/start`, {
      method: 'POST',
      body: {},
    }),

  sendRoomProgress: (
    code: string,
    payload: {
      progress: number;
      wpm: number;
      raw_wpm: number;
      accuracy: number;
      correct_chars: number;
      incorrect_chars: number;
      duration_seconds: number;
      finished: boolean;
    }
  ) =>
    request<{ room: RaceRoom }>(`/rooms/${encodeURIComponent(code)}/progress`, {
      method: 'POST',
      body: payload,
    }),

  rematchRoom: (code: string) =>
    request<{ room: RaceRoom }>(`/rooms/${encodeURIComponent(code)}/rematch`, {
      method: 'POST',
      body: {},
    }),

  leaveRoom: (code: string) =>
    request<{ message: string }>(`/rooms/${encodeURIComponent(code)}/leave`, {
      method: 'POST',
      body: {},
    }),
};
