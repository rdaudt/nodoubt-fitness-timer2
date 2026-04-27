import { useEffect, useMemo, useState, type WheelEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estimateTimerDurationMs, formatClock } from '../lib/time';
import { normalizeTimerFields, validateTimer } from '../lib/timerRules';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

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

const parseClockInput = (value: string): number | null => {
  const trimmed = value.trim();
  const match = /^(\d+):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
};

const CountEditor = ({
  label,
  value,
  onDraftChange,
  onPersist,
}: {
  label: string;
  value: number;
  onDraftChange: (next: number) => void;
  onPersist: () => void;
}) => (
  <article className="timer-count-card">
    <p>{label}</p>
    <div className="timer-count-controls">
      <input
        type="number"
        min={1}
        onWheel={lockNumberInput}
        value={String(value)}
        onChange={(e) => onDraftChange(toNumber(e.target.value, 1))}
        onBlur={onPersist}
      />
    </div>
  </article>
);

const TimeMatrixBlock = ({
  label,
  totalSeconds,
  disabled = false,
  onCommit,
  onPersist,
}: {
  label: string;
  totalSeconds: number;
  disabled?: boolean;
  onCommit: (seconds: number) => void;
  onPersist: () => void;
}) => {
  const [clockValue, setClockValue] = useState(formatClock(totalSeconds));

  useEffect(() => {
    setClockValue(formatClock(totalSeconds));
  }, [totalSeconds]);

  const onBlurClock = () => {
    const parsed = parseClockInput(clockValue);
    if (parsed !== null) {
      onCommit(parsed);
      onPersist();
      return;
    }
    setClockValue(formatClock(totalSeconds));
  };

  return (
    <article className={`timing-block${disabled ? ' disabled' : ''}`}>
      <p>{label}</p>
      <input
        className="timing-block-time-input"
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={clockValue}
        onChange={(e) => setClockValue(e.target.value)}
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
    persistNow = true,
  ) => {
    const parsed = fromSeconds(nextSeconds);
    const patch = {
      [minutesKey]: parsed.minutes,
      [secondsKey]: parsed.seconds,
    } as Partial<Timer>;

    if (persistNow) {
      await applyPatch(patch);
      return;
    }
    setTimer((prev) => (prev ? { ...prev, ...patch } : prev));
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

  const stationLabel = settings.coachMode ? 'Stations' : 'Sets';

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
          onPersist={() => applyPatch({ stationCount: timer.stationCount })}
        />
        <CountEditor
          label="Rounds/Station"
          value={timer.roundsPerStation}
          onDraftChange={(roundsPerStation) => setTimer((prev) => (prev ? { ...prev, roundsPerStation } : prev))}
          onPersist={() => applyPatch({ roundsPerStation: timer.roundsPerStation })}
        />
      </div>

      <section className="timing-matrix">
        <h3>Timing Matrix</h3>
        <div className="timing-matrix-grid">
          <TimeMatrixBlock
            label="Work"
            totalSeconds={toSeconds(timer.workMinutes, timer.workSeconds)}
            onCommit={(seconds) => patchTime('workMinutes', 'workSeconds', seconds, false)}
            onPersist={() => patchTime('workMinutes', 'workSeconds', toSeconds(timer.workMinutes, timer.workSeconds), true)}
          />
          <TimeMatrixBlock
            label="Rest"
            totalSeconds={toSeconds(timer.restMinutes, timer.restSeconds)}
            onCommit={(seconds) => patchTime('restMinutes', 'restSeconds', seconds, false)}
            onPersist={() => patchTime('restMinutes', 'restSeconds', toSeconds(timer.restMinutes, timer.restSeconds), true)}
            disabled={timer.roundsPerStation <= 1}
          />
          <TimeMatrixBlock
            label="Station Transition"
            totalSeconds={toSeconds(timer.stationTransitionMinutes, timer.stationTransitionSeconds)}
            onCommit={(seconds) => patchTime('stationTransitionMinutes', 'stationTransitionSeconds', seconds, false)}
            onPersist={() => patchTime('stationTransitionMinutes', 'stationTransitionSeconds', toSeconds(timer.stationTransitionMinutes, timer.stationTransitionSeconds), true)}
          />
          <TimeMatrixBlock
            label="Warmup"
            totalSeconds={toSeconds(timer.warmupMinutes, timer.warmupSeconds)}
            onCommit={(seconds) => patchTime('warmupMinutes', 'warmupSeconds', seconds, false)}
            onPersist={() => patchTime('warmupMinutes', 'warmupSeconds', toSeconds(timer.warmupMinutes, timer.warmupSeconds), true)}
            disabled={!timer.warmupEnabled}
          />
          <TimeMatrixBlock
            label="Cooldown"
            totalSeconds={toSeconds(timer.cooldownMinutes, timer.cooldownSeconds)}
            onCommit={(seconds) => patchTime('cooldownMinutes', 'cooldownSeconds', seconds, false)}
            onPersist={() => patchTime('cooldownMinutes', 'cooldownSeconds', toSeconds(timer.cooldownMinutes, timer.cooldownSeconds), true)}
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

      {error && <p className="error-inline">{error}</p>}
    </section>
  );
};
