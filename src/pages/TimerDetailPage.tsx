import { useEffect, useMemo, useState, type WheelEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estimateTimerDurationMs, formatClock } from '../lib/time';
import { normalizeTimerFields, validateTimer } from '../lib/timerRules';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

const toDisplayNumber = (value: number): string =>
  Number.isNaN(value) ? '' : String(value);

const lockNumberInput = (e: WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur();
};

const numberFromInput = (value: string): number =>
  value === '' ? Number.NaN : Math.max(0, Number(value));

const countFromInput = (value: string): number =>
  value === '' ? Number.NaN : Math.max(1, Number(value));

const DurationFields = ({
  label,
  minutes,
  seconds,
  disabled = false,
  onMinutes,
  onSeconds,
  onBlur,
}: {
  label: string;
  minutes: number;
  seconds: number;
  disabled?: boolean;
  onMinutes: (value: number) => void;
  onSeconds: (value: number) => void;
  onBlur: () => void;
}) => (
  <div className="set-transition-inline timer-attribute-duration">
    <span className="set-transition-inline-label">{label}</span>
    <label className="set-transition-inline-field">
      <span>Min</span>
      <input
        type="number"
        min={0}
        disabled={disabled}
        onWheel={lockNumberInput}
        value={toDisplayNumber(minutes)}
        aria-label={`${label} minutes`}
        onChange={(e) => onMinutes(numberFromInput(e.target.value))}
        onBlur={onBlur}
      />
    </label>
    <label className="set-transition-inline-field">
      <span>Sec</span>
      <input
        type="number"
        min={0}
        max={59}
        disabled={disabled}
        onWheel={lockNumberInput}
        value={toDisplayNumber(seconds)}
        aria-label={`${label} seconds`}
        onChange={(e) => onSeconds(numberFromInput(e.target.value))}
        onBlur={onBlur}
      />
    </label>
  </div>
);

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

  const updateDraft = (update: Partial<Timer>) => {
    setTimer((prev) => (prev ? { ...prev, ...update } : prev));
  };

  const persist = async (candidate = timer) => {
    if (!candidate) {
      return false;
    }
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

  const persistPatch = async (update: Partial<Timer>) => {
    if (!timer) {
      return;
    }
    const candidate = { ...timer, ...update };
    setTimer(candidate);
    await persist(candidate);
  };

  const onBlur = async () => {
    const ok = await persist();
    if (!ok) {
      const reloaded = await TimerRepository.get(id);
      setTimer(reloaded ?? null);
    }
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

  const stationLabel = settings.coachMode ? 'Number of Stations' : 'Number of Sets';
  const transitionLabel = settings.coachMode ? 'Station Transition Time' : 'Set Transition Time';

  return (
    <section className="timer-detail-page">
      <input
        className="detail-name-input-top"
        value={timer.name}
        maxLength={25}
        onChange={(e) => updateDraft({ name: e.target.value })}
        onBlur={onBlur}
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

      <label className="field">
        {stationLabel}
        <input
          type="number"
          min={1}
          value={toDisplayNumber(timer.stationCount)}
          onWheel={lockNumberInput}
          onChange={(e) => updateDraft({ stationCount: countFromInput(e.target.value) })}
          onBlur={onBlur}
        />
      </label>

      <label className="field">
        Number of Rounds per Station
        <input
          type="number"
          min={1}
          value={toDisplayNumber(timer.roundsPerStation)}
          onWheel={lockNumberInput}
          onChange={(e) => {
            const roundsPerStation = countFromInput(e.target.value);
            updateDraft({ roundsPerStation });
          }}
          onBlur={onBlur}
        />
      </label>

      <DurationFields
        label="Work Time"
        minutes={timer.workMinutes}
        seconds={timer.workSeconds}
        onMinutes={(workMinutes) => updateDraft({ workMinutes })}
        onSeconds={(workSeconds) => updateDraft({ workSeconds })}
        onBlur={onBlur}
      />

      <DurationFields
        label="Rest Time"
        minutes={timer.restMinutes}
        seconds={timer.restSeconds}
        disabled={timer.roundsPerStation <= 1}
        onMinutes={(restMinutes) => updateDraft({ restMinutes })}
        onSeconds={(restSeconds) => updateDraft({ restSeconds })}
        onBlur={onBlur}
      />

      <DurationFields
        label={transitionLabel}
        minutes={timer.stationTransitionMinutes}
        seconds={timer.stationTransitionSeconds}
        onMinutes={(stationTransitionMinutes) => updateDraft({ stationTransitionMinutes })}
        onSeconds={(stationTransitionSeconds) => updateDraft({ stationTransitionSeconds })}
        onBlur={onBlur}
      />

      {settings.coachMode && (
        <label className="field detail-repeat-toggle-row">
          <span>Start Station Work Manually</span>
          <input
            className="settings-toggle-input"
            type="checkbox"
            checked={timer.startStationWorkManually}
            onChange={(e) => persistPatch({ startStationWorkManually: e.target.checked })}
            aria-label="Start Station Work Manually"
          />
        </label>
      )}

      <label className="field detail-repeat-toggle-row">
        <span>Warmup</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={timer.warmupEnabled}
          onChange={(e) => persistPatch({
            warmupEnabled: e.target.checked,
            warmupMinutes: e.target.checked ? timer.warmupMinutes || 5 : 0,
            warmupSeconds: e.target.checked ? timer.warmupSeconds : 0,
          })}
          aria-label="Warmup"
        />
      </label>

      <DurationFields
        label="Warmup Time"
        minutes={timer.warmupMinutes}
        seconds={timer.warmupSeconds}
        disabled={!timer.warmupEnabled}
        onMinutes={(warmupMinutes) => updateDraft({ warmupMinutes })}
        onSeconds={(warmupSeconds) => updateDraft({ warmupSeconds })}
        onBlur={onBlur}
      />

      <label className="field detail-repeat-toggle-row">
        <span>Cooldown</span>
        <input
          className="settings-toggle-input"
          type="checkbox"
          checked={timer.cooldownEnabled}
          onChange={(e) => persistPatch({
            cooldownEnabled: e.target.checked,
            cooldownMinutes: e.target.checked ? timer.cooldownMinutes || 5 : 0,
            cooldownSeconds: e.target.checked ? timer.cooldownSeconds : 0,
          })}
          aria-label="Cooldown"
        />
      </label>

      <DurationFields
        label="Cooldown Time"
        minutes={timer.cooldownMinutes}
        seconds={timer.cooldownSeconds}
        disabled={!timer.cooldownEnabled}
        onMinutes={(cooldownMinutes) => updateDraft({ cooldownMinutes })}
        onSeconds={(cooldownSeconds) => updateDraft({ cooldownSeconds })}
        onBlur={onBlur}
      />

      {error && <p className="error-inline">{error}</p>}
    </section>
  );
};
