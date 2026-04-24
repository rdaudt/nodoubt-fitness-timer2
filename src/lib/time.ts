import type { Interval, IntervalType, Timer, TimelineEntry } from '../types';

export const toDurationMs = (interval: Interval): number =>
  (interval.durationMinutes * 60 + interval.durationSeconds) * 1000;

export const formatClock = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const secs = (clamped % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export const totalTimelineDurationMs = (timeline: TimelineEntry[]): number =>
  timeline.reduce((sum, item) => sum + item.durationMs, 0);

export const estimateTimerDurationMs = (timer: Timer): number => {
  const warmup = timer.intervals.filter((x) => x.type === 'warmup');
  const cooldown = timer.intervals.filter((x) => x.type === 'cooldown');
  const block = timer.intervals.filter((x) => x.type === 'work' || x.type === 'rest');

  return (
    warmup.reduce((s, x) => s + toDurationMs(x), 0) +
    block.reduce((s, x) => s + toDurationMs(x), 0) * timer.sets +
    cooldown.reduce((s, x) => s + toDurationMs(x), 0)
  );
};

const intervalTypeOrder: IntervalType[] = ['warmup', 'work', 'rest', 'cooldown'];

export interface IntervalTypeTotal {
  type: IntervalType;
  durationMs: number;
}

export const getTimerIntervalTypeTotals = (timer: Timer): IntervalTypeTotal[] => {
  const totals = timer.intervals.reduce<Record<IntervalType, number>>((sum, interval) => {
    const multiplier = interval.type === 'work' || interval.type === 'rest'
      ? Math.max(1, timer.sets)
      : 1;
    sum[interval.type] += toDurationMs(interval) * multiplier;
    return sum;
  }, {
    warmup: 0,
    work: 0,
    rest: 0,
    cooldown: 0,
  });

  return intervalTypeOrder
    .map((type) => ({ type, durationMs: totals[type] }))
    .filter((item) => item.durationMs > 0);
};

export const formatCompactDuration = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;

  if (mins > 0 && secs > 0) {
    return `${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m`;
  }
  return `${secs}s`;
};
