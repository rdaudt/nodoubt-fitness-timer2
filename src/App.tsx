import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AboutPage } from './pages/AboutPage';
import { CoachDirectoryPage } from './pages/CoachDirectoryPage';
import { HistoryPage } from './pages/HistoryPage';
import { NewTimerPage } from './pages/NewTimerPage';
import { RunningTimerPage } from './pages/RunningTimerPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplateDetailPage } from './pages/TemplateDetailPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { InvalidUrlPage } from './pages/InvalidUrlPage';
import { TimerDetailPage } from './pages/TimerDetailPage';
import { TimerListPage } from './pages/TimerListPage';
import { SettingsProvider } from './services/settingsContext';
import { AuthProvider, useAuth, useCoachMode } from './services/authContext';
import { clearMyCoachSlug, getMyCoachSlug, isValidCoachSlug } from './services/coachDirectory';
import { fetchTenantPublicProfile, fetchTenantPublicProfileWithStatus } from './services/tenantApi';
import { TenantProvider, useTenant } from './services/tenantContext';

const TimerEditRedirect = () => {
  const { tenantSlug = '', id = '' } = useParams();
  return <Navigate to={`/${tenantSlug}/timer/${id}`} replace />;
};

const LoginPage = () => {
  const location = useLocation();
  const { login, loaded, user } = useAuth();
  const params = new URLSearchParams(location.search);
  const nextPath = params.get('next') || '/';

  if (loaded && user) {
    return <Navigate to={nextPath} replace />;
  }

  return (
    <section className="login-page">
      <p className="topbar-user-email login-user-email">{user?.email ?? ''}</p>
      <h1 className="screen-title">Sign In Required</h1>
      <div className="actions-row login-actions-row">
        <button className="google-signin-btn" onClick={() => login(nextPath)}>
          <span className="google-signin-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M12 10.2v4.1h5.7c-.2 1.3-.8 2.4-1.7 3.2l3 2.3c1.8-1.7 2.9-4.1 2.9-6.9 0-.7-.1-1.3-.2-1.9H12z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.5-2.4l-3-2.3c-.8.6-2 .9-3.5.9-2.7 0-4.9-1.8-5.7-4.3l-3.1 2.4C4.8 19.6 8.1 22 12 22z" />
              <path fill="#4A90E2" d="M6.3 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L3.2 7.7C2.4 9.2 2 10.6 2 12s.4 2.8 1.2 4.3l3.1-2.4z" />
              <path fill="#FBBC05" d="M12 5.8c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.9 14.7 2 12 2 8.1 2 4.8 4.4 3.2 7.7l3.1 2.4C7.1 7.6 9.3 5.8 12 5.8z" />
            </svg>
          </span>
          <span>Sign in with Google</span>
        </button>
      </div>
    </section>
  );
};

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { loaded, user } = useAuth();
  const location = useLocation();

  if (!loaded) {
    return (
      <section className="invalid-url-page">
        <h1 className="screen-title">Loading...</h1>
      </section>
    );
  }
  if (!user) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }
  return <>{children}</>;
};

const TenantShell = () => {
  const { tenantSlug = '' } = useParams();
  return (
    <RequireAuth>
      <TenantProvider>
        <SettingsProvider key={tenantSlug}>
          <AppLayout />
        </SettingsProvider>
      </TenantProvider>
    </RequireAuth>
  );
};

const RootLaunchPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const slug = getMyCoachSlug();
    if (!slug || !isValidCoachSlug(slug)) {
      if (slug) {
        clearMyCoachSlug();
      }
      setLoading(false);
      return;
    }
    void fetchTenantPublicProfileWithStatus(slug).then(({ profile, status }) => {
      if (!active) {
        return;
      }
      if (profile) {
        navigate(`/${slug}`, { replace: true });
        return;
      }
      if (status === 404) {
        clearMyCoachSlug();
        setNotice('Your saved coach is no longer available. Please choose My Coach again.');
      } else {
        setNotice('We could not verify your saved coach right now. Please try again.');
      }
      setLoading(false);
    }).catch(() => {
      if (active) {
        setNotice('We could not verify your saved coach right now. Please try again.');
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <section className="invalid-url-page">
        <h1 className="screen-title">Loading...</h1>
      </section>
    );
  }
  return <CoachDirectoryPage notice={notice} />;
};

const CoachOnlyHistoryRoute = () => {
  const coachMode = useCoachMode();
  const { toTenantPath } = useTenant();
  if (!coachMode) {
    return <Navigate to={toTenantPath('')} replace />;
  }
  return <HistoryPage />;
};

const NonCoachOnlyAboutRoute = () => {
  const coachMode = useCoachMode();
  const { toTenantPath } = useTenant();
  if (coachMode) {
    return <Navigate to={toTenantPath('')} replace />;
  }
  return <AboutPage />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invalid-url" element={<InvalidUrlPage />} />
          <Route path="/" element={<RequireAuth><RootLaunchPage /></RequireAuth>} />
          <Route path="/history" element={<InvalidUrlPage />} />
          <Route path="/about" element={<InvalidUrlPage />} />
          <Route path="/templates" element={<InvalidUrlPage />} />
          <Route path="/template/:id" element={<InvalidUrlPage />} />
          <Route path="/settings" element={<InvalidUrlPage />} />
          <Route path="/timer/new" element={<InvalidUrlPage />} />
          <Route path="/timer/:id" element={<InvalidUrlPage />} />
          <Route path="/timer/:id/edit" element={<InvalidUrlPage />} />
          <Route path="/timer/:id/run" element={<InvalidUrlPage />} />

          <Route path="/:tenantSlug" element={<TenantShell />}>
            <Route index element={<TimerListPage />} />
            <Route path="history" element={<CoachOnlyHistoryRoute />} />
            <Route path="about" element={<NonCoachOnlyAboutRoute />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="template/:id" element={<TemplateDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="timer/new" element={<NewTimerPage />} />
            <Route path="timer/:id" element={<TimerDetailPage />} />
            <Route path="timer/:id/edit" element={<TimerEditRedirect />} />
            <Route path="timer/:id/run" element={<RunningTimerPage />} />
            <Route path="*" element={<Navigate to="/invalid-url" replace />} />
          </Route>

          <Route path="*" element={<InvalidUrlPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
