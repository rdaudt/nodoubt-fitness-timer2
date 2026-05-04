import { describe, expect, it } from 'vitest';
import { randomTimerName, randomUniqueTimerName, TIMER_NAME_IDEAS } from './timerFactory';

describe('timerFactory', () => {
  it('selects timer names from the playful name list', () => {
    expect(randomTimerName(() => 0)).toBe('Certain Death');
    expect(randomTimerName(() => 0.999999)).toBe('Embrace The Pain');
  });

  it('keeps generated names inside the configured list', () => {
    expect(TIMER_NAME_IDEAS).toContain(randomTimerName(() => 0.42));
  });

  it('retries until it finds a unique timer name', () => {
    const existingNames = ['Certain Death'];
    const randomValues = [0, 0.999999];
    const pick = () => randomValues.shift() ?? 0.5;

    expect(randomUniqueTimerName(existingNames, pick)).toBe('Embrace The Pain');
  });

  it('throws when all configured names are already used', () => {
    expect(() => randomUniqueTimerName(TIMER_NAME_IDEAS)).toThrow('No unique timer names available.');
  });
});
