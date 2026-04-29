import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  estimateTimerDurationMs,
  formatClock,
  getCooldownDurationMs,
  getRestDurationMs,
  getTransitionDurationMs,
  getWarmupDurationMs,
  getWorkDurationMs,
} from '../lib/time';
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

const downloadRunExport = (run: TimerRun) => {
  const snapshot = normalizeTimerFields(run.timerSnapshot);
  const workoutTypes = (run.stationWorkoutTypes ?? snapshot.stationWorkoutTypes ?? [])
    .slice(0, snapshot.stationCount)
    .map((item) => item.trim());
  const stationSetWorkoutTypes = Array.from({ length: snapshot.stationCount }, (_, index) => ({
    stationSetNumber: index + 1,
    workoutType: workoutTypes[index] ?? '',
  }));
  const payload = {
    ...run,
    stationSetWorkoutTypes,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeRunId = run.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeRanAt = run.ranAt.replace(/[:.]/g, '-');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hiit-run-${safeRunId}-${safeRanAt}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const HistoryPage = () => {
  const [runs, setRuns] = useState<TimerRun[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [draftDateTime, setDraftDateTime] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftStationWorkoutTypes, setDraftStationWorkoutTypes] = useState<string[]>([]);

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
    setDraftStationWorkoutTypes((run.stationWorkoutTypes ?? run.timerSnapshot.stationWorkoutTypes ?? []).slice(0, run.timerSnapshot.stationCount));
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
      stationWorkoutTypes: draftStationWorkoutTypes
        .slice(0, run.timerSnapshot.stationCount)
        .map((item) => item.trim()),
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
            const normalizedSnapshot = normalizeTimerFields(run.timerSnapshot);
            const runSeconds = Math.floor(estimateTimerDurationMs(normalizedSnapshot) / 1000);
            const warmupSeconds = Math.floor(getWarmupDurationMs(normalizedSnapshot) / 1000);
            const cooldownSeconds = Math.floor(getCooldownDurationMs(normalizedSnapshot) / 1000);
            const workSeconds = Math.floor(getWorkDurationMs(normalizedSnapshot) / 1000);
            const restSeconds = Math.floor(getRestDurationMs(normalizedSnapshot) / 1000);
            const transitionSeconds = Math.floor(getTransitionDurationMs(normalizedSnapshot) / 1000);
            const totalPerStationSeconds = Math.floor(run.totalPerStationMs / 1000);
            const totalWorkSeconds = Math.floor(run.totalWorkMs / 1000);
            const runWorkoutTypes = (run.stationWorkoutTypes ?? normalizedSnapshot.stationWorkoutTypes ?? [])
              .slice(0, normalizedSnapshot.stationCount)
              .map((item) => item.trim())
              .filter((item) => item.length > 0);
            const isEditing = editingRunId === run.id;
            return (
              <article key={run.id} className="timer-run-card">
                <p>
                  {activeTimer ? (
                    <Link to={`/timer/${run.timerId}`}>HIIT Session Name: {run.timerNameAtRun}</Link>
                  ) : (
                    <span>HIIT Session Name: {run.timerNameAtRun} (Deleted timer)</span>
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
                    <div className="stack">
                      <p>Workout Types (Optional)</p>
                      {Array.from({ length: run.timerSnapshot.stationCount }, (_, index) => (
                        <label className="field" key={`run-${run.id}-station-${index + 1}`}>
                          <span>Station {index + 1}</span>
                          <input
                            type="text"
                            value={draftStationWorkoutTypes[index] ?? ''}
                            onChange={(e) => setDraftStationWorkoutTypes((prev) => {
                              const next = [...prev];
                              next[index] = e.target.value;
                              return next;
                            })}
                            aria-label={`Run station ${index + 1} workout type`}
                            placeholder="e.g. pushups"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="actions-row wrap">
                      <button className="primary-btn" onClick={() => void saveEdit(run)}>Save</button>
                      <button className="secondary-btn" onClick={() => setEditingRunId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p><strong>Date & start time: {new Date(run.ranAt).toLocaleString()}</strong></p>
                    <p>Complete: {run.complete ? 'ON' : 'OFF'}</p>
                    <p>Location: {run.location || 'Not set'}</p>
                    <p>Warmup time: {formatClock(warmupSeconds)}</p>
                    <p>Cooldown time: {formatClock(cooldownSeconds)}</p>
                    <p>Number of stations/sets: {normalizedSnapshot.stationCount}</p>
                    <p>Number of rounds per station/set: {normalizedSnapshot.roundsPerStation}</p>
                    <p>Work interval time: {formatClock(workSeconds)}</p>
                    <p>Rest interval time: {formatClock(restSeconds)}</p>
                    <p>Station/set transition time: {formatClock(transitionSeconds)}</p>
                    <p>
                      Name of the workout type in each station/set:{' '}
                      {runWorkoutTypes.length > 0 ? runWorkoutTypes.join(', ') : 'Not set'}
                    </p>
                    <p>Total time per station/set: {formatClock(totalPerStationSeconds)}</p>
                    <p>Total work time: {formatClock(totalWorkSeconds)}</p>
                    <p>Snapshot total: {formatClock(runSeconds)}</p>
                    <div className="actions-row wrap">
                      <button className="primary-btn" onClick={() => downloadRunExport(run)}>Export JSON</button>
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
