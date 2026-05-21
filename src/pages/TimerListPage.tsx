import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimerCard } from '../components/TimerCard';
import { randomUniqueTimerName } from '../lib/timerFactory';
import { trackAnalyticsEvent } from '../services/analytics';
import { useCoachMode } from '../services/authContext';
import { createTemplateFromTimer } from '../services/templateService';
import { createNewTimer } from '../services/timerCreation';
import { useSettings } from '../services/settingsContext';
import { useTenant } from '../services/tenantContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

const homeCardImages = Object.entries(
  import.meta.glob('../../media/timer-card-images/color/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,avif,AVIF}', {
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

const assignCardImages = (cardCount: number, imagesInAllTimers: boolean): Array<string | undefined> => {
  if (cardCount <= 0 || homeCardImages.length === 0) {
    return [];
  }

  if (!imagesInAllTimers) {
    const shuffled = shuffledCopy(homeCardImages);
    return [shuffled[0], ...Array.from({ length: Math.max(0, cardCount - 1) }, () => undefined)];
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
  const { settings } = useSettings();
  const coachMode = useCoachMode();
  const navigate = useNavigate();
  const { toTenantPath } = useTenant();
  const [timers, setTimers] = useState<Timer[]>([]);
  const [cardImages, setCardImages] = useState<Array<string | undefined>>([]);
  const [creatingTimer, setCreatingTimer] = useState(false);
  const [createError, setCreateError] = useState('');

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
      name: randomUniqueTimerName(timers.map((item) => item.name)),
      category: 'GENERAL',
      createdAt: now,
      updatedAt: now,
    };
    await TimerRepository.upsert(clone);
    trackAnalyticsEvent('timer_cloned', {
      category: clone.category,
    });
    setTimers((prev) => [clone, ...prev]);
  };

  const onCreateTemplate = async (timer: Timer) => {
    const nextName = window.prompt('Template name', timer.name)?.trim();
    if (!nextName) {
      return;
    }
    await createTemplateFromTimer(timer, nextName);
  };

  const onCreateTimer = async () => {
    if (creatingTimer) {
      return;
    }
    setCreatingTimer(true);
    setCreateError('');
    try {
      const timer = await createNewTimer();
      navigate(toTenantPath(`/timer/${timer.id}`));
    } catch {
      setCreatingTimer(false);
      setCreateError('Could not create timer. Try again.');
    }
  };

  const visibleTimers = useMemo(() => timers, [timers]);

  useEffect(() => {
    setCardImages(assignCardImages(visibleTimers.length, settings.imagesInAllTimers));
  }, [settings.imagesInAllTimers, visibleTimers]);

  return (
    <section className="home-page">
      <div className="section-header">
        <h1 className="screen-title">Your HIIT Timers</h1>
        <button type="button" className="primary-btn" onClick={() => void onCreateTimer()} disabled={creatingTimer}>
          + New Timer
        </button>
      </div>
      {createError && <p className="error-inline">{createError}</p>}

      <div className="stack">
        {visibleTimers.length === 0
          ? <p className="empty">No timers yet. Create your first interval plan.</p>
          : visibleTimers.map((timer, index) => (
            <TimerCard
              key={timer.id}
              timer={timer}
              intervalColors={settings.intervalColors}
              coachMode={coachMode}
              featureImage={cardImages[index]}
              imageGrayscale={settings.bwTimerImages}
              onDelete={onDeleteTimer}
              onClone={onCloneTimer}
              onCreateTemplate={onCreateTemplate}
            />
          ))}
      </div>

    </section>
  );
};
