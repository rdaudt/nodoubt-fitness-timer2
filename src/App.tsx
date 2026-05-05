import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
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
import { TenantProvider } from './services/tenantContext';

const TimerEditRedirect = () => {
  const { tenantSlug = '', id = '' } = useParams();
  return <Navigate to={`/${tenantSlug}/timer/${id}`} replace />;
};

const TenantShell = () => {
  const { tenantSlug = '' } = useParams();
  return (
    <TenantProvider>
      <SettingsProvider key={tenantSlug}>
        <AppLayout />
      </SettingsProvider>
    </TenantProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
    </BrowserRouter>
  );
}

export default App;
