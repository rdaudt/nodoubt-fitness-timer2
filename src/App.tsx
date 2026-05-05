import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AboutPage } from './pages/AboutPage';
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
import { AuthProvider, useAuth } from './services/authContext';
import { TenantProvider } from './services/tenantContext';

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
    <section className="invalid-url-page">
      <h1 className="screen-title">Sign In Required</h1>
      <p className="timer-meta">Please sign in with Google to continue.</p>
      <div className="actions-row">
        <button className="primary-btn" onClick={() => login(nextPath)}>Continue with Google</button>
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invalid-url" element={<InvalidUrlPage />} />
          <Route path="/" element={<InvalidUrlPage />} />
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
            <Route path="history" element={<HistoryPage />} />
            <Route path="about" element={<AboutPage />} />
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
