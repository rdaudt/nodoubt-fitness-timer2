import { describe, expect, it } from 'vitest';
import type { Timer } from '../types';
import { estimateTimerDurationMs, formatCompactDuration, formatTimerTotal, getTimerSummaryItems } from './time';

const makeTimer = (overrides: Partial<Timer> = {}): Timer => ({
  id: 'timer-1',
  name: 'Demo Timer',
  stationCount: 2,
  roundsPerStation: 3,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 15,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 20,
  startStationWorkManually: false,
  warmupEnabled: true,
  warmupMinutes: 1,
  warmupSeconds: 0,
  cooldownEnabled: true,
  cooldownMinutes: 0,
  cooldownSeconds: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('time helpers', () => {
  it('calculates total time from stations, rounds, transitions, warmup, and cooldown', () => {
    expect(estimateTimerDurationMs(makeTimer())).toBe(350_000);
    expect(formatTimerTotal(makeTimer())).toBe('05:50');
  });

  it('omits rest from summaries when a station has one round', () => {
    expect(getTimerSummaryItems(makeTimer({ roundsPerStation: 1 }), true).map((item) => item.label)).toEqual([
      'Stations',
      'Rounds',
      'Work',
      'Station transition',
    ]);
  });

  it('switches station labels when coach mode is off', () => {
    expect(getTimerSummaryItems(makeTimer(), false)[0]).toMatchObject({
      label: 'Sets',
      value: '2',
    });
  });

  it('formats compact durations for card summaries', () => {
    expect(formatCompactDuration(30)).toBe('30s');
    expect(formatCompactDuration(60)).toBe('1m');
    expect(formatCompactDuration(90)).toBe('1m 30s');
  });
});
