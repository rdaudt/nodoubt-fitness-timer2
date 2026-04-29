import { useEffect, useMemo, useState, type WheelEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estimateTimerDurationMs, formatClock } from '../lib/time';
import { normalizeTimerFields, validateTimer } from '../lib/timerRules';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';
import hiitWorkoutsRaw from '../../docs/hiit-workouts.txt?raw';

const lockNumberInput = (e: WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur();
};

const fromSeconds = (totalSeconds: number): { minutes: number; seconds: number } => ({
  minutes: Math.floor(totalSeconds / 60),
  seconds: totalSeconds % 60,
});

const toSeconds = (minutes: number, seconds: number): number =>
  Math.max(0, Math.floor(minutes || 0) * 60 + Math.floor(seconds || 0));

const toNumber = (value: string, min = 0): number =>
  Number.isNaN(Number(value)) ? min : Math.max(min, Number(value));

const normalizeTimeDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

const parseTimeDigits = (digits: string): number | null => {
  if (!digits) {
    return null;
  }

  if (digits.length <= 2) {
    const seconds = Number(digits);
    if (seconds > 59) {
      return null;
    }
    return seconds;
  }

  const minutes = Number(digits.slice(0, -2));
  const seconds = Number(digits.slice(-2));
  if (minutes > 99 || seconds > 59) {
    return null;
  }
  return minutes * 60 + seconds;
};

const toTimeDigits = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return String(seconds);
  }
  return `${minutes}${String(seconds).padStart(2, '0')}`;
};

const HIIT_WORKOUT_TYPES = hiitWorkoutsRaw
  .split(/\r?\n/)
  .map((item) => item.trim())
  .filter((item) => item.length > 0);

const CountEditor = ({
  label,
  value,
  onDraftChange,
  onPersist,
}: {
  label: string;
  value: number;
  onDraftChange: (next: number) => void;
  onPersist: (next: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const onChange = (nextValue: string) => {
    setDraft(nextValue);

    // Keep the field editable while empty; only push numeric drafts.
    if (nextValue.trim() === '') {
      return;
    }

    const parsed = toNumber(nextValue, 1);
    onDraftChange(parsed);
  };

  const onBlur = () => {
    const parsed = toNumber(draft, 1);
    onDraftChange(parsed);
    onPersist(parsed);
  };

  return (
    <article className="timer-count-card">
      <p>{label}</p>
      <div className="timer-count-controls">
        <input
          type="number"
          min={1}
          onWheel={lockNumberInput}
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </div>
    </article>
  );
};

const TimeMatrixBlock = ({
  label,
  totalSeconds,
  disabled = false,
  onPersist,
}: {
  label: string;
  totalSeconds: number;
  disabled?: boolean;
  onPersist: (seconds: number) => void;
}) => {
  const [draftDigits, setDraftDigits] = useState(toTimeDigits(totalSeconds));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setDraftDigits(toTimeDigits(totalSeconds));
  }, [totalSeconds]);

  const onFocusClock = () => {
    setFocused(true);
    setDraftDigits(toTimeDigits(totalSeconds));
  };

  const onChangeClock = (nextValue: string) => {
    const normalized = normalizeTimeDigits(nextValue);
    if (normalized === '') {
      setDraftDigits('');
      return;
    }
    const parsed = parseTimeDigits(normalized);
    if (parsed === null) {
      return;
    }
    setDraftDigits(normalized);
  };

  const onBlurClock = () => {
    setFocused(false);
    const parsed = parseTimeDigits(draftDigits);
    if (parsed !== null && parsed !== totalSeconds) {
      onPersist(parsed);
      return;
    }
    // Revert invalid/empty entry to the current persisted value.
    setDraftDigits(toTimeDigits(totalSeconds));
  };

  return (
    <article className={`timing-block${disabled ? ' disabled' : ''}`}>
      <p>{label}</p>
      <input
        className="timing-block-time-input"
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={focused ? draftDigits : formatClock(totalSeconds)}
        onFocus={onFocusClock}
        onChange={(e) => onChangeClock(e.target.value)}
        onBlur={onBlurClock}
        aria-label={`${label} time`}
      />
    </article>
  );
};

