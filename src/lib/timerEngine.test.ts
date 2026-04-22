import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timerEngine';
import type { Timer } from '../types';

const timer: Timer = {
  id: '1',
  name: 'Demo',
  sets: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  intervals: [
    { sequence: 1, name: 'Warmup', type: 'warmup', durationMinutes: 0, durationSeconds: 10 },
    { sequence: 2, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 20 },
    { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 15 },
    { sequence: 4, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 10 },
  ],
};

describe('timerEngine', () => {
  it('expands work/rest block by set count with single warmup/cooldown', () => {
    const timeline = buildTimeline(timer);
    expect(timeline).toHaveLength(6);
    expect(timeline[0].type).toBe('warmup');
    expect(timeline[1].setNumber).toBe(1);
    expect(timeline[3].setNumber).toBe(2);
    expect(timeline[5].type).toBe('cooldown');
  });
});
