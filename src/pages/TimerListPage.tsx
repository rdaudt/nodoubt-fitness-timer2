import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerCard } from '../components/TimerCard';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';
import steampunkGym2 from '../../media/steampunk-gym-2.png';

export const TimerListPage = () => {
  const { settings, saveSettings } = useSettings();
  const [timers, setTimers] = useState<Timer[]>([]);

  useEffect(() => {
    TimerRepository.list().then(setTimers);
  }, []);

  const onDeleteTimer = async (id: string) => {
    const ok = window.confirm('Delete this timer?');
    if (!ok) {
      return;
    }
    await TimerRepository.remove(id);
    setTimers((prev) => prev.filter((timer) => timer.id !== id));
  };

  return (
    <section className="home-page">
      <div className="section-header">
        <h1 className="screen-title">Your HIIT Timers</h1>
        <Link to="/timer/new" className="primary-btn">
          + New Timer
        </Link>
      </div>

      <label className="field settings-toggle-row home-coach-mode-row">
        <span>Coach Mode</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={settings.coachMode}
          onChange={(e) => saveSettings({ ...settings, coachMode: e.target.checked })}
          aria-label="Coach Mode"
        />
      </label>

      <div className="stack">
        {timers.length === 0
          ? <p className="empty">No timers yet. Create your first interval plan.</p>
          : timers.map((timer, index) => (
            <TimerCard
              key={timer.id}
              timer={timer}
              intervalColors={settings.intervalColors}
              coachMode={settings.coachMode}
              featureImage={index === 0 ? steampunkGym2 : undefined}
              onDelete={onDeleteTimer}
            />
          ))}
      </div>

    </section>
  );
};
