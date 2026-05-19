import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();

vi.mock('../../api/_tenantsDb', () => ({
  getTenantsDb: vi.fn(() => ({
    execute: executeMock,
  })),
}));

describe('resolveCoachOwnershipByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not coach when no records match the email', async () => {
    executeMock.mockResolvedValueOnce({ rows: [] });
    const { resolveCoachOwnershipByEmail } = await import('../../api/_auth');

    const result = await resolveCoachOwnershipByEmail('coach@example.com');

    expect(result).toEqual({
      isCoach: false,
      coachSlug: null,
      coachOwnershipValid: false,
    });
  });

  it('returns valid ownership with slug when exactly one record matches', async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ slug: 'Fit-Hub' }] });
    const { resolveCoachOwnershipByEmail } = await import('../../api/_auth');

    const result = await resolveCoachOwnershipByEmail('coach@example.com');

    expect(result).toEqual({
      isCoach: true,
      coachSlug: 'fit-hub',
      coachOwnershipValid: true,
    });
  });

  it('returns invalid ownership when multiple records match the same email', async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ slug: 'fit-hub' }, { slug: 'fit-hub-2' }] });
    const { resolveCoachOwnershipByEmail } = await import('../../api/_auth');

    const result = await resolveCoachOwnershipByEmail('coach@example.com');

    expect(result).toEqual({
      isCoach: false,
      coachSlug: null,
      coachOwnershipValid: false,
    });
  });
});
