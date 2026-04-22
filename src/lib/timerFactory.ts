import type { Interval, Timer } from '../types';

export const blankWork = (): Interval => ({
  sequence: 1,
  name: 'Work',
  type: 'work',
  durationMinutes: 0,
  durationSeconds: 30,
});

export const newTimer = (): Timer => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: 'New Timer',
    sets: 1,
    intervals: [blankWork()],
    createdAt: now,
    updatedAt: now,
  };
};
