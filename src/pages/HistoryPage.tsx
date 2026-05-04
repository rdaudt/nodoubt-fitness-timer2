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
import { useSettings } from '../services/settingsContext';
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

type RunExportPayload = TimerRun & {
  stationSetWorkoutTypes: Array<{
    stationSetNumber: number;
    workoutType: string;
  }>;
  exportedAt: string;
};

type GenerationState = {
  status: 'idle' | 'queued' | 'running' | 'success' | 'error';
  error: string | null;
  imageUrl: string | null;
  jobId: string | null;
};

type StoredJobInfo = {
  jobId: string;
  token: string;
  terminalStatus?: 'success' | 'error';
  imageUrl?: string | null;
  error?: string | null;
};

const JOBS_STORAGE_KEY = 'nodoubt_content_jobs_v1';

const toRunExportPayload = (run: TimerRun): RunExportPayload => {
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
  return payload;
};

const downloadRunExport = (run: TimerRun) => {
  const payload = toRunExportPayload(run);
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

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="history-stat-card">
    <span className="history-stat-label">{label}</span>
    <strong className="history-stat-value">{value}</strong>
  </div>
);

const buildImageFileName = (run: TimerRun): string => {
  const safeRunId = run.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeRanAt = run.ranAt.replace(/[:.]/g, '-');
  return `hiit-ig-${safeRunId}-${safeRanAt}.png`;
};

