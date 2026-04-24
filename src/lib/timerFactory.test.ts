import { describe, expect, it } from 'vitest';
import { randomTimerName, TIMER_NAME_IDEAS } from './timerFactory';

describe('timerFactory', () => {
  it('selects timer names from the playful name list', () => {
    expect(randomTimerName(() => 0)).toBe('Certain Death');
    expect(randomTimerName(() => 0.999999)).toBe('Embrace The Pain');
  });

  it('keeps generated names inside the configured list', () => {
    expect(TIMER_NAME_IDEAS).toContain(randomTimerName(() => 0.42));
  });
});
