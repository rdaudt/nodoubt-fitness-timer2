import { describe, expect, it } from 'vitest';
import { isSetBoundaryTransition } from './useTimerRunner';

describe('isSetBoundaryTransition', () => {
  it('returns true only when moving to a higher set number', () => {
    expect(isSetBoundaryTransition(
      { id: 'a', sourceSequence: 1, name: 'Work', type: 'work', durationMs: 1000, setNumber: 1 },
      { id: 'b', sourceSequence: 1, name: 'Work', type: 'work', durationMs: 1000, setNumber: 2 },
    )).toBe(true);
  });

  it('returns false for non-set transitions', () => {
    expect(isSetBoundaryTransition(
      { id: 'a', sourceSequence: 1, name: 'Warmup', type: 'warmup', durationMs: 1000, setNumber: null },
      { id: 'b', sourceSequence: 2, name: 'Work', type: 'work', durationMs: 1000, setNumber: 1 },
    )).toBe(false);
  });
});
