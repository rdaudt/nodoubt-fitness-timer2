import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AboutPage } from './pages/AboutPage';
import { HistoryPage } from './pages/HistoryPage';
import { NewTimerPage } from './pages/NewTimerPage';
import { RunningTimerPage } from './pages/RunningTimerPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplateDetailPage } from './pages/TemplateDetailPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TimerDetailPage } from './pages/TimerDetailPage';
import { TimerListPage } from './pages/TimerListPage';
import { SettingsProvider } from './services/settingsContext';
import { TenantProvider, tenantDefaults } from './services/tenantContext';

const TimerEditRedirect = () => {
  const { tenantSlug = tenantDefaults.defaultSlug, id = '' } = useParams();
  return <Navigate to={`/${tenantSlug}/timer/${id}`} replace />;
};

const TenantShell = () => {
  const { tenantSlug = tenantDefaults.defaultSlug } = useParams();
  return (
    <TenantProvider>
      <SettingsProvider key={tenantSlug}>
        <AppLayout />
      </SettingsProvider>
    </TenantProvider>
  );
};

const LegacyRedirect = ({ path = '' }: { path?: string }) => (
  <Navigate to={`/${tenantDefaults.defaultSlug}${path}`} replace />
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LegacyRedirect />} />
        <Route path="/history" element={<LegacyRedirect path="/history" />} />
        <Route path="/about" element={<LegacyRedirect path="/about" />} />
        <Route path="/templates" element={<LegacyRedirect path="/templates" />} />
        <Route path="/template/:id" element={<LegacyRedirect path="/templates" />} />
        <Route path="/settings" element={<LegacyRedirect path="/settings" />} />
        <Route path="/timer/new" element={<LegacyRedirect path="/timer/new" />} />
        <Route path="/timer/:id" element={<LegacyRedirect />} />
        <Route path="/timer/:id/edit" element={<LegacyRedirect />} />
        <Route path="/timer/:id/run" element={<LegacyRedirect />} />

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
          <Route path="*" element={<LegacyRedirect />} />
        </Route>

        <Route path="*" element={<LegacyRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
