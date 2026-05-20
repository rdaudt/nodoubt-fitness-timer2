import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachDirectoryPage } from './CoachDirectoryPage';

const { fetchCoachDirectoryMock, navigateMock } = vi.hoisted(() => ({
  fetchCoachDirectoryMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('../services/tenantApi', () => ({
  fetchCoachDirectory: fetchCoachDirectoryMock,
}));

vi.mock('../services/authContext', () => ({
  useAuth: () => ({
    loaded: true,
    user: { email: 'user@example.com' },
    login: vi.fn(),
    logoutUser: vi.fn(),
    deleteCurrentAccount: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('CoachDirectoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fetchCoachDirectoryMock.mockResolvedValue({
      items: [{
        slug: 'fit-coach',
        coachName: 'Coach Fit',
        businessName: 'No Doubt',
        coachPhotoUrl: '',
        igUsername: '',
      }],
      page: 1,
      pageSize: 12,
      total: 1,
      hasNextPage: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('sets my coach slug and navigates on Set as My Coach', async () => {
    render(<MemoryRouter><CoachDirectoryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Coach Fit')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Set as My Coach' }));
    expect(window.localStorage.getItem('my_coach_slug')).toBe('fit-coach');
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/fit-coach'));
  });

  it('opens instagram externally on card tap when username exists', async () => {
    fetchCoachDirectoryMock.mockResolvedValueOnce({
      items: [{
        slug: 'fit-coach',
        coachName: 'Coach Fit',
        businessName: 'No Doubt',
        coachPhotoUrl: '',
        igUsername: 'coachfit',
      }],
      page: 1,
      pageSize: 12,
      total: 1,
      hasNextPage: false,
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<MemoryRouter><CoachDirectoryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Coach Fit').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Coach Fit')[0].closest('article') as HTMLElement);
    expect(openSpy).toHaveBeenCalledWith('https://www.instagram.com/coachfit/', '_blank', 'noopener,noreferrer');
  });
});
