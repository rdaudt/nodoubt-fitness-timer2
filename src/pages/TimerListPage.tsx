import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerCard } from '../components/TimerCard';
import { WORKOUT_CATEGORY_FILTERS, type WorkoutCategoryFilter } from '../config';
import { randomTimerName } from '../lib/timerFactory';
import { createTemplateFromTimer } from '../services/templateService';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

const homeCardImages = Object.entries(
  import.meta.glob('../../media/home-page-first-timer-card/*.{png,jpg,jpeg,webp,avif}', {
    eager: true,
    import: 'default',
  }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, value]) => String(value));

const HOME_CARD_IMAGE_INDEX_KEY = 'home:first-card-image-index';
const HOME_CARD_IMAGE_SESSION_KEY = 'home:first-card-image-selected';

const resolveSessionFirstCardImage = (): string | undefined => {
  if (homeCardImages.length === 0 || typeof window === 'undefined') {
    return undefined;
  }
  const selectedForSession = window.sessionStorage.getItem(HOME_CARD_IMAGE_SESSION_KEY);
  if (selectedForSession && homeCardImages.includes(selectedForSession)) {
    return selectedForSession;
  }

  const currentIndex = Number.parseInt(window.localStorage.getItem(HOME_CARD_IMAGE_INDEX_KEY) ?? '0', 10);
  const safeIndex = Number.isFinite(currentIndex) && currentIndex >= 0 ? currentIndex % homeCardImages.length : 0;
  const selected = homeCardImages[safeIndex];
  const nextIndex = (safeIndex + 1) % homeCardImages.length;
  window.localStorage.setItem(HOME_CARD_IMAGE_INDEX_KEY, String(nextIndex));
  window.sessionStorage.setItem(HOME_CARD_IMAGE_SESSION_KEY, selected);
  return selected;
};

export const TimerListPage = () => {
  const { settings, saveSettings } = useSettings();
  const [timers, setTimers] = useState<Timer[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilter>('ALL');
  const [firstCardImage] = useState<string | undefined>(() => resolveSessionFirstCardImage());

  useEffect(() => {
    const loadTimers = () => {
      TimerRepository.list().then(setTimers);
    };
    loadTimers();
    window.addEventListener('timers:changed', loadTimers);
    return () => window.removeEventListener('timers:changed', loadTimers);
  }, []);

  const onDeleteTimer = async (id: string) => {
    const ok = window.confirm('Delete this timer?');
    if (!ok) {
      return;
    }
    await TimerRepository.remove(id);
    setTimers((prev) => prev.filter((timer) => timer.id !== id));
  };

  const onCloneTimer = async (timer: Timer) => {
    const now = new Date().toISOString();
    const clone: Timer = {
      ...timer,
      id: crypto.randomUUID(),
      name: randomTimerName(),
      createdAt: now,
      updatedAt: now,
    };
    await TimerRepository.upsert(clone);
    setTimers((prev) => [clone, ...prev]);
  };

  const onCreateTemplate = async (timer: Timer) => {
    const nextName = window.prompt('Template name', timer.name)?.trim();
    if (!nextName) {
      return;
    }
    await createTemplateFromTimer(timer, nextName);
  };

  const visibleTimers = categoryFilter === 'ALL'
    ? timers
    : timers.filter((timer) => timer.category === categoryFilter);

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

      <label className="field home-category-filter-row">
        <span>Workout Category</span>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as WorkoutCategoryFilter)}
          aria-label="Workout category filter"
        >
          {WORKOUT_CATEGORY_FILTERS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <div className="stack">
        {visibleTimers.length === 0
          ? <p className="empty">No timers yet. Create your first interval plan.</p>
          : visibleTimers.map((timer, index) => (
            <TimerCard
              key={timer.id}
              timer={timer}
              intervalColors={settings.intervalColors}
              coachMode={settings.coachMode}
              featureImage={index === 0 ? firstCardImage : undefined}
              onDelete={onDeleteTimer}
              onClone={onCloneTimer}
              onCreateTemplate={onCreateTemplate}
            />
          ))}
      </div>

    </section>
  );
};
