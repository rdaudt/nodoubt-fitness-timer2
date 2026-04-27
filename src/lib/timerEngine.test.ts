import { describe, expect, it } from 'vitest';
import type { Timer } from '../types';
import { buildTimeline } from './timerEngine';

const baseTimer = (): Timer => ({
  id: '1',
  name: 'Demo',
  stationCount: 2,
  roundsPerStation: 2,
  workMinutes: 0,
  workSeconds: 20,
  restMinutes: 0,
  restSeconds: 10,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 30,
  startStationWorkManually: false,
  warmupEnabled: true,
  warmupMinutes: 0,
  warmupSeconds: 5,
  cooldownEnabled: true,
  cooldownMinutes: 0,
  cooldownSeconds: 5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('timerEngine', () => {
  it('builds warmup, station rounds, station transition, and cooldown', () => {
    const timeline = buildTimeline(baseTimer());

    expect(timeline.map((x) => x.type)).toEqual([
      'warmup',
      'work',
      'rest',
      'work',
      'stationTransition',
      'work',
      'rest',
      'work',
      'cooldown',
    ]);
  });

  it('does not add rest after the last round in a station', () => {
    const timeline = buildTimeline({ ...baseTimer(), stationCount: 1, roundsPerStation: 3 });

    expect(timeline.map((x) => x.type)).toEqual(['warmup', 'work', 'rest', 'work', 'rest', 'work', 'cooldown']);
  });
});
