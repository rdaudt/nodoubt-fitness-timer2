import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEFAULT_SETTINGS } from './config';

const {
  fetchTenantPublicProfileMock,
  fetchTenantPublicTemplatesMock,
  fetchCoachDirectoryMock,
} = vi.hoisted(() => ({
  fetchTenantPublicProfileMock: vi.fn(),
  fetchTenantPublicTemplatesMock: vi.fn(),
  fetchCoachDirectoryMock: vi.fn(),
}));

vi.mock('./services/tenantApi', () => ({
  fetchTenantPublicProfile: fetchTenantPublicProfileMock,
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
    fetchTenantPublicTemplatesMock.mockReset();
    fetchCoachDirectoryMock.mockReset();
    fetchTenantPublicProfileMock.mockResolvedValue(null);
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

  it('renders invalid URL page for unknown tenant slug', async () => {
    window.history.replaceState({}, '', '/unknown-tenant/about');
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Invalid Timer URL' })).toBeInTheDocument());
    expect(fetchTenantPublicProfileMock).toHaveBeenCalledWith('unknown-tenant', undefined);
  });

});