export const TimerDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [timer, setTimer] = useState<Timer | null>(null);
  const [allTimers, setAllTimers] = useState<Timer[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([TimerRepository.get(id), TimerRepository.list()]).then(([loaded, list]) => {
      setTimer(loaded ?? null);
      setAllTimers(list);
    });
  }, [id]);

  const totalSeconds = useMemo(() => {
    if (!timer) {
      return 0;
    }
    return Math.floor(estimateTimerDurationMs(normalizeTimerFields(timer)) / 1000);
  }, [timer]);

  const persist = async (candidate: Timer) => {
    const result = validateTimer(candidate, allTimers);
    if (!result.valid) {
      setError(result.errors[0] ?? 'Invalid timer.');
      return false;
    }

    const next = {
      ...result.normalized,
      updatedAt: new Date().toISOString(),
    };
    await TimerRepository.upsert(next);
    setTimer(next);
    setAllTimers((prev) => [next, ...prev.filter((item) => item.id !== next.id)]);
    setError('');
    return true;
  };

  const applyPatch = async (patch: Partial<Timer>) => {
    if (!timer) {
      return;
    }
    const candidate = { ...timer, ...patch };
    setTimer(candidate);
    const ok = await persist(candidate);
    if (!ok) {
      const reloaded = await TimerRepository.get(id);
      setTimer(reloaded ?? null);
    }
  };

  const patchTime = async (
    minutesKey:
      | 'workMinutes'
      | 'restMinutes'
      | 'stationTransitionMinutes'
      | 'warmupMinutes'
      | 'cooldownMinutes',
    secondsKey:
      | 'workSeconds'
      | 'restSeconds'
      | 'stationTransitionSeconds'
      | 'warmupSeconds'
      | 'cooldownSeconds',
    nextSeconds: number,
  ) => {
    const parsed = fromSeconds(nextSeconds);
    const patch = {
      [minutesKey]: parsed.minutes,
      [secondsKey]: parsed.seconds,
    } as Partial<Timer>;
    await applyPatch(patch);
  };

  const onDeleteTimer = async () => {
    if (!timer) {
      return;
    }
    const ok = window.confirm('Delete this timer?');
    if (!ok) {
      return;
    }
    await TimerRepository.remove(timer.id);
    navigate('/');
  };

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  const stationLabel = settings.coachMode ? '# Stations' : '# Sets';
  const stationWorkoutTypes = timer.stationWorkoutTypes ?? [];
  const onLoadRandomWorkouts = () => {
    const next = [...stationWorkoutTypes];
    const available = [...HIIT_WORKOUT_TYPES];

    for (let index = 0; index < timer.stationCount; index += 1) {
      if ((next[index] ?? '').trim().length > 0) {
        continue;
      }
      if (available.length === 0) {
        break;
      }
      const pickIndex = Math.floor(Math.random() * available.length);
      const [picked] = available.splice(pickIndex, 1);
      if (picked) {
        next[index] = picked;
      }
    }

    setTimer((prev) => (prev ? { ...prev, stationWorkoutTypes: next } : prev));
    void applyPatch({ stationWorkoutTypes: next });
  };

  return (
    <section className="timer-detail-page compact-editor">
      <input
        className="detail-name-input-top"
        value={timer.name}
        maxLength={25}
        onChange={(e) => setTimer((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
        onBlur={() => timer && applyPatch({ name: timer.name })}
        aria-label="Timer name"
        placeholder="Timer name"
      />

      <div className="detail-toolbar">
        <p className="detail-total-label">TOTAL: {formatClock(totalSeconds)}</p>
        <div />
        <div className="detail-toolbar-actions">
          <button className="danger-btn detail-top-icon-btn" aria-label="Delete timer" onClick={onDeleteTimer}>Delete</button>
          <Link to={`/timer/${timer.id}/run`} className="primary-btn detail-top-btn selected">
            <span className="detail-run-icon" aria-hidden="true">▶</span>
            <span>RUN</span>
          </Link>
        </div>
      </div>

      <div className="timer-count-grid">
        <CountEditor
          label={stationLabel}
          value={timer.stationCount}
          onDraftChange={(stationCount) => setTimer((prev) => (prev ? { ...prev, stationCount } : prev))}
          onPersist={(stationCount) => applyPatch({ stationCount })}
        />
        <CountEditor
          label="# Rounds/Station"
          value={timer.roundsPerStation}
          onDraftChange={(roundsPerStation) => setTimer((prev) => (prev ? { ...prev, roundsPerStation } : prev))}
          onPersist={(roundsPerStation) => applyPatch({ roundsPerStation })}
        />
      </div>

      <label className="field detail-repeat-toggle-row">
        <span>Include Warmup</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={timer.warmupEnabled}
          onChange={(e) => applyPatch({
            warmupEnabled: e.target.checked,
            warmupMinutes: e.target.checked ? (timer.warmupMinutes || 5) : 0,
            warmupSeconds: e.target.checked ? timer.warmupSeconds : 0,
          })}
          aria-label="Include Warmup"
        />
      </label>

      <label className="field detail-repeat-toggle-row">
        <span>Include Cooldown</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={timer.cooldownEnabled}
          onChange={(e) => applyPatch({
            cooldownEnabled: e.target.checked,
            cooldownMinutes: e.target.checked ? (timer.cooldownMinutes || 5) : 0,
            cooldownSeconds: e.target.checked ? timer.cooldownSeconds : 0,
          })}
          aria-label="Include Cooldown"
        />
      </label>

      <section className="timing-matrix">
        <h3>Timing Matrix</h3>
        <div className="timing-matrix-grid">
          <TimeMatrixBlock
            label="Work"
            totalSeconds={toSeconds(timer.workMinutes, timer.workSeconds)}
            onPersist={(seconds) => patchTime('workMinutes', 'workSeconds', seconds)}
          />
          <TimeMatrixBlock
            label="Rest"
            totalSeconds={toSeconds(timer.restMinutes, timer.restSeconds)}
            onPersist={(seconds) => patchTime('restMinutes', 'restSeconds', seconds)}
            disabled={timer.roundsPerStation <= 1}
          />
          <TimeMatrixBlock
            label="Station Transition"
            totalSeconds={toSeconds(timer.stationTransitionMinutes, timer.stationTransitionSeconds)}
            onPersist={(seconds) => patchTime('stationTransitionMinutes', 'stationTransitionSeconds', seconds)}
          />
          <TimeMatrixBlock
            label="Warmup"
            totalSeconds={toSeconds(timer.warmupMinutes, timer.warmupSeconds)}
            onPersist={(seconds) => patchTime('warmupMinutes', 'warmupSeconds', seconds)}
            disabled={!timer.warmupEnabled}
          />
          <TimeMatrixBlock
            label="Cooldown"
            totalSeconds={toSeconds(timer.cooldownMinutes, timer.cooldownSeconds)}
            onPersist={(seconds) => patchTime('cooldownMinutes', 'cooldownSeconds', seconds)}
            disabled={!timer.cooldownEnabled}
          />
        </div>
      </section>

      {settings.coachMode && (
        <label className="field detail-repeat-toggle-row">
          <span>Start Set Manually</span>
          <input
            className="settings-toggle-input"
            type="checkbox"
            checked={timer.startStationWorkManually}
            onChange={(e) => applyPatch({ startStationWorkManually: e.target.checked })}
            aria-label="Start Set Manually"
          />
        </label>
      )}

      {settings.coachMode && (
        <section className="stack">
          <h3>Workout Types (Optional)</h3>
          <button type="button" onClick={onLoadRandomWorkouts}>
            Load random workouts
          </button>
          {Array.from({ length: timer.stationCount }, (_, index) => (
            <label className="field" key={`station-workout-${index + 1}`}>
              <span>Station {index + 1}</span>
              <input
                type="text"
                value={stationWorkoutTypes[index] ?? ''}
                maxLength={40}
                onChange={(e) => {
                  const next = [...stationWorkoutTypes];
                  next[index] = e.target.value;
                  setTimer((prev) => (prev ? { ...prev, stationWorkoutTypes: next } : prev));
                }}
                onBlur={() => {
                  const next = [...(timer.stationWorkoutTypes ?? [])];
                  next[index] = (next[index] ?? '').trim();
                  void applyPatch({ stationWorkoutTypes: next });
                }}
                aria-label={`Station ${index + 1} workout type`}
                placeholder="e.g. pushups"
              />
            </label>
          ))}
        </section>
      )}

      {error && <p className="error-inline">{error}</p>}
    </section>
  );
};
