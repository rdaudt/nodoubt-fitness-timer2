import { useEffect, useMemo, useRef, useState, type PointerEventHandler, type WheelEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { insertQuickInterval } from '../lib/intervalEditor';
import { validateIntervals } from '../lib/timerRules';
import { formatClock } from '../lib/time';
import { useSettings } from '../services/settingsContext';
import { TimerRepository } from '../services/storage';
import type { Interval, IntervalType, Timer } from '../types';

const ACTION_WIDTH = 96;
const OPEN_THRESHOLD = 44;

type QuickInterval = Interval & { uiId: string };

const toDisplayNumber = (value: number): string =>
  Number.isNaN(value) ? '' : String(value);

const lockNumberInput = (e: WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur();
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const createUiId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ui-${Math.random().toString(36).slice(2, 11)}`;
};

const stripUiIds = (intervals: QuickInterval[]): Interval[] =>
  intervals.map(({ uiId, ...interval }) => interval);

const withStableUiIds = (intervals: Interval[], source: QuickInterval[]): QuickInterval[] =>
  intervals.map((interval, idx) => ({ ...interval, uiId: source[idx]?.uiId ?? createUiId() }));

const resequenceQuick = (intervals: QuickInterval[]): QuickInterval[] =>
  intervals.map((interval, idx) => ({ ...interval, sequence: idx + 1 }));

const SortableQuickInterval = ({
  interval,
  intervalColor,
  onChange,
  onBlur,
  onDelete,
}: {
  interval: QuickInterval;
  intervalColor: string;
  onChange: (update: Partial<Interval>) => void;
  onBlur: () => void;
  onDelete: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: interval.uiId });

  const [translateX, setTranslateX] = useState(0);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const movedRef = useRef(false);

  const close = () => {
    setTranslateX(0);
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, select, textarea')) {
      return;
    }

    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startOffsetRef.current = translateX;
    movedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (pointerIdRef.current !== e.pointerId) {
      return;
    }
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 4) {
      movedRef.current = true;
    }
    const next = clamp(startOffsetRef.current + delta, -ACTION_WIDTH, 0);
    setTranslateX(next);
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    if (pointerIdRef.current !== e.pointerId) {
      return;
    }
    pointerIdRef.current = null;

    if (!movedRef.current) {
      return;
    }

    if (translateX <= -OPEN_THRESHOLD) {
      setTranslateX(-ACTION_WIDTH);
      return;
    }
    close();
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="detail-quick-swipe-row">
      <div className="detail-quick-swipe-action">
        <button
          className="detail-quick-swipe-delete"
          type="button"
          onClick={() => {
            const ok = window.confirm('Delete this interval?');
            if (!ok) {
              close();
              return;
            }
            close();
            onDelete();
          }}
        >
          Delete
        </button>
      </div>

      <article
        className="detail-quick-row detail-quick-swipe-surface"
        style={{ transform: `translateX(${translateX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={close}
      >
        <span className="detail-color-rail" style={{ backgroundColor: intervalColor }} />
        <button
          className="drag-handle detail-quick-drag-handle"
          aria-label={`Drag ${interval.name}`}
          type="button"
          {...attributes}
          {...listeners}
        >
          =
        </button>

        <div className="detail-quick-body">
          <input
            className="detail-name-input"
            value={interval.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onBlur={onBlur}
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
                  onChange({ durationMinutes: Number.NaN });
                  return;
                }
                onChange({ durationMinutes: Math.max(0, Number(raw)) });
              }}
              onBlur={onBlur}
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
                  onChange({ durationSeconds: Number.NaN });
                  return;
                }
                onChange({ durationSeconds: Math.max(0, Math.min(59, Number(raw))) });
              }}
              onBlur={onBlur}
            />
          </div>
        </div>
      </article>
    </div>
  );
};

