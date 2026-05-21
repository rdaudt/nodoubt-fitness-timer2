import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { deleteAccount, fetchMe, getGoogleLoginUrl, logout, type AuthUser } from './authApi';
import { setAnalyticsCoachModeProvider } from './analytics';
import { setStorageLoggedOutScope, setStorageUserScope } from './storage';
import { clearTenantSessionCache } from './tenantSessionCache';

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
    setStorageLoggedOutScope();
    fetchMe()
      .then((me) => {
        if (!me) {
          setStorageLoggedOutScope();
          setUser(null);
          return;
        }
        const normalizedEmail = me.email.trim().toLowerCase();
        if (!normalizedEmail) {
          setStorageLoggedOutScope();
          setUser(null);
          return;
        }
        setStorageUserScope(normalizedEmail);
        setUser(me);
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    setAnalyticsCoachModeProvider(() => Boolean(user?.isCoach));
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    loaded,
    user,
    login: (nextPath: string) => {
      window.location.assign(getGoogleLoginUrl(nextPath));
    },
    logoutUser: async () => {
      await logout();
      clearTenantSessionCache();
      setStorageLoggedOutScope();
      setUser(null);
    },
    deleteCurrentAccount: async () => {
      await deleteAccount();
      clearTenantSessionCache();
      setStorageLoggedOutScope();
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

export const useCoachMode = (): boolean => {
  const { user } = useAuth();
  const { tenantSlug = '' } = useParams();
  return isCoachModeEnabled(user, tenantSlug);
};

export const isCoachModeEnabled = (user: AuthUser | null, tenantSlug: string): boolean => {
  if (!user || !user.coachOwnershipValid) {
    return false;
  }
  const coachSlug = (user.coachSlug ?? '').trim().toLowerCase();
  const routeSlug = tenantSlug.trim().toLowerCase();
  return Boolean(coachSlug) && Boolean(routeSlug) && coachSlug === routeSlug;
};
