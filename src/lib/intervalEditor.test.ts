import { describe, expect, it } from 'vitest';
import { insertQuickInterval } from './intervalEditor';
import type { Interval } from '../types';

const base: Interval[] = [
  { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
  { sequence: 2, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 15 },
  { sequence: 3, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 15 },
];

describe('insertQuickInterval', () => {
  it('inserts warmup as first interval', () => {
    const result = insertQuickInterval(base, 'warmup');
    expect(result[0].type).toBe('warmup');
  });

  it('inserts cooldown as last interval', () => {
    const result = insertQuickInterval(base, 'cooldown');
    expect(result[result.length - 1].type).toBe('cooldown');
  });

  it('inserts work before cooldown when cooldown exists', () => {
    const result = insertQuickInterval(base, 'work');
    expect(result[result.length - 2].type).toBe('work');
    expect(result[result.length - 1].type).toBe('cooldown');
  });

  it('appends rest to end when cooldown does not exist', () => {
    const withoutCooldown = base.filter((x) => x.type !== 'cooldown');
    const result = insertQuickInterval(withoutCooldown, 'rest');
    expect(result[result.length - 1].type).toBe('rest');
  });
});
