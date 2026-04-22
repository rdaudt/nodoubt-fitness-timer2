import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatClock } from '../lib/time';
import { useTimerRunner } from '../lib/useTimerRunner';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

export const RunningTimerPage = () => {
  const { id = '' } = useParams();
  const { settings } = useSettings();
  const [timer, setTimer] = useState<Timer | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [runner.state.currentIndex]);

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  const current = runner.timeline[runner.state.currentIndex];
  const currentColor = current ? settings.intervalColors[current.type] : '#D4A017';

  return (
    <section>
      <header className="run-header">
        <p className="run-name">{timer.name}</p>
        <p className="run-remaining">Total remaining: {formatClock(runner.state.totalRemainingMs / 1000)}</p>
      </header>

      <div className="chrono" style={{ borderColor: currentColor, boxShadow: `0 0 24px ${currentColor}33` }}>
        <p className="chrono-label">{current ? current.name : 'Completed'}</p>
        <p className="chrono-time">{formatClock(runner.state.currentRemainingMs / 1000)}</p>
      </div>

      <div className="actions-row wrap">
        {runner.state.status === 'idle' && <button className="primary-btn" onClick={runner.start}>Start</button>}
        {runner.state.status === 'running' && <button className="secondary-btn" onClick={runner.pause}>Pause</button>}
        {runner.state.status === 'paused' && <button className="primary-btn" onClick={runner.resume}>Resume</button>}
        {(runner.state.status === 'running' || runner.state.status === 'paused') && (
          <button className="danger-btn" onClick={runner.stop}>Stop</button>
        )}
        {runner.state.status === 'completed' && <Link className="primary-btn" to={`/timer/${timer.id}`}>Done</Link>}
      </div>

      <div className="stack timeline-list">
        {runner.timeline.map((entry, index) => {
          const state = index < runner.state.currentIndex ? 'done' : index === runner.state.currentIndex ? 'active' : 'upcoming';
          return (
            <div
              key={entry.id}
              ref={index === runner.state.currentIndex ? activeRef : null}
              className={`timeline-item ${state}`}
              style={{ borderLeftColor: settings.intervalColors[entry.type] }}
            >
              <div>
                <p>{entry.name}</p>
                <p className="interval-sub">{entry.setNumber ? `Set ${entry.setNumber}` : entry.type}</p>
              </div>
              <p>{formatClock(entry.durationMs / 1000)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
