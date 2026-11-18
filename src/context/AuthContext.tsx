import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from '../lib/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  aiReady: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAiStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReady, setAiReady] = useState(false);

  const bootstrap = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.me();
      setUser(res.user);
      setAiReady(res.ai_ready);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.login(identifier, password);
    setStoredToken(res.token);
    setUser(res.user);
    setAiReady(res.ai_ready);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setAiReady(false);
  }, []);

  const refreshAiStatus = useCallback(async () => {
    try {
      const res = await api.getAiStatus();
      setAiReady(res.ai_ready);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        aiReady,
        login,
        logout,
        refreshAiStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
