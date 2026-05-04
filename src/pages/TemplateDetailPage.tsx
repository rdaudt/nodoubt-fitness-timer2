import { useEffect, useMemo, useState, type WheelEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { estimateTimerDurationMs, formatClock } from '../lib/time';
import { normalizeTimerFields, validateTimer } from '../lib/timerRules';
import { trackAnalyticsEvent } from '../services/analytics';
import { createTimerFromTemplate, deleteTemplate, getTemplateById, listTemplates, saveTemplate } from '../services/templateService';
import { TimerRepository } from '../services/storage';
import type { Template, Timer } from '../types';
import hiitWorkoutsRaw from '../data/hiit-workouts.txt?raw';

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
const SHOW_LOAD_RANDOM_WORKOUTS_BUTTON = false;

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
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <article className="timer-count-card">
      <p>{label}</p>
      <div className="timer-count-controls">
        <input
          type="number"
          min={1}
          onWheel={lockNumberInput}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim() === '') {
              return;
            }
            onDraftChange(toNumber(e.target.value, 1));
          }}
          onBlur={() => {
            const parsed = toNumber(draft, 1);
            onDraftChange(parsed);
            onPersist(parsed);
          }}
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

  useEffect(() => setDraftDigits(toTimeDigits(totalSeconds)), [totalSeconds]);

  return (
    <article className={`timing-block${disabled ? ' disabled' : ''}`}>
      <p>{label}</p>
      <input
        className="timing-block-time-input"
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={focused ? draftDigits : formatClock(totalSeconds)}
        onFocus={() => {
          setFocused(true);
          setDraftDigits(toTimeDigits(totalSeconds));
        }}
        onChange={(e) => {
          const normalized = normalizeTimeDigits(e.target.value);
          if (normalized === '') {
            setDraftDigits('');
            return;
          }
          const parsed = parseTimeDigits(normalized);
          if (parsed !== null) {
            setDraftDigits(normalized);
          }
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseTimeDigits(draftDigits);
          if (parsed !== null && parsed !== totalSeconds) {
            onPersist(parsed);
            return;
          }
          setDraftDigits(toTimeDigits(totalSeconds));
        }}
        aria-label={`${label} time`}
      />
    </article>
  );
};

