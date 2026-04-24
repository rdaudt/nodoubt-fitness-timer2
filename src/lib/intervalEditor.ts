import { TYPE_LABELS } from '../config';
import type { Interval, IntervalType } from '../types';

export const createInterval = (type: IntervalType): Interval => ({
  sequence: 1,
  name: TYPE_LABELS[type],
  type,
  durationMinutes: 0,
  durationSeconds: type === 'work' ? 30 : 15,
});

export const resequence = (intervals: Interval[]): Interval[] =>
  intervals.map((interval, idx) => ({ ...interval, sequence: idx + 1 }));

export const insertQuickInterval = (intervals: Interval[], type: IntervalType): Interval[] => {
  if (type === 'warmup') {
    const warmup = createInterval('warmup');
    const withoutWarmup = intervals.filter((interval) => interval.type !== 'warmup');
    return resequence([warmup, ...withoutWarmup]);
  }

  if (type === 'cooldown') {
    const cooldown = createInterval('cooldown');
    const withoutCooldown = intervals.filter((interval) => interval.type !== 'cooldown');
    return resequence([...withoutCooldown, cooldown]);
  }

  const next = [...intervals];
  const cooldownIndex = next.findIndex((interval) => interval.type === 'cooldown');

  if (cooldownIndex === -1) {
    next.push(createInterval(type));
    return resequence(next);
  }

  next.splice(cooldownIndex, 0, createInterval(type));
  return resequence(next);
};
