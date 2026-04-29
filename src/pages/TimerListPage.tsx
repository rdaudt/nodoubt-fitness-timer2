import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerCard } from '../components/TimerCard';
import { WORKOUT_CATEGORY_FILTERS, type WorkoutCategoryFilter } from '../config';
import { randomTimerName } from '../lib/timerFactory';
import { createTemplateFromTimer } from '../services/templateService';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

const homeCardImages = Object.entries(
  import.meta.glob('../../media/timer-card-images/bw/*.{png,jpg,jpeg,webp,avif}', {
    eager: true,
    import: 'default',
  }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, value]) => String(value));

const shuffledCopy = (values: string[]): string[] => {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const assignCardImages = (cardCount: number): Array<string | undefined> => {
  if (cardCount <= 0 || homeCardImages.length === 0) {
    return [];
  }

  const assignments: Array<string | undefined> = [];
  while (assignments.length < cardCount) {
    const shuffled = shuffledCopy(homeCardImages);
    for (const image of shuffled) {
      assignments.push(image);
      if (assignments.length === cardCount) {
        break;
      }
    }
  }

  return assignments;
};

export const TimerListPage = () => {
  const { settings, saveSettings } = useSettings();
  const [timers, setTimers] = useState<Timer[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilter>('ALL');
  const [cardImages, setCardImages] = useState<Array<string | undefined>>([]);

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

  const visibleTimers = useMemo(
    () => (categoryFilter === 'ALL'
      ? timers
      : timers.filter((timer) => timer.category === categoryFilter)),
    [categoryFilter, timers],
  );

  useEffect(() => {
    setCardImages(assignCardImages(visibleTimers.length));
  }, [visibleTimers]);

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
              featureImage={cardImages[index]}
              onDelete={onDeleteTimer}
              onClone={onCloneTimer}
              onCreateTemplate={onCreateTemplate}
            />
          ))}
      </div>

    </section>
  );
};
