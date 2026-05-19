import { describe, expect, it } from 'vitest';
import { isCoachModeEnabled } from './authContext';
import type { AuthUser } from './authApi';

const createUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  sub: 'sub-1',
  email: 'coach@example.com',
  name: 'Coach',
  picture: '',
  isCoach: true,
  coachSlug: 'fit-hub',
  coachOwnershipValid: true,
  ...overrides,
});

describe('isCoachModeEnabled', () => {
  it('returns true when ownership is valid and route slug matches', () => {
    expect(isCoachModeEnabled(createUser(), 'fit-hub')).toBe(true);
    expect(isCoachModeEnabled(createUser({ coachSlug: 'FIT-HUB' }), 'fit-hub')).toBe(true);
  });

  it('returns false when route slug does not match coach slug', () => {
    expect(isCoachModeEnabled(createUser(), 'other-hub')).toBe(false);
  });

  it('returns false when ownership is invalid', () => {
    expect(isCoachModeEnabled(createUser({ coachOwnershipValid: false, isCoach: false, coachSlug: null }), 'fit-hub')).toBe(false);
  });
});
