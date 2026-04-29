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
  status: 'idle' | 'generating' | 'success' | 'error';
  error: string | null;
  previewUrl: string | null;
};

const IG_OUTPUT_WIDTH = 1080;
const IG_OUTPUT_HEIGHT = 1350;

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

const resizeImageBlob = async (source: Blob, width: number, height: number): Promise<Blob> => {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return source;
  }
  try {
    const sourceUrl = URL.createObjectURL(source);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      const timerId = window.setTimeout(() => {
        reject(new Error('Timed out while loading generated image for resizing.'));
      }, 1500);
      const settle = (fn: () => void) => () => {
        window.clearTimeout(timerId);
        fn();
      };
      nextImage.onload = settle(() => resolve(nextImage));
      nextImage.onerror = settle(() => reject(new Error('Unable to load generated image for resizing.')));
      nextImage.src = sourceUrl;
    });
    URL.revokeObjectURL(sourceUrl);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.toBlob !== 'function') {
      return source;
    }
    context.drawImage(image, 0, 0, width, height);
    const resizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
    return resizedBlob ?? source;
  } catch {
    return source;
  }
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

  const setGenerationState = (runId: string, next: GenerationState) => {
    setGenerationByRunId((prev) => {
      const priorPreviewUrl = prev[runId]?.previewUrl;
      if (priorPreviewUrl && priorPreviewUrl !== next.previewUrl) {
        URL.revokeObjectURL(priorPreviewUrl);
      }
      return {
        ...prev,
        [runId]: next,
      };
    });
  };

  const generateIgImage = async (run: TimerRun) => {
    if (!settings.coachMode) {
      return;
    }
    if (!run.complete || !hasCompleteWorkoutTypes(run)) {
      setGenerationState(run.id, {
        status: 'error',
        error: 'Run must be complete and all station workout types must be filled.',
        previewUrl: null,
      });
      return;
    }
    const password = window.prompt('Enter coach password to generate IG image');
    if (password !== 'kobetheabby') {
      setGenerationState(run.id, {
        status: 'error',
        error: 'Invalid password.',
        previewUrl: null,
      });
      return;
    }

    setGenerationState(run.id, { status: 'generating', error: null, previewUrl: null });
    try {
      const exportPayload = toRunExportPayload(run);
      const response = await fetch('/api/generate-ig-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ run: exportPayload }),
      });
      const rawText = await response.text();
      let body: { imageBase64?: string; error?: string } = {};
      if (rawText.trim().length > 0) {
        try {
          body = JSON.parse(rawText) as { imageBase64?: string; error?: string };
        } catch {
          body = {};
        }
      }
      if (!response.ok || !body.imageBase64) {
        const fallback = rawText.trim().length > 0
          ? rawText
          : `HTTP ${response.status} ${response.statusText}`.trim();
        throw new Error(body.error ?? fallback ?? 'Image generation failed.');
      }
      const mimeType = 'image/png';
      const imageBytes = atob(body.imageBase64);
      const byteArray = Uint8Array.from(imageBytes, (char) => char.charCodeAt(0));
      const sourceBlob = new Blob([byteArray], { type: mimeType });
      const blob = await resizeImageBlob(sourceBlob, IG_OUTPUT_WIDTH, IG_OUTPUT_HEIGHT);
      const previewUrl = URL.createObjectURL(blob);
      const fileName = buildImageFileName(run);
      setGenerationState(run.id, { status: 'success', error: null, previewUrl });
      downloadGeneratedImage(previewUrl, fileName);
    } catch (error) {
      setGenerationState(run.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Image generation failed.',
        previewUrl: null,
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
              previewUrl: null,
            };
            const canGenerate = settings.coachMode && run.complete && hasCompleteWorkoutTypes(run);
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
                      <span>Timer name</span>
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
                      {settings.coachMode && (
                        <button
                          className="primary-btn"
                          onClick={() => void generateIgImage(run)}
                          disabled={!canGenerate || generation.status === 'generating'}
                        >
                          {generation.status === 'generating' ? 'Generating...' : 'Generate IG Image'}
                        </button>
                      )}
                      <button className="secondary-btn" onClick={() => startEdit(run)}>Edit</button>
                      <button className="danger-btn" onClick={() => void deleteRun(run.id)}>Delete</button>
                    </div>
                    {settings.coachMode && !canGenerate && (
                      <p>IG generation requires a complete run and workout type set for every station.</p>
                    )}
                    {generation.error && <p role="alert">IG generation error: {generation.error}</p>}
                    {generation.previewUrl && (
                      <img
                        src={generation.previewUrl}
                        alt={`Generated IG preview for ${run.timerNameAtRun}`}
                        className="about-kobe-ai-image"
                      />
                    )}
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
