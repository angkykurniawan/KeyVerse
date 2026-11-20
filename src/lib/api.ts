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
import { clientStore } from './clientStore';

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

// Deteksi apakah sedang berjalan di Vercel tanpa backend PHP terpisah
function isVercelStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isVercelHost = window.location.hostname.includes('vercel.app');
  // Jika tidak ada custom API_BASE luar (masih '/api'), berarti Vercel tanpa PHP
  return isVercelHost && (API_BASE === '/api' || API_BASE === '');
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const realMethod = options.method || 'GET';

  // Jika di Vercel tanpa PHP, langsung gunakan ClientStore super cepat tanpa network roundtrip
  if (isVercelStandalone()) {
    return handleClientFallback<T>(path, realMethod, options.body);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

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

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: fetchMethod,
      headers,
      body: fetchMethod === 'GET' ? undefined : bodyStr,
    });

    if (res.status === 404 || res.status === 403 || res.status === 502) {
      // Server PHP tidak ada di host ini (misal di Vercel), fallback mulus ke ClientStore
      return handleClientFallback<T>(path, realMethod, options.body);
    }

    const text = await res.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // Jika respon berupa HTML (misal aes.js InfinityFree challenge atau 404 HTML), fallback
        return handleClientFallback<T>(path, realMethod, options.body);
      }
    }

    if (!res.ok) {
      const msg = typeof data.error === 'string' ? data.error : `Permintaan gagal dengan status HTTP ${res.status}.`;
      throw new ApiError(msg, res.status, data.details as Record<string, unknown> | undefined);
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Network error / CORS blocked, fallback ke ClientStore
    return handleClientFallback<T>(path, realMethod, options.body);
  }
}

// Router Fallback internal untuk menangani semua request di Vercel secara native
async function handleClientFallback<T>(path: string, method: string, body?: unknown): Promise<T> {
  const b = (body as Record<string, any>) || {};

  // Auth
  if (path === '/auth/login' && method === 'POST') {
    return clientStore.handleLogin(b.identifier || '', b.password || '') as T;
  }
  if (path === '/auth/me') {
    return clientStore.handleMe() as T;
  }
  if (path === '/auth/change-password' && method === 'POST') {
    return clientStore.handleChangePassword(b.current_password || '', b.new_password || '') as T;
  }

  // Languages
  if (path.startsWith('/languages')) {
    const includeAll = path.includes('all=1');
    return clientStore.getLanguages(includeAll) as T;
  }
  if (path === '/admin/languages' && method === 'POST') {
    return clientStore.createLanguage(b as any) as T;
  }
  const langMatch = path.match(/^\/admin\/languages\/(\d+)$/);
  if (langMatch) {
    const id = parseInt(langMatch[1], 10);
    if (method === 'PUT') return clientStore.updateLanguage(id, b) as T;
    if (method === 'DELETE') return clientStore.deleteLanguage(id) as T;
  }

  // Admin Overview & Users
  if (path === '/admin/overview') {
    return clientStore.getAdminOverview() as T;
  }
  if (path === '/admin/users' && method === 'GET') {
    return clientStore.getAdminUsers() as T;
  }
  if (path === '/admin/users' && method === 'POST') {
    return clientStore.createUser(b as any) as T;
  }
  const userMatch = path.match(/^\/admin\/users\/(\d+)$/);
  if (userMatch) {
    const id = parseInt(userMatch[1], 10);
    if (method === 'PUT') return clientStore.updateUser(id, b) as T;
    if (method === 'DELETE') return clientStore.deleteUser(id) as T;
  }

  // Admin AI Config
  if (path === '/admin/ai-config') {
    if (method === 'POST') return clientStore.saveAdminAiConfig(b as any) as T;
    return clientStore.getAdminAiConfig() as T;
  }

  // AI Status & Generate
  if (path === '/ai/status') {
    return { ai_ready: true, preferred_model: 'gemini-2.5-flash' } as T;
  }
  if (path === '/ai/generate' && method === 'POST') {
    const generated = await clientStore.generateTypingText(b as any);
    return generated as T;
  }

  // Sessions
  if (path === '/sessions' && method === 'POST') {
    return clientStore.saveSession(b as any) as T;
  }
  if (path.startsWith('/sessions')) {
    const url = new URL('http://dummy' + path);
    const langId = url.searchParams.get('language_id');
    return clientStore.getSessions(langId ? parseInt(langId, 10) : null) as T;
  }
  const sessMatch = path.match(/^\/sessions\/(\d+)$/);
  if (sessMatch && method === 'DELETE') {
    return clientStore.deleteSession(parseInt(sessMatch[1], 10)) as T;
  }

  // Leaderboard
  if (path.startsWith('/leaderboard')) {
    const url = new URL('http://dummy' + path);
    const langId = url.searchParams.get('language_id');
    return clientStore.getLeaderboard(langId ? parseInt(langId, 10) : null) as T;
  }

  // Multiplayer Rooms
  if (path === '/rooms/open') {
    return clientStore.getOpenRooms() as T;
  }
  if (path === '/rooms' && method === 'POST') {
    return clientStore.createRoom(b as any) as T;
  }
  if (path === '/rooms/join' && method === 'POST') {
    return clientStore.joinRoom(b.code || '') as T;
  }
  const roomReadyMatch = path.match(/^\/rooms\/([^/]+)\/ready$/);
  if (roomReadyMatch && method === 'POST') {
    return clientStore.setRoomReady(decodeURIComponent(roomReadyMatch[1]), b.is_ready) as T;
  }
  const roomStartMatch = path.match(/^\/rooms\/([^/]+)\/start$/);
  if (roomStartMatch && method === 'POST') {
    return clientStore.startRoom(decodeURIComponent(roomStartMatch[1])) as T;
  }
  const roomProgMatch = path.match(/^\/rooms\/([^/]+)\/progress$/);
  if (roomProgMatch && method === 'POST') {
    return clientStore.sendRoomProgress(decodeURIComponent(roomProgMatch[1]), b as any) as T;
  }
  const roomRematchMatch = path.match(/^\/rooms\/([^/]+)\/rematch$/);
  if (roomRematchMatch && method === 'POST') {
    return clientStore.rematchRoom(decodeURIComponent(roomRematchMatch[1])) as T;
  }
  const roomLeaveMatch = path.match(/^\/rooms\/([^/]+)\/leave$/);
  if (roomLeaveMatch && method === 'POST') {
    return clientStore.leaveRoom(decodeURIComponent(roomLeaveMatch[1])) as T;
  }
  const roomGetMatch = path.match(/^\/rooms\/([^/]+)$/);
  if (roomGetMatch && method === 'GET') {
    return clientStore.getRoom(decodeURIComponent(roomGetMatch[1])) as T;
  }

  throw new ApiError(`Route '${path}' belum didukung di mode client.`, 404);
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
