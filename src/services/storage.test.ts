import { describe, expect, it, vi } from 'vitest';
import { normalizeTimer } from './storage';
import type { Timer } from '../types';

vi.mock('idb', () => ({
  openDB: vi.fn(),
}));

describe('normalizeTimer', () => {
  it('defaults legacy timers to finite sets', () => {
    const legacyTimer = {
      id: 'timer-1',
      name: 'Legacy',
      sets: 2,
      intervals: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Timer;

    expect(normalizeTimer(legacyTimer)).toMatchObject({
      sets: 2,
      repeatSetsUntilStopped: false,
      setTransitionMinutes: 0,
      setTransitionSeconds: 30,
    });
  });
});
