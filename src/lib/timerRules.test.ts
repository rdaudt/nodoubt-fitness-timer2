import { describe, expect, it } from 'vitest';
import { normalizeIntervals, validateIntervals } from './timerRules';
import type { Interval } from '../types';

describe('timerRules', () => {
  it('auto inserts rest after work when missing', () => {
    const source: Interval[] = [
      { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
    ];

    const normalized = normalizeIntervals(source);
    expect(normalized).toHaveLength(2);
    expect(normalized[1].type).toBe('rest');
  });

  it('rejects zero-duration intervals', () => {
    const result = validateIntervals([
      { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 0 },
      { sequence: 2, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 20 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((x) => x.includes('zero duration'))).toBe(true);
  });

  it('repositions warmup first and cooldown last', () => {
    const normalized = normalizeIntervals([
      { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
      { sequence: 2, name: 'Warmup', type: 'warmup', durationMinutes: 0, durationSeconds: 10 },
      { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 20 },
      { sequence: 4, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 15 },
    ]);

    expect(normalized[0].type).toBe('warmup');
    expect(normalized[normalized.length - 1].type).toBe('cooldown');
  });
});
