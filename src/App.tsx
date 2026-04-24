import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AboutPage } from './pages/AboutPage';
import { RunningTimerPage } from './pages/RunningTimerPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimerDetailPage } from './pages/TimerDetailPage';
import { TimerEditorPage } from './pages/TimerEditorPage';
import { TimerListPage } from './pages/TimerListPage';
import { SettingsProvider } from './services/settingsContext';

function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<TimerListPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/timer/new" element={<TimerEditorPage />} />
            <Route path="/timer/:id" element={<TimerDetailPage />} />
            <Route path="/timer/:id/edit" element={<TimerDetailPage />} />
            <Route path="/timer/:id/run" element={<RunningTimerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}

export default App;
