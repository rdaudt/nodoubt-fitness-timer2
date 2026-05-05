import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const {
  fetchTenantPublicProfileMock,
  fetchTenantPublicTemplatesMock,
} = vi.hoisted(() => ({
  fetchTenantPublicProfileMock: vi.fn(),
  fetchTenantPublicTemplatesMock: vi.fn(),
}));

vi.mock('./services/tenantApi', () => ({
  fetchTenantPublicProfile: fetchTenantPublicProfileMock,
  fetchTenantPublicTemplates: fetchTenantPublicTemplatesMock,
}));

describe('App invalid URL behavior', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    fetchTenantPublicProfileMock.mockReset();
    fetchTenantPublicTemplatesMock.mockReset();
    fetchTenantPublicProfileMock.mockResolvedValue(null);
    fetchTenantPublicTemplatesMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders invalid URL page at root with non-clickable footer items', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Invalid Timer URL' })).toBeInTheDocument();
    expect(screen.getByText('The timer URL is invalid. Please check the link and try again.')).toBeInTheDocument();
    expect(document.querySelector('.topbar-invalid')).toBeTruthy();
    expect(screen.getByText('Timers')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('renders invalid URL page for unknown tenant slug', async () => {
    window.history.replaceState({}, '', '/unknown-tenant');
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Invalid Timer URL' })).toBeInTheDocument());
    expect(fetchTenantPublicProfileMock).toHaveBeenCalledWith('unknown-tenant');
  });
});
