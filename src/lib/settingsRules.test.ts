import { describe, expect, it } from 'vitest';
import { intervalColorsAreUnique } from './settingsRules';
import { DEFAULT_SETTINGS } from '../config';

describe('settingsRules', () => {
  it('accepts unique colors', () => {
    expect(intervalColorsAreUnique(DEFAULT_SETTINGS)).toBe(true);
  });

  it('rejects duplicates', () => {
    expect(
      intervalColorsAreUnique({
        coachMode: true,
        kobeEverywhere: true,
        intervalColors: {
          warmup: '#111111',
          work: '#111111',
          rest: '#222222',
          cooldown: '#333333',
        },
      }),
    ).toBe(false);
  });
});
