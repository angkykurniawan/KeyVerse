export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  session_count?: number;
  avg_wpm?: number;
  avg_accuracy?: number;
}

export interface Language {
  id: number;
  code: string;
  name: string;
  native_name: string;
  prompt_hint: string;
  is_active: boolean;
  created_at?: string;
  session_count?: number;
}

export interface AiModel {
  id: string;
  display_name: string;
  description: string;
  input_token_limit: number;
  output_token_limit: number;
  recommended: boolean;
}

export interface GeneratedPassage {
  text: string;
  word_count: number;
  char_count: number;
  model_used: string;
  key_source: 'server_env' | 'admin_db' | 'none';
  keywords: string[];
  language: {
    id: number;
    code: string;
    name: string;
    native_name: string;
  };
}

export interface AdminAiConfig {
  has_api_key: boolean;
  key_source: 'admin_db' | 'server_env' | 'none';
  masked_key: string;
  has_server_env_key: boolean;
  preferred_model: string;
}

export interface TypingTimelinePoint {
  sec: number;
  wpm: number;
}

export type RivalDifficulty = 'solo' | 'qualifier' | 'pro' | 'championship';

export interface TypingResult {
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  total_chars: number;
  correct_chars: number;
  incorrect_chars: number;
  word_count: number;
  duration_seconds: number;
  max_combo: number;
  placement: number; // 1, 2, 3
  total_racers: number;
  timeline: TypingTimelinePoint[];
}

export interface TypingSessionRecord {
  id: number;
  language_id: number;
  language_code: string;
  language_name: string;
  language_native_name: string;
  keywords: string[];
  ai_model: string;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  total_chars: number;
  correct_chars: number;
  incorrect_chars: number;
  word_count: number;
  duration_seconds: number;
  created_at: string;
}

export interface SessionSummary {
  total_sessions: number;
  best_wpm: number;
  avg_wpm: number;
  avg_accuracy: number;
  total_words: number;
  total_duration_seconds: number;
}

export interface LanguageProgressStat {
  language_id: number;
  code: string;
  name: string;
  native_name: string;
  sessions: number;
  avg_wpm: number;
  best_wpm: number;
  avg_accuracy: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  username: string;
  is_me: boolean;
  total_races: number;
  best_wpm: number;
  avg_wpm: number;
  avg_accuracy: number;
  last_race_at: string;
}

export interface AdminOverview {
  total_users: number;
  learner_count: number;
  active_users: number;
  total_languages: number;
  active_languages: number;
  total_sessions: number;
  avg_wpm: number;
  avg_accuracy: number;
  best_wpm: number;
}

export interface RaceParticipant {
  user_id: number;
  name: string;
  username: string;
  is_host: boolean;
  is_me: boolean;
  is_ready: boolean;
  progress: number;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  correct_chars: number;
  incorrect_chars: number;
  duration_seconds: number;
  finished: boolean;
  finished_at_ms: number | null;
  rank: number;
}

export interface RaceRoom {
  id: number;
  code: string;
  host_user_id: number;
  host_name: string;
  host_username: string;
  is_host: boolean;
  language: {
    id: number;
    code: string;
    name: string;
    native_name: string;
  };
  keywords: string[];
  ai_model: string;
  generated_text: string;
  word_count: number;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  starts_at_ms: number | null;
  server_time_ms: number;
  participants: RaceParticipant[];
}

export interface OpenRoomSummary {
  code: string;
  host_name: string;
  host_username: string;
  language_native_name: string;
  language_code: string;
  keywords: string[];
  word_count: number;
  ai_model: string;
  participant_count: number;
  created_at: string;
}
