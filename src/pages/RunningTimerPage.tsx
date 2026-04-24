import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  '/assets/cat_1_crawling.png',
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
  const { settings } = useSettings();
  const [timer, setTimer] = useState<Timer | null>(null);
  const [confirmAction, setConfirmAction] = useState<'pause' | 'stop' | null>(null);
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

  const activeEntry = runner.timeline[runner.state.currentIndex];
  const currentSet = activeEntry?.setNumber ?? (activeEntry?.type === 'cooldown' ? timer.sets : 1);
  const visibleIntervals = (() => {
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

  const requestPause = () => {
    if (runner.state.status === 'running') {
      setConfirmAction('pause');
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
    if (confirmAction === 'pause') {
      await runner.pause();
    }
    if (confirmAction === 'stop') {
      await runner.stop();
    }
    setConfirmAction(null);
  };

  return (
    <section>
      <header className="run-header">
        <p className="run-name">{timer.name}</p>
        <p className="run-remaining">Set {Math.max(1, currentSet)} of {timer.sets}</p>
        <p className="run-remaining">Total remaining: {formatClock(runner.state.totalRemainingMs / 1000)}</p>
      </header>

      <div className="actions-row wrap">
        {runner.state.status === 'running' && <button className="secondary-btn" onClick={requestPause}>Pause</button>}
        {runner.state.status === 'paused' && <button className="primary-btn" onClick={runner.resume}>Resume</button>}
        {(runner.state.status === 'running' || runner.state.status === 'paused') && (
          <button className="danger-btn" onClick={requestStop}>Stop</button>
        )}
        {runner.state.status === 'completed' && <Link className="primary-btn" to={`/timer/${timer.id}`}>Done</Link>}
      </div>

      {confirmAction && (
        <div className="confirm-box">
          <p className="confirm-text">{confirmAction === 'pause' ? 'Pause the timer?' : 'Stop the timer?'}</p>
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
          const surfaceColor = withAlpha(intervalColor, state === 'active' ? 0.85 : 0.68);
          const showRunningCat = state === 'active' && runner.state.status === 'running';
          return (
            <div
              key={`${entry.sequence}-${entry.type}`}
              ref={index === activeVisibleIndex ? activeRef : null}
              className={`timeline-item ${state}`}
              style={{
                backgroundColor: surfaceColor,
              }}
            >
              <div>
                <p className="interval-title">{entry.name}</p>
                <p className="interval-sub">{entry.type}</p>
                {showRunningCat && activeEntry && <img className="timeline-cat" src={runCatByEntryId[activeEntry.id]} alt="" aria-hidden="true" />}
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
