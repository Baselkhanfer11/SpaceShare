import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { getToken, setToken } from '../api/http';
import type { AuthResponse, Me, RegisterInput } from '../types';

interface AuthContextValue {
  /** The signed-in user and their organisation (null = signed out). */
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  /** Ask the server again — e.g. to see if the organisation was approved. */
  refresh: () => Promise<Me>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  // Only "loading" when there's a saved token to check.
  const [loading, setLoading] = useState(() => !!getToken());

  // On first load: if we have a saved token, ask the server who we are.
  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    authApi.me()
      .then((m) => { if (active) setMe(m); })
      .catch(() => { /* invalid or expired token — stay signed out */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // If any request hits 401, the http layer fires this event → sign out.
  useEffect(() => {
    const handler = () => setMe(null);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const signedIn = useCallback((res: AuthResponse) => {
    setToken(res.token);
    setMe(res.me);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    signedIn(await authApi.login(email, password));
  }, [signedIn]);

  const register = useCallback(async (data: RegisterInput) => {
    signedIn(await authApi.register(data));
  }, [signedIn]);

  const refresh = useCallback(async () => {
    const fresh = await authApi.me();
    setMe(fresh);
    return fresh;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, login, register, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
