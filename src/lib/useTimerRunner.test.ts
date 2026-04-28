import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timerEngine';
import { shouldPlayCountdownBeep } from './useTimerRunner';
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

  it('returns countdown beep seconds only for 5..1 boundaries', () => {
    expect(shouldPlayCountdownBeep(5000, null)).toBe(5);
    expect(shouldPlayCountdownBeep(4000, 5)).toBe(4);
    expect(shouldPlayCountdownBeep(3200, 4)).toBeNull();
    expect(shouldPlayCountdownBeep(1000, 2)).toBe(1);
    expect(shouldPlayCountdownBeep(0, 1)).toBeNull();
    expect(shouldPlayCountdownBeep(6100, null)).toBeNull();
  });
});
