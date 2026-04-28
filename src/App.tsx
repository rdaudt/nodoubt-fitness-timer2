import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AboutPage } from './pages/AboutPage';
import { HistoryPage } from './pages/HistoryPage';
import { NewTimerPage } from './pages/NewTimerPage';
import { RunningTimerPage } from './pages/RunningTimerPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimerDetailPage } from './pages/TimerDetailPage';
import { TimerListPage } from './pages/TimerListPage';
import { SettingsProvider } from './services/settingsContext';

const TimerEditRedirect = () => {
  const { id = '' } = useParams();
  return <Navigate to={`/timer/${id}`} replace />;
};

function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<TimerListPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/timer/new" element={<NewTimerPage />} />
            <Route path="/timer/:id" element={<TimerDetailPage />} />
            <Route path="/timer/:id/edit" element={<TimerEditRedirect />} />
            <Route path="/timer/:id/run" element={<RunningTimerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}

export default App;
