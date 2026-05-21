import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, isCoachModeEnabled, useAuth } from './authContext';
import type { AuthUser } from './authApi';
import { createElement } from 'react';

const {
  fetchMeMock,
  logoutMock,
  deleteAccountMock,
  setStorageLoggedOutScopeMock,
  setStorageUserScopeMock,
} = vi.hoisted(() => ({
  fetchMeMock: vi.fn(),
  logoutMock: vi.fn(),
  deleteAccountMock: vi.fn(),
  setStorageLoggedOutScopeMock: vi.fn(),
  setStorageUserScopeMock: vi.fn(),
}));

vi.mock('./authApi', () => ({
  fetchMe: fetchMeMock,
  logout: logoutMock,
  deleteAccount: deleteAccountMock,
  getGoogleLoginUrl: vi.fn((nextPath: string) => `/api/auth?action=login&next=${encodeURIComponent(nextPath)}`),
}));

vi.mock('./storage', () => ({
  setStorageLoggedOutScope: setStorageLoggedOutScopeMock,
  setStorageUserScope: setStorageUserScopeMock,
}));

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

const Probe = () => {
  const { loaded, logoutUser } = useAuth();
  return createElement(
    'div',
    null,
    createElement('span', { 'data-testid': 'loaded' }, loaded ? 'yes' : 'no'),
    createElement('button', { onClick: () => void logoutUser(), type: 'button' }, 'logout'),
  );
};

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

describe('AuthProvider storage scope binding', () => {
  afterEach(() => {
    cleanup();
    fetchMeMock.mockReset();
    logoutMock.mockReset();
    deleteAccountMock.mockReset();
    setStorageLoggedOutScopeMock.mockReset();
    setStorageUserScopeMock.mockReset();
  });

  it('binds storage scope using normalized email after fetchMe resolves', async () => {
    fetchMeMock.mockResolvedValue(createUser({ email: '  USER@Example.COM  ' }));

    const { getByTestId } = render(createElement(AuthProvider, null, createElement(Probe)));

    await waitFor(() => expect(getByTestId('loaded').textContent).toBe('yes'));
    expect(setStorageLoggedOutScopeMock).toHaveBeenCalled();
    expect(setStorageUserScopeMock).toHaveBeenCalledWith('user@example.com');
  });

  it('falls back to logged-out scope when authenticated payload has blank email', async () => {
    fetchMeMock.mockResolvedValue(createUser({ email: '   ' }));

    const { getByTestId } = render(createElement(AuthProvider, null, createElement(Probe)));

    await waitFor(() => expect(getByTestId('loaded').textContent).toBe('yes'));
    expect(setStorageUserScopeMock).not.toHaveBeenCalled();
    expect(setStorageLoggedOutScopeMock).toHaveBeenCalledTimes(2);
  });
});