export const TemplateDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Template | null>(null);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getTemplateById(id), listTemplates()]).then(([loaded, list]) => {
      setTemplate(loaded ?? null);
      setAllTemplates(list);
    });
  }, [id]);

  const totalSeconds = useMemo(() => {
    if (!template) {
      return 0;
    }
    return Math.floor(estimateTimerDurationMs(normalizeTimerFields(template)) / 1000);
  }, [template]);

  const persist = async (candidate: Template) => {
    const validation = validateTimer(candidate as Timer, allTemplates as unknown as Timer[]);
    if (!validation.valid) {
      setError(validation.errors[0] ?? 'Invalid template.');
      return false;
    }
    const next = await saveTemplate({
      ...candidate,
      ...validation.normalized,
    });
    setTemplate(next);
    const latest = await listTemplates();
    setAllTemplates(latest);
    setError('');
    return true;
  };

  const applyPatch = async (patch: Partial<Template>) => {
    if (!template) {
      return;
    }
    const candidate = { ...template, ...patch };
    setTemplate(candidate);
    const ok = await persist(candidate);
    if (!ok) {
      const reloaded = await getTemplateById(id);
      setTemplate(reloaded ?? null);
    }
  };

  const patchTime = async (
    minutesKey: 'workMinutes' | 'restMinutes' | 'stationTransitionMinutes' | 'warmupMinutes' | 'cooldownMinutes',
    secondsKey: 'workSeconds' | 'restSeconds' | 'stationTransitionSeconds' | 'warmupSeconds' | 'cooldownSeconds',
    nextSeconds: number,
  ) => {
    const parsed = fromSeconds(nextSeconds);
    await applyPatch({ [minutesKey]: parsed.minutes, [secondsKey]: parsed.seconds } as Partial<Template>);
  };

  if (!template) {
    return <p className="empty">Template not found.</p>;
  }

  const onDelete = async () => {
    const ok = window.confirm('Delete this template?');
    if (!ok) {
      return;
    }
    await deleteTemplate(template);
    navigate('/templates');
  };

  const onUseTemplate = async () => {
    const timer = await createTimerFromTemplate(template);
    await TimerRepository.upsert(timer);
    trackAnalyticsEvent('timer_created_from_template', {
      category: timer.category,
    });
    window.dispatchEvent(new Event('timers:changed'));
    navigate(`/timer/${timer.id}`);
  };

  const stationWorkoutTypes = template.stationWorkoutTypes ?? [];

  return (
    <section className="timer-detail-page compact-editor">
      <input
        className="detail-name-input-top"
        value={template.name}
        maxLength={25}
        onChange={(e) => setTemplate((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
        onBlur={() => template && applyPatch({ name: template.name })}
        aria-label="Template name"
        placeholder="Template name"
      />

      <div className="detail-toolbar">
        <p className="detail-total-label">TOTAL: {formatClock(totalSeconds)}</p>
        <div />
        <div className="detail-toolbar-actions">
          <button className="danger-btn detail-top-icon-btn" aria-label="Delete template" onClick={onDelete}>Delete</button>
          <button className="primary-btn detail-top-btn selected" type="button" onClick={onUseTemplate}>
            <span>USE</span>
          </button>
        </div>
      </div>

      <div className="timer-count-grid">
        <CountEditor
          label="# Stations"
          value={template.stationCount}
          onDraftChange={(stationCount) => setTemplate((prev) => (prev ? { ...prev, stationCount } : prev))}
          onPersist={(stationCount) => applyPatch({ stationCount })}
        />
        <CountEditor
          label="# Rounds/Station"
          value={template.roundsPerStation}
          onDraftChange={(roundsPerStation) => setTemplate((prev) => (prev ? { ...prev, roundsPerStation } : prev))}
          onPersist={(roundsPerStation) => applyPatch({ roundsPerStation })}
        />
      </div>

      <section className="timing-matrix">
        <h3>Timing Matrix</h3>
        <div className="timing-matrix-grid">
          <TimeMatrixBlock label="Work" totalSeconds={toSeconds(template.workMinutes, template.workSeconds)} onPersist={(seconds) => patchTime('workMinutes', 'workSeconds', seconds)} />
          <TimeMatrixBlock label="Rest" totalSeconds={toSeconds(template.restMinutes, template.restSeconds)} onPersist={(seconds) => patchTime('restMinutes', 'restSeconds', seconds)} disabled={template.roundsPerStation <= 1} />
          <TimeMatrixBlock label="Station Transition" totalSeconds={toSeconds(template.stationTransitionMinutes, template.stationTransitionSeconds)} onPersist={(seconds) => patchTime('stationTransitionMinutes', 'stationTransitionSeconds', seconds)} />
          <TimeMatrixBlock label="Warmup" totalSeconds={toSeconds(template.warmupMinutes, template.warmupSeconds)} onPersist={(seconds) => patchTime('warmupMinutes', 'warmupSeconds', seconds)} disabled={!template.warmupEnabled} />
          <TimeMatrixBlock label="Cooldown" totalSeconds={toSeconds(template.cooldownMinutes, template.cooldownSeconds)} onPersist={(seconds) => patchTime('cooldownMinutes', 'cooldownSeconds', seconds)} disabled={!template.cooldownEnabled} />
        </div>
      </section>

      <section className="stack">
        <h3>Workout Types (Optional)</h3>
        {SHOW_LOAD_RANDOM_WORKOUTS_BUTTON && (
          <button
            type="button"
            onClick={() => {
              const next = [...stationWorkoutTypes];
              const available = [...HIIT_WORKOUT_TYPES];
              for (let index = 0; index < template.stationCount; index += 1) {
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
              setTemplate((prev) => (prev ? { ...prev, stationWorkoutTypes: next } : prev));
              void applyPatch({ stationWorkoutTypes: next });
            }}
          >
            Load random workouts
          </button>
        )}
        {Array.from({ length: template.stationCount }, (_, index) => (
          <label className="field" key={`template-station-workout-${index + 1}`}>
            <span>Station {index + 1}</span>
            <input
              type="text"
              value={stationWorkoutTypes[index] ?? ''}
              maxLength={40}
              onChange={(e) => {
                const next = [...stationWorkoutTypes];
                next[index] = e.target.value;
                setTemplate((prev) => (prev ? { ...prev, stationWorkoutTypes: next } : prev));
              }}
              onBlur={() => {
                const next = [...(template.stationWorkoutTypes ?? [])];
                next[index] = (next[index] ?? '').trim();
                void applyPatch({ stationWorkoutTypes: next });
              }}
              aria-label={`Station ${index + 1} workout type`}
              placeholder="e.g. pushups"
            />
          </label>
        ))}
      </section>
      {error && <p className="error-inline">{error}</p>}
    </section>
  );
};
