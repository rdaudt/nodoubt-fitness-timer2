import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timerEngine';
import type { Timer } from '../types';

const baseTimer = (): Timer => ({
  id: '1',
  name: 'Demo',
  sets: 2,
  repeatSetsUntilStopped: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  intervals: [],
});

describe('timerEngine', () => {
  it('treats sets as runtime repeats of core work/rest block', () => {
    const timer: Timer = {
      ...baseTimer(),
      intervals: [
        { sequence: 1, name: 'Warmup', type: 'warmup', durationMinutes: 0, durationSeconds: 10 },
        { sequence: 2, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 20 },
        { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 15 },
        { sequence: 4, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 10 },
      ],
    };

    const timeline = buildTimeline(timer);

    // 4 configured intervals with 2 sets should not become 8:
    // warmup once + (work/rest x 2 sets) + cooldown once => 6 total.
    expect(timeline).toHaveLength(6);
    expect(timeline.map((x) => x.type)).toEqual(['warmup', 'work', 'rest', 'work', 'rest', 'cooldown']);
  });

  it('runs warmup only on first set and cooldown only on last set', () => {
    const timer: Timer = {
      ...baseTimer(),
      intervals: [
        { sequence: 1, name: 'Warmup', type: 'warmup', durationMinutes: 0, durationSeconds: 5 },
        { sequence: 2, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 20 },
        { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 10 },
        { sequence: 4, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 5 },
      ],
    };

    const timeline = buildTimeline(timer);

    expect(timeline.filter((x) => x.type === 'warmup')).toHaveLength(1);
    expect(timeline.filter((x) => x.type === 'cooldown')).toHaveLength(1);
    expect(timeline[0].type).toBe('warmup');
    expect(timeline[timeline.length - 1].type).toBe('cooldown');
    expect(timeline[0].setNumber).toBeNull();
    expect(timeline[timeline.length - 1].setNumber).toBeNull();
  });

  it('builds one core set and skips cooldown for repeat timers', () => {
    const timeline = buildTimeline({
      ...baseTimer(),
      repeatSetsUntilStopped: true,
      intervals: [
        { sequence: 1, name: 'Warmup', type: 'warmup', durationMinutes: 0, durationSeconds: 5 },
        { sequence: 2, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 20 },
        { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 10 },
        { sequence: 4, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 5 },
      ],
    });

    expect(timeline.map((x) => x.type)).toEqual(['warmup', 'work', 'rest']);
  });
});
