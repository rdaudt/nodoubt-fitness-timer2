import { describe, expect, it } from 'vitest';
import type { Timer } from '../types';
import { validateTimer } from './timerRules';

const makeTimer = (overrides: Partial<Timer> = {}): Timer => ({
  id: 'timer-1',
  name: 'Demo',
  stationCount: 10,
  roundsPerStation: 3,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 15,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 30,
  startStationWorkManually: false,
  warmupEnabled: true,
  warmupMinutes: 5,
  warmupSeconds: 0,
  cooldownEnabled: true,
  cooldownMinutes: 5,
  cooldownSeconds: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('timerRules', () => {
  it('accepts valid timers', () => {
    expect(validateTimer(makeTimer()).valid).toBe(true);
  });

  it('enforces case-insensitive unique names', () => {
    const result = validateTimer(makeTimer({ name: 'Demo' }), [
      makeTimer({ id: 'timer-2', name: 'demo' }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Timer name must be unique.');
  });

  it('does not require rest time when rounds per station is one', () => {
    expect(validateTimer(makeTimer({ roundsPerStation: 1, restSeconds: 0 })).valid).toBe(true);
  });

  it('requires rest time when rounds per station is greater than one', () => {
    expect(validateTimer(makeTimer({ roundsPerStation: 2, restSeconds: 0 })).errors).toContain(
      'Rest time must be at least 1 second when rounds are greater than 1.',
    );
  });
});
