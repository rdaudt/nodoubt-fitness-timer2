import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEFAULT_SETTINGS } from './config';

const {
  fetchTenantPublicProfileMock,
  fetchTenantPublicProfileWithStatusMock,
  fetchTenantPublicTemplatesMock,
  fetchCoachDirectoryMock,
} = vi.hoisted(() => ({
  fetchTenantPublicProfileMock: vi.fn(),
  fetchTenantPublicProfileWithStatusMock: vi.fn(),
  fetchTenantPublicTemplatesMock: vi.fn(),
  fetchCoachDirectoryMock: vi.fn(),
}));

vi.mock('./services/tenantApi', () => ({
  fetchTenantPublicProfile: fetchTenantPublicProfileMock,
  fetchTenantPublicProfileWithStatus: fetchTenantPublicProfileWithStatusMock,
  fetchTenantPublicTemplates: fetchTenantPublicTemplatesMock,
  fetchCoachDirectory: fetchCoachDirectoryMock,
}));

vi.mock('./services/authContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useCoachMode: () => false,
  useAuth: () => ({
    loaded: true,
    user: { sub: 'sub-1', email: 'user@example.com', name: 'User', picture: '', isCoach: false },
    login: vi.fn(),
    logoutUser: vi.fn(),
    deleteCurrentAccount: vi.fn(),
  }),
}));

vi.mock('./services/settingsContext', () => ({
  SettingsProvider: ({ children }: { children: unknown }) => children,
  useSettings: () => ({
    loaded: true,
    settings: DEFAULT_SETTINGS,
    saveSettings: vi.fn(),
  }),
}));

describe('App invalid URL behavior', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    fetchTenantPublicProfileMock.mockReset();
    fetchTenantPublicProfileWithStatusMock.mockReset();
    fetchTenantPublicTemplatesMock.mockReset();
    fetchCoachDirectoryMock.mockReset();
    fetchTenantPublicProfileMock.mockResolvedValue(null);
    fetchTenantPublicProfileWithStatusMock.mockResolvedValue({ profile: null, status: 404 });
    fetchTenantPublicTemplatesMock.mockResolvedValue([]);
    fetchCoachDirectoryMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 12,
      total: 0,
      hasNextPage: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders coach directory at root when user has no My Coach', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'My Coach' })).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Search coach or business')).toBeInTheDocument();
    expect(fetchCoachDirectoryMock).toHaveBeenCalledWith('', 1, 12);
  });

  it('keeps saved coach when profile check fails transiently', async () => {
    window.localStorage.setItem('my_coach_slug', 'fit-coach');
    fetchTenantPublicProfileWithStatusMock.mockResolvedValueOnce({ profile: null, status: 500 });

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'My Coach' })).toBeInTheDocument());
    expect(window.localStorage.getItem('my_coach_slug')).toBe('fit-coach');
    expect(screen.getByText('We could not verify your saved coach right now. Please try again.')).toBeInTheDocument();
  });

  it('clears saved coach when profile is definitively missing', async () => {
    window.localStorage.setItem('my_coach_slug', 'fit-coach');
    fetchTenantPublicProfileWithStatusMock.mockResolvedValueOnce({ profile: null, status: 404 });

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'My Coach' })).toBeInTheDocument());
    expect(window.localStorage.getItem('my_coach_slug')).toBeNull();
    expect(screen.getByText('Your saved coach is no longer available. Please choose My Coach again.')).toBeInTheDocument();
  });

  it('renders invalid URL page for unknown tenant slug', async () => {
    window.history.replaceState({}, '', '/unknown-tenant/about');
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Invalid Timer URL' })).toBeInTheDocument());
    expect(fetchTenantPublicProfileMock).toHaveBeenCalledWith('unknown-tenant', undefined);
  });

});
