import { useEffect, useMemo, useState, type WheelEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TYPE_LABELS } from '../config';
import { createInterval, insertQuickInterval, resequence } from '../lib/intervalEditor';
import { validateIntervals } from '../lib/timerRules';
import { formatClock } from '../lib/time';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Interval, IntervalType, Timer } from '../types';

type PageMode = 'quick' | 'edit';
type DraftInterval = Interval & { uiId: string };
type DraftTimer = Omit<Timer, 'intervals'> & { intervals: DraftInterval[] };

const isEditPath = (pathname: string): boolean => /\/timer\/[^/]+\/edit$/.test(pathname);

const toDisplayNumber = (value: number): string =>
  Number.isNaN(value) ? '' : String(value);

const lockNumberInput = (e: WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur();
};

const createUiId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ui-${Math.random().toString(36).slice(2, 11)}`;
};

const withUiIds = (intervals: Interval[]): DraftInterval[] =>
  intervals.map((interval) => ({ ...interval, uiId: createUiId() }));

const stripUiIds = (intervals: DraftInterval[]): Interval[] =>
  intervals.map(({ uiId, ...interval }) => interval);

const SortableEditInterval = ({
  interval,
  intervalColor,
  timerSets,
  onChange,
  onRemove,
}: {
  interval: DraftInterval;
  intervalColor: string;
  timerSets: number;
  onChange: (update: Partial<Interval>) => void;
  onRemove: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: interval.uiId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article ref={setNodeRef} style={style} className="detail-edit-row">
      <span className="detail-color-rail" style={{ backgroundColor: intervalColor }} />
      <div className="detail-edit-body">
        <div className="detail-edit-head">
          <button
            className="drag-handle"
            aria-label={`Drag ${interval.name}`}
            type="button"
            {...attributes}
            {...listeners}
          >
            =
          </button>

          <button className="detail-row-summary" type="button" onClick={() => setExpanded((prev) => !prev)}>
            <p className="detail-edit-type" style={{ color: intervalColor }}>{interval.name.toUpperCase()}</p>
            <p className="detail-edit-time">{formatClock(interval.durationMinutes * 60 + interval.durationSeconds)}</p>
          </button>

          {interval.type === 'work' && timerSets > 1 && (
            <p className="detail-work-sets" aria-label={`${timerSets} sets`}>x {timerSets}</p>
          )}

          <button className="detail-trash-btn" aria-label={`Delete ${interval.name}`} onClick={onRemove} type="button">
            ??
          </button>
        </div>

        {expanded && (
          <>
            <label className="field compact">
              Name
              <input value={interval.name} onChange={(e) => onChange({ name: e.target.value })} />
            </label>

            <div className="detail-duration-grid">
              <label className="field compact">
                Min
                <input
                  type="number"
                  min={0}
                  onWheel={lockNumberInput}
                  value={toDisplayNumber(interval.durationMinutes)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      onChange({ durationMinutes: Number.NaN });
                      return;
                    }
                    onChange({ durationMinutes: Math.max(0, Number(raw)) });
                  }}
                />
              </label>
              <label className="field compact">
                Sec
                <input
                  type="number"
                  min={0}
                  max={59}
                  onWheel={lockNumberInput}
                  value={toDisplayNumber(interval.durationSeconds)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      onChange({ durationSeconds: Number.NaN });
                      return;
                    }
                    onChange({ durationSeconds: Math.max(0, Math.min(59, Number(raw))) });
                  }}
                />
              </label>
            </div>
          </>
        )}
      </div>
    </article>
  );
};

export const TimerDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const [timer, setTimer] = useState<Timer | null>(null);
  const [quickIntervals, setQuickIntervals] = useState<Interval[]>([]);
  const [quickSets, setQuickSets] = useState<number>(1);
  const [quickError, setQuickError] = useState<string>('');
  const [mode, setMode] = useState<PageMode>(isEditPath(location.pathname) ? 'edit' : 'quick');
  const [draft, setDraft] = useState<DraftTimer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    TimerRepository.get(id).then((value) => {
      const loaded = value ?? null;
      setTimer(loaded);
      setQuickIntervals(loaded?.intervals ?? []);
      setQuickSets(loaded?.sets ?? 1);
      setDraft(loaded ? { ...loaded, intervals: withUiIds(loaded.intervals) } : null);
    });
  }, [id]);

  useEffect(() => {
    setMode(isEditPath(location.pathname) ? 'edit' : 'quick');
  }, [location.pathname]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalSeconds = useMemo(() => {
    if (!timer) {
      return 0;
    }
    const safeSets = Number.isFinite(quickSets) && quickSets >= 1 ? quickSets : timer.sets;
    const intervalSeconds = timer.intervals.reduce((sum, interval) => (
      sum + interval.durationMinutes * 60 + interval.durationSeconds
    ), 0);
    return intervalSeconds * Math.max(1, safeSets);
  }, [quickSets, timer]);

  const syncTimerState = (next: Timer) => {
    setTimer(next);
    setQuickIntervals(next.intervals);
    setQuickSets(next.sets);
    setDraft({ ...next, intervals: withUiIds(next.intervals) });
  };

  const saveTimer = async (next: Timer) => {
    await TimerRepository.upsert(next);
    syncTimerState(next);
  };

  const buildTimerWithIntervals = (base: Timer, intervals: Interval[]): Timer | null => {
    const checked = validateIntervals(intervals);
    if (!checked.valid) {
      setQuickError(checked.errors[0] ?? 'Invalid interval configuration.');
      return null;
    }

    const now = new Date().toISOString();
    return {
      ...base,
      intervals: checked.normalized,
      updatedAt: now,
    };
  };

  const persistQuickIntervals = async (intervals: Interval[]) => {
    if (!timer) {
      return;
    }
    const next = buildTimerWithIntervals(timer, intervals);
    if (!next) {
      return;
    }
    setQuickError('');
    await saveTimer(next);
  };

  const updateQuickField = (index: number, update: Partial<Interval>) => {
    setQuickIntervals((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...update };
      return resequence(copy);
    });
  };

  const onQuickBlur = async () => {
    await persistQuickIntervals(quickIntervals);
  };

  const onQuickAdd = async (type: IntervalType) => {
    const next = insertQuickInterval(quickIntervals, type);
    setQuickIntervals(next);
    await persistQuickIntervals(next);
  };

  const onQuickSetsBlur = async () => {
    if (!timer) {
      return;
    }
    if (!Number.isFinite(quickSets) || quickSets < 1) {
      setQuickError('Sets must be at least 1.');
      setQuickSets(timer.sets);
      return;
    }

    const now = new Date().toISOString();
    const next: Timer = {
      ...timer,
      sets: Math.max(1, Math.floor(quickSets)),
      updatedAt: now,
    };
    setQuickError('');
    await saveTimer(next);
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

  const openEdit = () => {
    if (!timer) {
      return;
    }
    setMode('edit');
    setQuickError('');
    setDraft({ ...timer, intervals: withUiIds(timer.intervals) });
  };

  const closeEdit = () => {
    if (!timer) {
      return;
    }
    setMode('quick');
    setDraft({ ...timer, intervals: withUiIds(timer.intervals) });
    setShowAddModal(false);
    if (isEditPath(location.pathname)) {
      navigate(`/timer/${timer.id}`, { replace: true });
    }
  };

  const updateDraftField = (index: number, update: Partial<Interval>) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const copy = [...prev.intervals];
      copy[index] = { ...copy[index], ...update };
      return { ...prev, intervals: resequence(copy).map((interval, idx) => ({ ...interval, uiId: copy[idx].uiId })) };
    });
  };

  const removeDraftInterval = (index: number) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const filtered = prev.intervals.filter((_, idx) => idx !== index);
      const fallback = filtered.length > 0 ? filtered : [{ ...createInterval('work'), uiId: createUiId() }];
      const resequenced = resequence(stripUiIds(fallback));
      return {
        ...prev,
        intervals: resequenced.map((interval, idx) => ({ ...interval, uiId: fallback[idx].uiId ?? createUiId() })),
      };
    });
  };

  const addDraftInterval = (type: IntervalType) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const inserted = insertQuickInterval(stripUiIds(prev.intervals), type);
      return { ...prev, intervals: withUiIds(inserted) };
    });
    setShowAddModal(false);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!draft || !over || active.id === over.id) {
      return;
    }

    const oldIndex = draft.intervals.findIndex((interval) => interval.uiId === active.id);
    const newIndex = draft.intervals.findIndex((interval) => interval.uiId === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const moved = arrayMove(prev.intervals, oldIndex, newIndex);
      const resequenced = resequence(stripUiIds(moved));
      return {
        ...prev,
        intervals: resequenced.map((interval, idx) => ({ ...interval, uiId: moved[idx].uiId })),
      };
    });
  };

  const onSaveEdit = async () => {
    if (!draft) {
      return;
    }

    const checked = validateIntervals(stripUiIds(draft.intervals));
    if (!checked.valid || !draft.name.trim() || !Number.isFinite(draft.sets) || draft.sets < 1) {
      setQuickError(checked.errors[0] ?? 'Timer name and interval values must be valid.');
      return;
    }

    const now = new Date().toISOString();
    const next: Timer = {
      ...draft,
      name: draft.name.trim(),
      sets: Math.max(1, Math.floor(draft.sets)),
      intervals: checked.normalized,
      updatedAt: now,
      createdAt: draft.createdAt || now,
    };

    await saveTimer(next);
    setQuickError('');
    setMode('quick');
    if (isEditPath(location.pathname)) {
      navigate(`/timer/${next.id}`, { replace: true });
    }
  };

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  return (
    <section className="timer-detail-page">
      {mode === 'quick' && (
        <>
          <h1 className="screen-title">{timer.name}</h1>
          <div className="detail-toolbar">
            <p className="detail-total-label">TOTAL: {formatClock(totalSeconds)}</p>
            <div className="detail-toolbar-actions">
              <button className="secondary-btn detail-top-btn" onClick={openEdit}>✎ EDIT</button>
              <button className="danger-btn detail-top-icon-btn" aria-label="Delete timer" onClick={onDeleteTimer}>🗑</button>
              <Link to={`/timer/${timer.id}/run`} className="primary-btn detail-top-btn selected">▶ RUN</Link>
            </div>
          </div>

          <div className="detail-quick-sets">
            <label className="field compact detail-quick-sets-row">
              Sets
              <input
                type="number"
                min={1}
                value={toDisplayNumber(quickSets)}
                onWheel={lockNumberInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setQuickSets(Number.NaN);
                    return;
                  }
                  setQuickSets(Math.max(0, Number(raw)));
                }}
                onBlur={onQuickSetsBlur}
                aria-label="Number of sets"
              />
            </label>
          </div>

          <div className="detail-quick-list-head" aria-hidden="true">
            <span>Min</span>
            <span className="detail-quick-list-head-gap">:</span>
            <span>Sec</span>
          </div>

          <div className="detail-quick-list">
            {quickIntervals.map((interval, index) => {
              const intervalColor = settings.intervalColors[interval.type];
              return (
                <article key={`${interval.sequence}-${interval.type}`} className="detail-quick-row">
                  <span className="detail-color-rail" style={{ backgroundColor: intervalColor }} />
                  <div className="detail-quick-body">
                    <input
                      className="detail-name-input"
                      value={interval.name}
                      onChange={(e) => updateQuickField(index, { name: e.target.value })}
                      onBlur={onQuickBlur}
                    />
                    <div className="detail-time-group">
                      <input
                        type="number"
                        min={0}
                        onWheel={lockNumberInput}
                        value={toDisplayNumber(interval.durationMinutes)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            updateQuickField(index, { durationMinutes: Number.NaN });
                            return;
                          }
                          updateQuickField(index, { durationMinutes: Math.max(0, Number(raw)) });
                        }}
                        onBlur={onQuickBlur}
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        onWheel={lockNumberInput}
                        value={toDisplayNumber(interval.durationSeconds)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            updateQuickField(index, { durationSeconds: Number.NaN });
                            return;
                          }
                          updateQuickField(index, { durationSeconds: Math.max(0, Math.min(59, Number(raw))) });
                        }}
                        onBlur={onQuickBlur}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="detail-quick-add-row">
            <button className="secondary-btn" onClick={() => onQuickAdd('warmup')} style={{ color: settings.intervalColors.warmup }}>+ WARMUP</button>
            <button className="secondary-btn" onClick={() => onQuickAdd('work')} style={{ color: settings.intervalColors.work }}>+ WORK</button>
            <button className="secondary-btn" onClick={() => onQuickAdd('rest')} style={{ color: settings.intervalColors.rest }}>+ REST</button>
            <button className="secondary-btn" onClick={() => onQuickAdd('cooldown')} style={{ color: settings.intervalColors.cooldown }}>+ COOLDOWN</button>
          </div>
        </>
      )}

      {mode === 'edit' && draft && (
        <>
          <label className="field">
            Timer Name
            <input value={draft.name} onChange={(e) => setDraft((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
          </label>

          <label className="field">
            Sets
            <input
              type="number"
              min={1}
              value={toDisplayNumber(draft.sets)}
              onWheel={lockNumberInput}
              onChange={(e) =>
                setDraft((prev) => {
                  if (!prev) {
                    return prev;
                  }
                  const raw = e.target.value;
                  if (raw === '') {
                    return { ...prev, sets: Number.NaN };
                  }
                  return { ...prev, sets: Math.max(0, Number(raw)) };
                })
              }
            />
          </label>

          <div className="detail-edit-top">
            <h2 className="detail-edit-title">Intervals</h2>
            <button className="secondary-btn compact" onClick={() => setShowAddModal(true)}>+ Add</button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={draft.intervals.map((interval) => interval.uiId)} strategy={verticalListSortingStrategy}>
              <div className="stack">
                {draft.intervals.map((interval, index) => (
                  <SortableEditInterval
                    key={interval.uiId}
                    interval={interval}
                    intervalColor={settings.intervalColors[interval.type]}
                    timerSets={draft.sets}
                    onChange={(update) => updateDraftField(index, update)}
                    onRemove={() => removeDraftInterval(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="actions-row detail-edit-actions">
            <button className="secondary-btn full" onClick={closeEdit}>Cancel</button>
            <button className="primary-btn full" onClick={onSaveEdit}>Save Timer</button>
          </div>
        </>
      )}

      {showAddModal && (
        <div className="detail-modal-backdrop" role="dialog" aria-modal="true" aria-label="Select interval type">
          <div className="detail-modal">
            <div className="detail-modal-head">
              <h3>Select Interval</h3>
              <button className="secondary-btn compact" onClick={() => setShowAddModal(false)}>Close</button>
            </div>
            <div className="stack">
              {(['warmup', 'work', 'rest', 'cooldown'] as IntervalType[]).map((type) => (
                <button
                  key={type}
                  className="detail-modal-type"
                  onClick={() => addDraftInterval(type)}
                  style={{ borderColor: settings.intervalColors[type] }}
                >
                  <span className="detail-modal-dot" style={{ backgroundColor: settings.intervalColors[type] }} />
                  <span>{TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {quickError && <p className="error-inline">{quickError}</p>}
    </section>
  );
};

