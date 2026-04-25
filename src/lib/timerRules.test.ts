import { describe, expect, it } from 'vitest';
import { normalizeIntervals, validateIntervals } from './timerRules';
import type { Interval } from '../types';

describe('timerRules', () => {
  it('allows a final work interval without auto-inserting rest', () => {
    const source: Interval[] = [
      { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
    ];

    const normalized = normalizeIntervals(source);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].type).toBe('work');

    const validation = validateIntervals(source);
    expect(validation.valid).toBe(true);
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

  it('does not auto-insert trailing rest before cooldown', () => {
    const normalized = normalizeIntervals([
      { sequence: 1, name: 'Warmup', type: 'warmup', durationMinutes: 0, durationSeconds: 10 },
      { sequence: 2, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 20 },
      { sequence: 3, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 10 },
    ]);

    expect(normalized.map((x) => x.type)).toEqual(['warmup', 'work', 'cooldown']);

    const validation = validateIntervals(normalized);
    expect(validation.valid).toBe(true);
  });

  it('rejects consecutive work intervals', () => {
    const result = validateIntervals([
      { sequence: 1, name: 'Work 1', type: 'work', durationMinutes: 0, durationSeconds: 20 },
      { sequence: 2, name: 'Work 2', type: 'work', durationMinutes: 0, durationSeconds: 20 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((x) => x.includes('cannot be followed by another work interval'))).toBe(true);
  });

  it('rejects consecutive rest intervals', () => {
    const result = validateIntervals([
      { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 20 },
      { sequence: 2, name: 'Rest 1', type: 'rest', durationMinutes: 0, durationSeconds: 10 },
      { sequence: 3, name: 'Rest 2', type: 'rest', durationMinutes: 0, durationSeconds: 10 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((x) => x.includes('cannot be followed by another rest interval'))).toBe(true);
  });
});