export const TimerDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [timer, setTimer] = useState<Timer | null>(null);
  const [quickName, setQuickName] = useState('');
  const [quickIntervals, setQuickIntervals] = useState<QuickInterval[]>([]);
  const [quickSets, setQuickSets] = useState<number>(1);
  const [quickError, setQuickError] = useState<string>('');

  useEffect(() => {
    TimerRepository.get(id).then((value) => {
      const loaded = value ?? null;
      setTimer(loaded);
      setQuickName(loaded?.name ?? '');
      setQuickSets(loaded?.sets ?? 1);
      setQuickIntervals((loaded?.intervals ?? []).map((interval) => ({ ...interval, uiId: createUiId() })));
    });
  }, [id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalSeconds = useMemo(() => {
    const safeSets = Number.isFinite(quickSets) && quickSets >= 1 ? quickSets : (timer?.sets ?? 1);
    const intervalSeconds = stripUiIds(quickIntervals).reduce((sum, interval) => (
      sum + interval.durationMinutes * 60 + interval.durationSeconds
    ), 0);
    return intervalSeconds * Math.max(1, safeSets);
  }, [quickIntervals, quickSets, timer?.sets]);

  const syncTimerState = (next: Timer, sourceIntervals: QuickInterval[]) => {
    setTimer(next);
    setQuickName(next.name);
    setQuickSets(next.sets);
    setQuickIntervals(withStableUiIds(next.intervals, sourceIntervals));
  };

  const persistQuickState = async (name: string, sets: number, intervals: QuickInterval[]): Promise<boolean> => {
    if (!timer) {
      return false;
    }

    if (!name.trim()) {
      setQuickError('Timer name is required.');
      return false;
    }

    if (!Number.isFinite(sets) || sets < 1) {
      setQuickError('Sets must be at least 1.');
      return false;
    }

    const checked = validateIntervals(stripUiIds(intervals));
    if (!checked.valid) {
      setQuickError(checked.errors[0] ?? 'Invalid interval configuration.');
      return false;
    }

    const now = new Date().toISOString();
    const next: Timer = {
      ...timer,
      name: name.trim(),
      sets: Math.max(1, Math.floor(sets)),
      intervals: checked.normalized,
      updatedAt: now,
    };

    await TimerRepository.upsert(next);
    setQuickError('');
    syncTimerState(next, intervals);
    return true;
  };

  const onQuickNameBlur = async () => {
    const ok = await persistQuickState(quickName, quickSets, quickIntervals);
    if (!ok && timer) {
      setQuickName(timer.name);
    }
  };

  const onQuickSetsBlur = async () => {
    const ok = await persistQuickState(quickName, quickSets, quickIntervals);
    if (!ok && timer) {
      setQuickSets(timer.sets);
    }
  };

  const updateQuickInterval = (index: number, update: Partial<Interval>) => {
    setQuickIntervals((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...update };
      return resequenceQuick(copy);
    });
  };

  const onQuickIntervalsBlur = async () => {
    const ok = await persistQuickState(quickName, quickSets, quickIntervals);
    if (!ok && timer) {
      setQuickIntervals((timer.intervals ?? []).map((interval) => ({ ...interval, uiId: createUiId() })));
    }
  };

  const onQuickAdd = async (type: IntervalType) => {
    const inserted = insertQuickInterval(stripUiIds(quickIntervals), type);
    const nextIntervals = withStableUiIds(inserted, quickIntervals);
    const previous = quickIntervals;

    setQuickIntervals(nextIntervals);
    const ok = await persistQuickState(quickName, quickSets, nextIntervals);
    if (!ok) {
      setQuickIntervals(previous);
    }
  };

  const onQuickDeleteInterval = async (index: number) => {
    const filtered = quickIntervals.filter((_, idx) => idx !== index);
    const nextIntervals = resequenceQuick(filtered);
    const previous = quickIntervals;

    setQuickIntervals(nextIntervals);
    const ok = await persistQuickState(quickName, quickSets, nextIntervals);
    if (!ok) {
      setQuickIntervals(previous);
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

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = quickIntervals.findIndex((interval) => interval.uiId === active.id);
    const newIndex = quickIntervals.findIndex((interval) => interval.uiId === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const moved = arrayMove(quickIntervals, oldIndex, newIndex);
    const nextIntervals = resequenceQuick(moved);
    const previous = quickIntervals;

    setQuickIntervals(nextIntervals);
    const ok = await persistQuickState(quickName, quickSets, nextIntervals);
    if (!ok) {
      setQuickIntervals(previous);
    }
  };

  if (!timer) {
    return <p className="empty">Timer not found.</p>;
  }

  return (
    <section className="timer-detail-page">
      <label className="field compact detail-name-field">
        Timer Name
        <input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          onBlur={onQuickNameBlur}
          aria-label="Timer name"
        />
      </label>

      <div className="detail-toolbar">
        <p className="detail-total-label">TOTAL: {formatClock(totalSeconds)}</p>
        <div className="detail-toolbar-actions">
          <button className="danger-btn detail-top-icon-btn" aria-label="Delete timer" onClick={onDeleteTimer}>Delete</button>
          <Link to={`/timer/${timer.id}/run`} className="primary-btn detail-top-btn selected">RUN</Link>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={quickIntervals.map((interval) => interval.uiId)} strategy={verticalListSortingStrategy}>
          <div className="detail-quick-list">
            {quickIntervals.map((interval, index) => (
              <SortableQuickInterval
                key={interval.uiId}
                interval={interval}
                intervalColor={settings.intervalColors[interval.type]}
                onChange={(update) => updateQuickInterval(index, update)}
                onBlur={onQuickIntervalsBlur}
                onDelete={() => onQuickDeleteInterval(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {quickError && <p className="error-inline">{quickError}</p>}

      <div className="detail-quick-add-floating">
        <div className="detail-quick-add-row">
          <button className="secondary-btn" onClick={() => onQuickAdd('warmup')} style={{ color: settings.intervalColors.warmup }}>+ WARMUP</button>
          <button className="secondary-btn" onClick={() => onQuickAdd('work')} style={{ color: settings.intervalColors.work }}>+ WORK</button>
          <button className="secondary-btn" onClick={() => onQuickAdd('rest')} style={{ color: settings.intervalColors.rest }}>+ REST</button>
          <button className="secondary-btn" onClick={() => onQuickAdd('cooldown')} style={{ color: settings.intervalColors.cooldown }}>+ COOLDOWN</button>
        </div>
      </div>
    </section>
  );
};
