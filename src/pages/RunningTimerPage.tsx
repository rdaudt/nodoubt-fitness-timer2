import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatClock } from '../lib/time';
import { useTimerRunner } from '../lib/useTimerRunner';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { AppSettings, CountdownType, Timer, TimelineEntry } from '../types';

const currentImageByType: Partial<Record<CountdownType, string>> = {
  warmup: '/assets/cat-in-pajama-transparent-v3.png',
  work: '/assets/jab-throwing-cat.png',
  rest: '/assets/resting-cat.png',
  cooldown: '/assets/tired-cat-transparent-v1.png',
};

const workImages = [
  '/assets/jab-throwing-cat.png',
  '/assets/vintage-apparel-pushup.png',
  '/assets/vintage-apparel-crunches.png',
  '/assets/pullup-cat.png',
];

const emptyTimer = (): Timer => ({
  id: 'empty',
  name: 'Missing Timer',
  stationCount: 1,
  roundsPerStation: 1,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 0,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 30,
  startStationWorkManually: false,
  warmupEnabled: false,
  warmupMinutes: 0,
  warmupSeconds: 0,
  cooldownEnabled: false,
  cooldownMinutes: 0,
  cooldownSeconds: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const entryTitle = (entry: TimelineEntry | undefined, coachMode: boolean): string => {
  if (!entry) {
    return 'Done';
  }
  if (entry.type === 'stationTransition') {
    return `${coachMode ? 'Station Transition' : 'Set Transition'} ${entry.stationNumber}`;
  }
  if (entry.type === 'work') {
    return 'Work';
  }
  if (entry.type === 'rest') {
    return 'Rest';
  }
  if (entry.type === 'warmup') {
    return 'Warmup';
  }
  return 'Cooldown';
};

const entryContext = (entry: TimelineEntry | undefined, coachMode: boolean): string => {
  if (!entry) {
    return '';
  }
  const stationLabel = coachMode ? 'Station' : 'Set';
  if (entry.type === 'work') {
    return `${stationLabel} ${entry.stationNumber} - Round ${entry.roundNumber}`;
  }
  if (entry.type === 'rest') {
    return `${stationLabel} ${entry.stationNumber} - Round ${entry.roundNumber}`;
  }
  return '';
};
const entryCardStyle = (
  entry: TimelineEntry | undefined,
  intervalColors: AppSettings['intervalColors'],
) => {
  if (!entry) {
    return {};
  }
  if (entry.type === 'stationTransition') {
    return { backgroundColor: '#ffffff', color: '#111111' };
  }
  if (entry.type in intervalColors) {
    return { backgroundColor: intervalColors[entry.type as keyof typeof intervalColors], color: '#ffffff' };
  }
  return {};
};

export const RunningTimerPage = () => {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const [timer, setTimer] = useState<Timer | null>(null);
  const [confirmAction, setConfirmAction] = useState<'stop' | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    TimerRepository.get(id).then((value) => setTimer(value ?? null));
  }, [id]);

  const runner = useTimerRunner(timer ?? emptyTimer(), settings.coachMode);

  useEffect(() => {
    if (!timer || autoStartedRef.current || runner.state.status !== 'idle' || runner.timeline.length === 0) {
      return;
    }
    autoStartedRef.current = true;
    runner.start();
  }, [runner, timer]);

  const donePath = searchParams.get('from') === 'home' ? '/' : `/timer/${timer?.id ?? id}`;
  const activeEntry = runner.timeline[runner.state.currentIndex];
  const nextEntry = runner.timeline[runner.state.currentIndex + 1];
  const isStationStartPause = runner.state.status === 'paused' && runner.state.pauseReason === 'stationStart';
  const workImageByEntryId = useMemo(() => {
    const imageByEntryId: Record<string, string> = {};
    let workIndex = 0;

    runner.timeline.forEach((entry) => {
      if (entry.type !== 'work') {
        return;
      }
      imageByEntryId[entry.id] = workImages[workIndex % workImages.length];
      workIndex += 1;
    });

    return imageByEntryId;
  }, [runner.timeline]);
  const currentImage = useMemo(() => {
    if (!activeEntry) {
      return undefined;
    }
    if (activeEntry.type === 'work') {
      return workImageByEntryId[activeEntry.id] ?? currentImageByType.work;
    }
    return currentImageByType[activeEntry.type];
  }, [activeEntry, workImageByEntryId]);
  const currentStyle = useMemo(
    () => entryCardStyle(activeEntry, settings.intervalColors),
    [activeEntry, settings.intervalColors],
  );
  const nextStyle = useMemo(
    () => entryCardStyle(nextEntry, settings.intervalColors),
    [nextEntry, settings.intervalColors],
  );

  const requestPause = async () => {
    if (runner.state.status === 'running') {
      await runner.pause();
    }
  };

  const requestStop = () => {
    if (runner.state.status === 'running') {
      setConfirmAction('stop');
      return;
    }
    runner.stop();
  };

  const confirm = async () => {
    if (confirmAction === 'stop') {
      await runner.stop();
    }
    setConfirmAction(null);
  };

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  return (
    <section className="run-page">
      <header className="run-header">
        <p className="run-name">{timer.name}</p>
        <p className="run-remaining">Total remaining: {formatClock(runner.state.totalRemainingMs / 1000)}</p>
        {isStationStartPause && <p className="run-paused-flag run-set-start-flag pulse">Prepare to start</p>}
      </header>

      <article
        className={`run-current-card ${activeEntry?.type === 'stationTransition' ? 'station-transition' : ''}`}
        style={currentStyle}
      >
        {currentImage && <img className="run-current-image" src={currentImage} alt="" aria-hidden="true" />}
        <div className="run-current-copy">
          <p className="run-current-context">{entryContext(activeEntry, settings.coachMode)}</p>
          <h1>{entryTitle(activeEntry, settings.coachMode)}</h1>
          <p className="run-current-time">{formatClock(runner.state.currentRemainingMs / 1000)}</p>
        </div>
      </article>

      <article className="run-next-card" style={nextStyle}>
        <span>next</span>
        <strong>{entryTitle(nextEntry, settings.coachMode)}</strong>
        {nextEntry && <p>{entryContext(nextEntry, settings.coachMode)} ({formatClock(nextEntry.durationMs / 1000)})</p>}
      </article>

      <div className="actions-row wrap run-actions">
        {runner.state.status === 'running' && <button className="secondary-btn" onClick={requestPause}>Pause Timer</button>}
        {runner.state.status === 'paused' && (
          <button className="primary-btn" onClick={runner.resume}>
            {isStationStartPause ? 'Start' : 'Resume'}
          </button>
        )}
        {(runner.state.status === 'running' || runner.state.status === 'paused') && (
          <button className="danger-btn" onClick={requestStop}>{isStationStartPause ? 'Cancel' : 'Stop Timer'}</button>
        )}
        {runner.state.status === 'completed' && <Link className="primary-btn" to={donePath}>Done</Link>}
      </div>

      {confirmAction && (
        <div className="confirm-box">
          <p className="confirm-text">Stop the timer?</p>
          <div className="actions-row">
            <button className="primary-btn" onClick={confirm}>Confirm</button>
            <button className="secondary-btn" onClick={() => setConfirmAction(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
};


