import { describe, expect, it, vi } from 'vitest';
import { normalizeStorageUserScope, normalizeTimer, normalizeTimerRun, setStorageUserScope, TimerRepository } from './storage';
import type { Timer, TimerRun } from '../types';

vi.mock('idb', () => ({
  openDB: vi.fn(),
  deleteDB: vi.fn(),
}));

import { openDB } from 'idb';

const timer: Timer = {
  id: 'timer-1',
  name: 'Demo',
  stationCount: 10,
  stationWorkoutTypes: [' pushups ', 'pullups'],
  roundsPerStation: 3,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 15,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 30,
  startStationWorkManually: false,
  warmupEnabled: true,
  warmupMinutes: 5,
  warmupSeconds: 0,
  cooldownEnabled: true,
  cooldownMinutes: 5,
  cooldownSeconds: 0,
  category: 'GENERAL',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('normalizeTimer', () => {
  it('accepts current timer records', () => {
    expect(normalizeTimer(timer)).toMatchObject({
      stationCount: 10,
      roundsPerStation: 3,
      stationWorkoutTypes: ['pushups', 'pullups'],
    });
  });

  it('sanitizes and trims station workout types', () => {
    expect(normalizeTimer({
      ...timer,
      stationCount: 1,
      stationWorkoutTypes: [' pushups ', 5 as unknown as string, 'ignored'],
    })).toMatchObject({
      stationWorkoutTypes: ['pushups'],
    });
  });

  it('rejects legacy timers', () => {
    expect(normalizeTimer({
      id: 'legacy',
      name: 'Legacy',
      sets: 2,
      intervals: [],
    } as unknown as Timer)).toBeNull();
  });
});

describe('normalizeTimerRun', () => {
  const runBase: Omit<TimerRun, 'totalPerStationMs' | 'totalWorkMs'> = {
    id: 'run-1',
    timerId: 'timer-1',
    timerNameAtRun: 'Demo',
    timerSnapshot: timer,
    stationWorkoutTypes: ['pushups'],
    category: 'GENERAL',
    complete: true,
    ranAt: '2026-02-01T10:00:00.000Z',
    location: '',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
  };

  it('backfills calculated totals for legacy runs that do not have them', () => {
    const normalized = normalizeTimerRun(runBase as TimerRun);
    expect(normalized).toMatchObject({
      totalPerStationMs: 120000,
      totalWorkMs: 900000,
    });
  });

  it('keeps provided calculated totals when present', () => {
    const normalized = normalizeTimerRun({
      ...runBase,
      totalPerStationMs: 12345,
      totalWorkMs: 67890,
    });
    expect(normalized).toMatchObject({
      totalPerStationMs: 12345,
      totalWorkMs: 67890,
    });
  });

  it('forces run category to GENERAL', () => {
    const normalized = normalizeTimerRun({
      ...runBase,
      category: 'FAT-LOSS',
      totalPerStationMs: 12345,
      totalWorkMs: 67890,
    });
    expect(normalized?.category).toBe('GENERAL');
  });
});

describe('user storage scope', () => {
  it('normalizes email as trimmed lowercase scope key', () => {
    expect(normalizeStorageUserScope('  USER@Example.COM  ')).toBe('user@example.com');
  });

  it('derives DB name from normalized user scope', async () => {
    const openDbMock = vi.mocked(openDB);
    openDbMock.mockReset();
    openDbMock.mockResolvedValue({
      getAll: vi.fn().mockResolvedValue([]),
    } as never);

    setStorageUserScope('  USER@Example.COM  ');
    await TimerRepository.list();

    expect(openDbMock).toHaveBeenCalledWith(
      'nodoubt-hiit:user@example.com',
      expect.any(Number),
      expect.any(Object),
    );
  });
});
