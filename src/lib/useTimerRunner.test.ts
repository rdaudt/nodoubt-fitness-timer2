import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timerEngine';
import type { Timer } from '../types';

const timer: Timer = {
  id: 'timer-1',
  name: 'Demo',
  stationCount: 1,
  roundsPerStation: 2,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 15,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 30,
  startStationWorkManually: true,
  warmupEnabled: true,
  warmupMinutes: 0,
  warmupSeconds: 10,
  cooldownEnabled: false,
  cooldownMinutes: 0,
  cooldownSeconds: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useTimerRunner dependencies', () => {
  it('uses timeline entries that can support manual station starts', () => {
    expect(buildTimeline(timer).map((entry) => entry.type)).toEqual(['warmup', 'work', 'rest', 'work']);
  });
});
