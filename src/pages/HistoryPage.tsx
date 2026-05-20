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
import { useCoachMode } from '../services/authContext';
import { HiitClassApi, sortHiitClasses } from '../services/hiitClassApi';
import { useTenant } from '../services/tenantContext';
import { TimerRepository } from '../services/storage';
import type { HiitClass, HiitClassLocation, Timer, TimerRun } from '../types';

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
const SHOW_CREATE_CONTENT_BUTTON = false;

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
  const coachMode = useCoachMode();
  const { slug, toTenantPath } = useTenant();
  const [runs, setRuns] = useState<HiitClass[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [locations, setLocations] = useState<HiitClassLocation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [draftClassDate, setDraftClassDate] = useState('');
  const [draftStartTime, setDraftStartTime] = useState('');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [generationByRunId, setGenerationByRunId] = useState<Record<string, GenerationState>>({});

  useEffect(() => {
    if (!coachMode) {
      return;
    }
    let active = true;
    Promise.all([HiitClassApi.list(slug), HiitClassApi.listLocations(slug), TimerRepository.list()])
      .then(([allRuns, allLocations, allTimers]) => {
        if (!active) {
          return;
        }
        setRuns(allRuns);
        setLocations(allLocations);
        setTimers(allTimers);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Failed to load HIIT Classes.');
      });
    return () => {
      active = false;
    };
  }, [coachMode, slug]);

  useEffect(() => {
    if (!coachMode) {
      TimerRepository.list().then((allTimers) => {
        setTimers(allTimers);
      });
    }
  }, [coachMode]);

  const timerById = useMemo(
    () => new Map(timers.map((timer) => [timer.id, timer])),
    [timers],
  );
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
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

  const startEdit = (run: HiitClass) => {
    const defaultLocationId = locations.find((location) => location.isDefault)?.id ?? '';
    setEditingRunId(run.id);
    setDraftClassDate(run.classDate ?? '');
    setDraftStartTime(run.startTime ?? '');
    setDraftEndTime(run.endTime ?? '');
    setDraftLocation(run.locationId ?? defaultLocationId);
  };

  const saveEdit = async (run: HiitClass) => {
    const next = await HiitClassApi.update(slug, run.id, {
      classDate: draftClassDate || null,
      startTime: draftStartTime || null,
      endTime: draftEndTime || null,
      locationId: draftLocation || null,
    });
    setRuns((prev) => sortHiitClasses(prev.map((item) => (item.id === run.id ? next : item))));
    setEditingRunId(null);
  };

  const deleteRun = async (runId: string) => {
    const ok = window.confirm('Delete this HIIT Class?');
    if (!ok) {
      return;
    }
    await HiitClassApi.remove(slug, runId);
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
    if (!coachMode) {
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
        <h1 className="screen-title">HIIT Classes</h1>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {runs.length === 0 ? (
        <p className="empty">No HIIT Classes logged yet.</p>
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
            const canGenerate = coachMode && run.complete && hasCompleteWorkoutTypes(run);
            return (
              <article key={run.id} className="timer-run-card history-run-card">
                <div className="history-run-card-head">
                  <div className="history-run-title-wrap">
                    {activeTimer ? (
                      <Link to={toTenantPath(`/timer/${run.timerId}`)} className="history-run-title-link">
                        {run.timerNameAtRun}
                      </Link>
                    ) : (
                      <p className="history-run-title-link">{run.timerNameAtRun} (Deleted timer)</p>
                    )}
                    <p className="history-run-datetime">
                      {run.classDate
                        ? `Class: ${run.classDate}${run.startTime ? ` ${run.startTime}` : ''}${run.endTime ? ` - ${run.endTime}` : ''}`
                        : `Run logged: ${new Date(run.ranAt).toLocaleString()}`}
                    </p>
                    <p className="history-run-location">{run.locationLabelAtRun || 'Not set'}</p>
                    {run.locationId && locationById.get(run.locationId)?.logoUrl && (
                      <img
                        src={locationById.get(run.locationId)?.logoUrl}
                        alt="Location logo"
                        className="history-location-logo"
                      />
                    )}
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
                    <div className="history-card-actions" aria-label="Run actions">
                      <button className="secondary-btn history-action-btn" onClick={() => downloadRunExport(run)}>Data Export</button>
                      {coachMode && SHOW_CREATE_CONTENT_BUTTON && (
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
                      <h2 className="history-edit-title">Class Details</h2>
                      <label className="field">
                        <span>Date</span>
                        <input
                          type="date"
                          value={draftClassDate}
                          onChange={(e) => setDraftClassDate(e.target.value)}
                          aria-label="Class date"
                        />
                      </label>
                      <label className="field">
                        <span>Start time</span>
                        <input
                          type="time"
                          value={draftStartTime}
                          onChange={(e) => setDraftStartTime(e.target.value)}
                          aria-label="Class start time"
                        />
                      </label>
                      <label className="field">
                        <span>End time</span>
                        <input
                          type="time"
                          value={draftEndTime}
                          onChange={(e) => setDraftEndTime(e.target.value)}
                          aria-label="Class end time"
                        />
                      </label>
                      <label className="field">
                        <span>Location</span>
                        <select
                          value={draftLocation}
                          onChange={(e) => setDraftLocation(e.target.value)}
                          aria-label="Class location"
                        >
                          <option value="">No location</option>
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>{location.label}</option>
                          ))}
                        </select>
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

                    <div className="history-edit-actions">
                      <button className="secondary-btn" onClick={() => setEditingRunId(null)}>Cancel</button>
                      <button className="primary-btn" onClick={() => void saveEdit(run)}>Save Class</button>
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
