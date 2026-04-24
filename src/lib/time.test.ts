import { describe, expect, it } from 'vitest';
import type { Timer } from '../types';
import { formatCompactDuration, getTimerIntervalTypeTotals } from './time';

const makeTimer = (overrides: Partial<Timer> = {}): Timer => ({
  id: 'timer-1',
  name: 'Demo Timer',
  sets: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  intervals: [
    { sequence: 1, name: 'Warmup', type: 'warmup', durationMinutes: 1, durationSeconds: 0 },
    { sequence: 2, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
    { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 15 },
    { sequence: 4, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 30 },
  ],
  ...overrides,
});

describe('time helpers', () => {
  it('summarizes interval type totals using actual run semantics', () => {
    expect(getTimerIntervalTypeTotals(makeTimer())).toEqual([
      { type: 'warmup', durationMs: 60_000 },
      { type: 'work', durationMs: 90_000 },
      { type: 'rest', durationMs: 45_000 },
      { type: 'cooldown', durationMs: 30_000 },
    ]);
  });

  it('combines duplicate types and omits missing or zero-duration types', () => {
    const timer = makeTimer({
      sets: 2,
      intervals: [
        { sequence: 1, name: 'Work 1', type: 'work', durationMinutes: 0, durationSeconds: 20 },
        { sequence: 2, name: 'Work 2', type: 'work', durationMinutes: 0, durationSeconds: 10 },
        { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 0 },
      ],
    });

    expect(getTimerIntervalTypeTotals(timer)).toEqual([
      { type: 'work', durationMs: 60_000 },
    ]);
  });

  it('formats compact durations for card summaries', () => {
    expect(formatCompactDuration(30)).toBe('30s');
    expect(formatCompactDuration(60)).toBe('1m');
    expect(formatCompactDuration(90)).toBe('1m 30s');
  });
});
