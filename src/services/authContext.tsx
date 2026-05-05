import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { deleteAccount, fetchMe, getGoogleLoginUrl, logout, type AuthUser } from './authApi';

interface AuthContextValue {
  loaded: boolean;
  user: AuthUser | null;
  login: (nextPath: string) => void;
  logoutUser: () => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetchMe()
      .then((me) => setUser(me))
      .finally(() => setLoaded(true));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loaded,
    user,
    login: (nextPath: string) => {
      window.location.assign(getGoogleLoginUrl(nextPath));
    },
    logoutUser: async () => {
      await logout();
      setUser(null);
    },
    deleteCurrentAccount: async () => {
      await deleteAccount();
      setUser(null);
    },
  }), [loaded, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