const downloadGeneratedImage = (url: string, fileName: string) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const loadStoredJobs = (): Record<string, StoredJobInfo> => {
  try {
    const raw = window.localStorage.getItem(JOBS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as Record<string, StoredJobInfo>;
  } catch {
    return {};
  }
};

const saveStoredJobs = (jobs: Record<string, StoredJobInfo>) => {
  window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
};

export const HistoryPage = () => {
  const { settings } = useSettings();
  const [runs, setRuns] = useState<TimerRun[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [draftTimerName, setDraftTimerName] = useState('');
  const [draftDateTime, setDraftDateTime] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftStationWorkoutTypes, setDraftStationWorkoutTypes] = useState<string[]>([]);
  const [generationByRunId, setGenerationByRunId] = useState<Record<string, GenerationState>>({});

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

  const setGenerationState = (runId: string, next: GenerationState) => {
    setGenerationByRunId((prev) => ({
      ...prev,
      [runId]: next,
    }));
  };

  useEffect(() => {
    let isCancelled = false;

    const syncJobs = async () => {
      const jobs = loadStoredJobs();
      const runIds = Object.keys(jobs).filter((runId) => {
        const stored = jobs[runId];
        return stored?.terminalStatus !== 'success' && stored?.terminalStatus !== 'error';
      });
      if (runIds.length === 0) {
        return;
      }

      await Promise.all(runIds.map(async (runId) => {
        const jobInfo = jobs[runId];
        if (!jobInfo) {
          return;
        }
        try {
          const search = new URLSearchParams({ jobId: jobInfo.jobId, token: jobInfo.token });
          const response = await fetch(`/api/content-jobs-status?${search.toString()}`);
          const body = await response.json() as { status?: string; imageUrl?: string | null; error?: string | null };
          if (!response.ok) {
            throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load generation status.');
          }
          if (isCancelled) {
            return;
          }

          if (body.status === 'completed' && body.imageUrl) {
            jobs[runId] = {
              ...jobInfo,
              terminalStatus: 'success',
              imageUrl: body.imageUrl,
              error: null,
            };
            saveStoredJobs(jobs);
            setGenerationState(runId, { status: 'success', error: null, imageUrl: body.imageUrl, jobId: jobInfo.jobId });
          } else if (body.status === 'failed') {
            jobs[runId] = {
              ...jobInfo,
              terminalStatus: 'error',
              imageUrl: null,
              error: body.error ?? 'Generation failed.',
            };
            saveStoredJobs(jobs);
            setGenerationState(runId, { status: 'error', error: body.error ?? 'Generation failed.', imageUrl: null, jobId: jobInfo.jobId });
          } else if (body.status === 'running') {
            setGenerationState(runId, { status: 'running', error: null, imageUrl: null, jobId: jobInfo.jobId });
          } else if (body.status === 'queued') {
            setGenerationState(runId, { status: 'queued', error: null, imageUrl: null, jobId: jobInfo.jobId });
          }
        } catch (error) {
          if (isCancelled) {
            return;
          }
          jobs[runId] = {
            ...jobInfo,
            terminalStatus: 'error',
            imageUrl: null,
            error: error instanceof Error ? error.message : 'Failed to load generation status.',
          };
          saveStoredJobs(jobs);
          setGenerationState(runId, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to load generation status.',
            imageUrl: null,
            jobId: jobInfo.jobId,
          });
        }
      }));
    };

    void syncJobs();
    const intervalId = window.setInterval(() => {
      void syncJobs();
    }, 10000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const jobs = loadStoredJobs();
    Object.entries(jobs).forEach(([runId, info]) => {
      if (info.terminalStatus === 'success' && info.imageUrl) {
        setGenerationState(runId, { status: 'success', error: null, imageUrl: info.imageUrl, jobId: info.jobId });
      }
      if (info.terminalStatus === 'error') {
        setGenerationState(runId, {
          status: 'error',
          error: info.error ?? 'Generation failed.',
          imageUrl: null,
          jobId: info.jobId,
        });
      }
    });
  }, []);

  const startEdit = (run: TimerRun) => {
    setEditingRunId(run.id);
    setDraftTimerName(run.timerNameAtRun);
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
      timerNameAtRun: draftTimerName.trim() || run.timerNameAtRun,
      ranAt: parsed.toISOString(),
      location: draftLocation.trim(),
      category: 'GENERAL',
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

  const hasCompleteWorkoutTypes = (run: TimerRun): boolean => {
    const snapshot = normalizeTimerFields(run.timerSnapshot);
    const workoutTypes = (run.stationWorkoutTypes ?? snapshot.stationWorkoutTypes ?? [])
      .slice(0, snapshot.stationCount)
      .map((item) => item.trim());
    return workoutTypes.length === snapshot.stationCount && workoutTypes.every((item) => item.length > 0);
  };

  const generateIgImage = async (run: TimerRun) => {
    if (!settings.coachMode) {
      return;
    }
    if (!run.complete || !hasCompleteWorkoutTypes(run)) {
      setGenerationState(run.id, {
        status: 'error',
        error: 'Run must be complete and all station workout types must be filled.',
        imageUrl: null,
        jobId: null,
      });
      return;
    }
    const password = window.prompt('Enter coach password to generate IG image');
    if (password !== 'kobetheabby') {
      setGenerationState(run.id, {
        status: 'error',
        error: 'Invalid password.',
        imageUrl: null,
        jobId: null,
      });
      return;
    }

    setGenerationState(run.id, { status: 'queued', error: null, imageUrl: null, jobId: null });
    try {
      const exportPayload = toRunExportPayload(run);
      const response = await fetch('/api/content-jobs-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ run: exportPayload }),
      });
      const rawText = await response.text();
      let body: { jobId?: string; token?: string; error?: string } = {};
      if (rawText.trim().length > 0) {
        try {
          body = JSON.parse(rawText) as { jobId?: string; token?: string; error?: string };
        } catch {
          body = {};
        }
      }
      if (!response.ok || !body.jobId || !body.token) {
        const fallback = rawText.trim().length > 0
          ? rawText
          : `HTTP ${response.status} ${response.statusText}`.trim();
        throw new Error(body.error ?? fallback ?? 'Image job creation failed.');
      }
      const jobs = loadStoredJobs();
      jobs[run.id] = {
        jobId: body.jobId,
        token: body.token,
        terminalStatus: undefined,
        imageUrl: null,
        error: null,
      };
      saveStoredJobs(jobs);
      setGenerationState(run.id, { status: 'queued', error: null, imageUrl: null, jobId: body.jobId });
    } catch (error) {
      setGenerationState(run.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Image job creation failed.',
        imageUrl: null,
        jobId: null,
      });
    }
  };

  const deleteGeneratedImage = async (run: TimerRun) => {
    const jobs = loadStoredJobs();
    const jobInfo = jobs[run.id];
    if (!jobInfo) {
      return;
    }
    try {
      const search = new URLSearchParams({ jobId: jobInfo.jobId, token: jobInfo.token });
      const response = await fetch(`/api/content-jobs-delete?${search.toString()}`, { method: 'DELETE' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete generated media.');
      }
      delete jobs[run.id];
      saveStoredJobs(jobs);
      setGenerationState(run.id, { status: 'idle', error: null, imageUrl: null, jobId: null });
    } catch (error) {
      setGenerationState(run.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to delete generated media.',
        imageUrl: null,
        jobId: jobInfo.jobId,
      });
    }
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
            const generation = generationByRunId[run.id] ?? {
              status: 'idle',
              error: null,
              imageUrl: null,
              jobId: null,
            };
            const canGenerate = settings.coachMode && run.complete && hasCompleteWorkoutTypes(run);
            return (
              <article key={run.id} className="timer-run-card history-run-card">
                <div className="history-run-card-head">
                  <div className="history-run-title-wrap">
                    {activeTimer ? (
                      <Link to={`/timer/${run.timerId}`} className="history-run-title-link">
                        {run.timerNameAtRun}
                      </Link>
                    ) : (
                      <p className="history-run-title-link">{run.timerNameAtRun} (Deleted timer)</p>
                    )}
                    <p className="history-run-datetime">{new Date(run.ranAt).toLocaleString()}</p>
                  </div>
                  <span className={`history-run-complete ${run.complete ? 'is-on' : 'is-off'}`}>
                    {run.complete ? 'Complete' : 'Incomplete'}
                  </span>
                </div>

                {!isEditing ? (
                  <>
                    <div className="history-stats-grid">
                      <StatCard label="Total Time" value={formatClock(runSeconds)} />
                      <StatCard label="Work/Rest" value={`${formatClock(workSeconds)} / ${formatClock(restSeconds)}`} />
                      <StatCard label="Rounds" value={String(normalizedSnapshot.roundsPerStation)} />
                      <StatCard label="Stations" value={String(normalizedSnapshot.stationCount)} />
                    </div>
                    <p className="history-run-location">Location: {run.location || 'Not set'}</p>
                    <div className="history-card-actions" aria-label="Run actions">
                      <button className="secondary-btn history-action-btn" onClick={() => downloadRunExport(run)}>Data Export</button>
                      {settings.coachMode && (
                        <button
                          className="primary-btn history-action-btn"
                          onClick={() => void generateIgImage(run)}
                          disabled={!canGenerate || generation.status === 'queued' || generation.status === 'running'}
                        >
                          {(generation.status === 'queued' || generation.status === 'running') ? 'Creating...' : 'Create Content'}
                        </button>
                      )}
                      <button className="secondary-btn history-action-icon" onClick={() => startEdit(run)} aria-label="Edit">✎</button>
                      <button className="danger-btn history-action-icon" onClick={() => void deleteRun(run.id)} aria-label="Delete">🗑</button>
                    </div>

                    {settings.coachMode && !canGenerate && (
                      <p className="history-share-note">IG generation requires a complete run and workout type set for every station.</p>
                    )}
                    {generation.status === 'queued' && <p>Content generation queued.</p>}
                    {generation.status === 'running' && <p>Content generation in progress.</p>}
                    {generation.error && <p role="alert">IG generation error: {generation.error}</p>}
                    {generation.imageUrl && (
                      <>
                        <div className="history-card-actions" aria-label="Generated media actions">
                          <button
                            className="secondary-btn history-action-btn"
                            onClick={() => downloadGeneratedImage(generation.imageUrl ?? '', buildImageFileName(run))}
                          >
                            Download Content
                          </button>
                          <button
                            className="danger-btn history-action-btn"
                            onClick={() => void deleteGeneratedImage(run)}
                          >
                            Delete Content
                          </button>
                        </div>
                        <img
                          src={generation.imageUrl}
                          alt={`Generated IG preview for ${run.timerNameAtRun}`}
                          className="about-kobe-ai-image"
                        />
                      </>
                    )}
                  </>
                ) : (
                  <div className="history-edit-layout">
                    <section className="history-edit-section">
                      <h2 className="history-edit-title">General Parameters</h2>
                      <label className="field">
                        <span>Session Name</span>
                        <input
                          type="text"
                          value={draftTimerName}
                          maxLength={25}
                          onChange={(e) => setDraftTimerName(e.target.value)}
                          aria-label="Run timer name"
                          placeholder="Timer name"
                        />
                      </label>
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
                    </section>

                    <section className="history-edit-section">
                      <h2 className="history-edit-title">Timing & Intervals</h2>
                      <div className="history-readonly-grid">
                        <StatCard label="Stations" value={String(normalizedSnapshot.stationCount)} />
                        <StatCard label="Rounds" value={String(normalizedSnapshot.roundsPerStation)} />
                        <StatCard label="Work" value={formatClock(workSeconds)} />
                        <StatCard label="Rest" value={formatClock(restSeconds)} />
                        <StatCard label="Transition" value={formatClock(transitionSeconds)} />
                        <StatCard label="Warmup" value={formatClock(warmupSeconds)} />
                        <StatCard label="Cooldown" value={formatClock(cooldownSeconds)} />
                        <StatCard label="Per Station" value={formatClock(totalPerStationSeconds)} />
                        <StatCard label="Total Work" value={formatClock(totalWorkSeconds)} />
                      </div>
                    </section>

                    <section className="history-edit-section">
                      <h2 className="history-edit-title">Workout Types</h2>
                      <div className="stack">
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
                    </section>

                    <div className="history-edit-actions">
                      <button className="secondary-btn" onClick={() => setEditingRunId(null)}>Cancel</button>
                      <button className="primary-btn" onClick={() => void saveEdit(run)}>Save Session</button>
                    </div>
                  </div>
                )}
                {!isEditing && runWorkoutTypes.length > 0 && (
                  <p className="history-run-types">
                    Workout Types: {runWorkoutTypes.join(', ')}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
