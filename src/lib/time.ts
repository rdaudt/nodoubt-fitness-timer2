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

export const getSetTransitionDurationMs = (timer: Timer): number => {
  const minutes = Math.max(0, Math.floor(timer.setTransitionMinutes ?? 0));
  const seconds = Math.max(0, Math.min(59, Math.floor(timer.setTransitionSeconds ?? 30)));
  return (minutes * 60 + seconds) * 1000;
};

export const estimateTimerDurationMs = (timer: Timer): number => {
  if (timer.repeatSetsUntilStopped) {
    return 0;
  }

  const warmup = timer.intervals.filter((x) => x.type === 'warmup');
  const cooldown = timer.intervals.filter((x) => x.type === 'cooldown');
  const block = timer.intervals.filter((x) => x.type === 'work' || x.type === 'rest');
  const transitionCount = block.length > 0 ? Math.max(0, timer.sets - 1) : 0;
  const transitionDuration = getSetTransitionDurationMs(timer);

  return (
    warmup.reduce((s, x) => s + toDurationMs(x), 0) +
    block.reduce((s, x) => s + toDurationMs(x), 0) * timer.sets +
    transitionCount * transitionDuration +
    cooldown.reduce((s, x) => s + toDurationMs(x), 0)
  );
};

export const formatTimerTotal = (timer: Timer): string =>
  timer.repeatSetsUntilStopped
    ? 'Until stopped'
    : formatClock(Math.floor(estimateTimerDurationMs(timer) / 1000));

const intervalTypeOrder: IntervalType[] = ['warmup', 'work', 'rest', 'cooldown'];

export interface IntervalTypeTotal {
  type: IntervalType;
  durationMs: number;
}

export const getTimerIntervalTypeTotals = (timer: Timer): IntervalTypeTotal[] => {
  const totals = timer.intervals.reduce<Record<IntervalType, number>>((sum, interval) => {
    if (timer.repeatSetsUntilStopped && interval.type === 'cooldown') {
      return sum;
    }

    const multiplier = interval.type === 'work' || interval.type === 'rest'
      ? Math.max(1, timer.repeatSetsUntilStopped ? 1 : timer.sets)
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
