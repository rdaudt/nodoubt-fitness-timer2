import type { Interval, Timer, TimelineEntry } from '../types';

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
