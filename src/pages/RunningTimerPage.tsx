import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { withAlpha } from '../lib/color';
import { formatClock } from '../lib/time';
import { useTimerRunner } from '../lib/useTimerRunner';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { IntervalType, Timer } from '../types';

const intervalCatByType: Record<IntervalType, string> = {
  warmup: '/assets/cat-in-pajama-transparent-v3.png',
  work: '/assets/work-cat.png',
  rest: '/assets/resting-cat.png',
  cooldown: '/assets/tired-cat-transparent-v1.png',
};

const workCats = [
  '/assets/jab-throwing-cat.png',
  '/assets/vintage-apparel-pushup.png',
  '/assets/vintage-apparel-crunches.png',
];

const shuffled = (items: string[]): string[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const RunningTimerPage = () => {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const [timer, setTimer] = useState<Timer | null>(null);
  const [confirmAction, setConfirmAction] = useState<'stop' | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    TimerRepository.get(id).then((value) => setTimer(value ?? null));
  }, [id]);

  const runner = useTimerRunner(
    timer ?? {
      id: 'empty',
      name: 'Missing Timer',
      sets: 1,
      repeatSetsUntilStopped: false,
      intervals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );

  const runCatByEntryId = useMemo(() => {
    const map: Record<string, string> = {};
    let workCycle = shuffled(workCats);
    let workCycleIndex = 0;

    runner.timeline.forEach((entry) => {
      if (entry.type === 'work') {
        if (workCycle.length === 0) {
          map[entry.id] = intervalCatByType.work;
          return;
        }

        map[entry.id] = workCycle[workCycleIndex];
        workCycleIndex += 1;

        if (workCycleIndex >= workCycle.length) {
          workCycle = shuffled(workCats);
          workCycleIndex = 0;
        }
      } else {
        map[entry.id] = intervalCatByType[entry.type];
      }
    });
    return map;
  }, [runner.timeline]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [runner.state.currentIndex]);

  useEffect(() => {
    if (!timer) {
      return;
    }
    if (autoStartedRef.current) {
      return;
    }
    if (runner.state.status !== 'idle') {
      return;
    }
    if (runner.timeline.length === 0) {
      return;
    }

    autoStartedRef.current = true;
    runner.start();
  }, [runner, timer]);

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  const donePath = searchParams.get('from') === 'home' ? '/' : `/timer/${timer.id}`;
  const activeEntry = runner.timeline[runner.state.currentIndex];
  const currentSet = runner.state.currentSetNumber;
  const visibleIntervals = (() => {
    if (timer.repeatSetsUntilStopped) {
      if (activeEntry?.type === 'warmup') {
        return timer.intervals.filter((x) => x.type !== 'cooldown');
      }
      return timer.intervals.filter((x) => x.type === 'work' || x.type === 'rest');
    }
    if (timer.sets <= 1) {
      return timer.intervals;
    }
    if (currentSet <= 1) {
      return timer.intervals.filter((x) => x.type !== 'cooldown');
    }
    if (currentSet >= timer.sets) {
      return timer.intervals.filter((x) => x.type !== 'warmup');
    }
    return timer.intervals.filter((x) => x.type === 'work' || x.type === 'rest');
  })();
  const activeVisibleIndex = visibleIntervals.findIndex((x) => x.sequence === activeEntry?.sourceSequence);

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
  const isPausedBetweenSets = runner.state.status === 'paused' && runner.state.pauseReason === 'betweenSets';
  const isPausedAfterWarmup = runner.state.status === 'paused' && runner.state.pauseReason === 'afterWarmup';
  const isSetStartPause = isPausedAfterWarmup || isPausedBetweenSets;
  const isSetTransitionCountdown = runner.state.status === 'running' && runner.state.phase === 'setTransition';
  const pauseMessage = isPausedAfterWarmup
    ? 'Prepare to start first set'
    : isPausedBetweenSets
      ? 'Prepare for the next set'
      : '';

  return (
    <section>
      <header className="run-header">
        <p className="run-name">{timer.name}</p>
        <p className="run-remaining">
          {timer.repeatSetsUntilStopped ? `Set ${Math.max(1, currentSet)}` : `Set ${Math.max(1, currentSet)} of ${timer.sets}`}
        </p>
        <p className="run-remaining">
          Total remaining: {timer.repeatSetsUntilStopped ? 'Until stopped' : formatClock(runner.state.totalRemainingMs / 1000)}
        </p>
        {isSetTransitionCountdown && <p className="run-paused-flag pulse">Set transition</p>}
        {isSetStartPause && <p className="run-paused-flag run-set-start-flag pulse">{pauseMessage}</p>}
      </header>

      <div className="actions-row wrap">
        {runner.state.status === 'running' && !isSetTransitionCountdown && <button className="secondary-btn" onClick={requestPause}>Pause</button>}
        {runner.state.status === 'paused' && (
          <button className="primary-btn" onClick={runner.resume}>
            {isSetStartPause ? 'Start' : 'Resume'}
          </button>
        )}
        {(runner.state.status === 'running' || runner.state.status === 'paused') && (
          <button className="danger-btn" onClick={requestStop}>{isSetStartPause ? 'Cancel' : 'Stop'}</button>
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

      <div className="stack timeline-list">
        {visibleIntervals.map((entry, index) => {
          const state = runner.state.status === 'completed'
            ? 'done'
            : index < activeVisibleIndex
              ? 'done'
              : index === activeVisibleIndex
                ? 'active'
                : 'upcoming';
          const intervalColor = settings.intervalColors[entry.type];
          const isActiveSetTransition = isSetTransitionCountdown && state === 'active';
          const surfaceColor = isActiveSetTransition
            ? '#ffffff'
            : withAlpha(intervalColor, state === 'active' ? 0.85 : 0.68);
          const showRunningCat = state === 'active'
            && !isActiveSetTransition
            && (runner.state.status === 'running' || runner.state.status === 'paused');
          const showIntervalType = isSetTransitionCountdown
            ? state === 'active'
            : entry.name.trim().toLowerCase() !== entry.type.toLowerCase();
          const intervalTitle = isSetTransitionCountdown && state === 'active'
            ? 'Set Transition'
            : entry.name;
          const intervalTypeLabel = isSetTransitionCountdown && state === 'active'
            ? `Next: ${entry.name}`
            : entry.type;
          return (
            <div
              key={`${entry.sequence}-${entry.type}`}
              ref={index === activeVisibleIndex ? activeRef : null}
              className={`timeline-item ${state}${showRunningCat ? ' has-cat' : ''}${isActiveSetTransition ? ' set-transition-card' : ''}`}
              style={{
                backgroundColor: surfaceColor,
              }}
            >
              {showRunningCat && activeEntry && (
                <img className="timeline-cat-bg" src={runCatByEntryId[activeEntry.id]} alt="" aria-hidden="true" />
              )}

              <div className="timeline-content">
                <p className="timeline-interval-title">{intervalTitle}</p>
                {showIntervalType && <p className="timeline-interval-type">{intervalTypeLabel}</p>}
              </div>
              <p className={state === 'active' ? 'timeline-time live' : 'timeline-time'}>
                {state === 'active'
                  ? formatClock(runner.state.currentRemainingMs / 1000)
                  : formatClock((entry.durationMinutes * 60 + entry.durationSeconds))}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
