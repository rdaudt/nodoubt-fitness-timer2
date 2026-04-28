import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { estimateTimerDurationMs, formatClock } from '../lib/time';
import { normalizeTimerFields } from '../lib/timerRules';
import { TimerRepository, TimerRunRepository } from '../services/storage';
import type { Timer, TimerRun } from '../types';

const toDateTimeLocal = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const HistoryPage = () => {
  const [runs, setRuns] = useState<TimerRun[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [draftDateTime, setDraftDateTime] = useState('');
  const [draftLocation, setDraftLocation] = useState('');

  useEffect(() => {
    Promise.all([TimerRunRepository.listAll(), TimerRepository.list()]).then(([allRuns, allTimers]) => {
      setRuns(allRuns);
      setTimers(allTimers);
    });
  }, []);

  const timerById = useMemo(
    () => new Map(timers.map((timer) => [timer.id, timer])),
    [timers],
  );

  const startEdit = (run: TimerRun) => {
    setEditingRunId(run.id);
    setDraftDateTime(toDateTimeLocal(run.ranAt));
    setDraftLocation(run.location ?? '');
  };

  const saveEdit = async (run: TimerRun) => {
    const parsed = new Date(draftDateTime);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const next: TimerRun = {
      ...run,
      ranAt: parsed.toISOString(),
      location: draftLocation.trim(),
      updatedAt: new Date().toISOString(),
    };
    await TimerRunRepository.update(next);
    setRuns((prev) => prev
      .map((item) => (item.id === run.id ? next : item))
      .sort((a, b) => +new Date(b.ranAt) - +new Date(a.ranAt)));
    setEditingRunId(null);
  };

  const deleteRun = async (runId: string) => {
    const ok = window.confirm('Delete this run?');
    if (!ok) {
      return;
    }
    await TimerRunRepository.remove(runId);
    setRuns((prev) => prev.filter((run) => run.id !== runId));
  };

  return (
    <section className="history-page">
      <div className="section-header">
        <h1 className="screen-title">Run History</h1>
      </div>
      {runs.length === 0 ? (
        <p className="empty">No runs logged yet.</p>
      ) : (
        <div className="stack">
          {runs.map((run) => {
            const activeTimer = timerById.get(run.timerId);
            const runSeconds = Math.floor(estimateTimerDurationMs(normalizeTimerFields(run.timerSnapshot)) / 1000);
            const isEditing = editingRunId === run.id;
            return (
              <article key={run.id} className="timer-run-card">
                <p>
                  {activeTimer ? (
                    <Link to={`/timer/${run.timerId}`}>{run.timerNameAtRun}</Link>
                  ) : (
                    <span>{run.timerNameAtRun} (Deleted timer)</span>
                  )}
                </p>
                {isEditing ? (
                  <>
                    <label className="field">
                      <span>Date & time</span>
                      <input
                        type="datetime-local"
                        value={draftDateTime}
                        onChange={(e) => setDraftDateTime(e.target.value)}
                        aria-label="Run date and time"
                      />
                    </label>
                    <label className="field">
                      <span>Location</span>
                      <input
                        type="text"
                        value={draftLocation}
                        onChange={(e) => setDraftLocation(e.target.value)}
                        aria-label="Run location"
                        placeholder="Location"
                      />
                    </label>
                    <div className="actions-row wrap">
                      <button className="primary-btn" onClick={() => void saveEdit(run)}>Save</button>
                      <button className="secondary-btn" onClick={() => setEditingRunId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p><strong>{new Date(run.ranAt).toLocaleString()}</strong></p>
                    <p>Complete: {run.complete ? 'ON' : 'OFF'}</p>
                    <p>Location: {run.location || 'Not set'}</p>
                    <p>Snapshot total: {formatClock(runSeconds)}</p>
                    <div className="actions-row wrap">
                      <button className="secondary-btn" onClick={() => startEdit(run)}>Edit</button>
                      <button className="danger-btn" onClick={() => void deleteRun(run.id)}>Delete</button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
