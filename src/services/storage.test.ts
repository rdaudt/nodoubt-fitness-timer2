import { describe, expect, it, vi } from 'vitest';
import { normalizeTimer } from './storage';
import type { Timer } from '../types';

vi.mock('idb', () => ({
  openDB: vi.fn(),
}));

const timer: Timer = {
  id: 'timer-1',
  name: 'Demo',
  stationCount: 10,
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('normalizeTimer', () => {
  it('accepts current timer records', () => {
    expect(normalizeTimer(timer)).toMatchObject({
      stationCount: 10,
      roundsPerStation: 3,
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
