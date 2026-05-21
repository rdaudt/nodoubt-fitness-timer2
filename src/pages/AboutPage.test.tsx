import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutPage } from './AboutPage';

const { coachModeMock, clearMyCoachSlugMock } = vi.hoisted(() => ({
  coachModeMock: vi.fn(),
  clearMyCoachSlugMock: vi.fn(),
}));

vi.mock('../services/authContext', () => ({
  useCoachMode: () => coachModeMock(),
}));

vi.mock('../services/coachDirectory', () => ({
  clearMyCoachSlug: clearMyCoachSlugMock,
}));

vi.mock('../services/tenantContext', () => ({
  useTenant: () => ({
    profile: {
      businessName: 'No Doubt',
      coachName: 'Coach A',
      bio: 'Coach bio',
      coachPhotoUrl: '',
      igUsername: 'coacha',
      socialLinks: [],
    },
  }),
}));

vi.mock('../services/perfTriage', () => ({
  getPerfTraceId: () => '',
  isPerfTriageEnabled: () => false,
  registerExpectedImage: vi.fn(),
  settleImage: vi.fn(),
}));

describe('AboutPage', () => {
  const renderPage = () => render(
    <MemoryRouter initialEntries={['/coach/about']}>
      <Routes>
        <Route path="/coach/about" element={<AboutPage />} />
        <Route path="/" element={<div>root</div>} />
      </Routes>
    </MemoryRouter>,
  );

  beforeEach(() => {
    coachModeMock.mockReturnValue(false);
    clearMyCoachSlugMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows secondary Switch Coach button for non-coach mode', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Switch Coach' })).toBeInTheDocument();
  });

  it('hides Switch Coach button in coach mode', () => {
    coachModeMock.mockReturnValue(true);
    renderPage();
    expect(screen.queryByRole('button', { name: 'Switch Coach' })).toBeNull();
  });

  it('switch coach clears selection and navigates home', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Switch Coach' }));
    expect(clearMyCoachSlugMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('root')).toBeInTheDocument();
  });

  it('does not render Kobe AI ad image', () => {
    renderPage();
    expect(screen.queryByAltText('Kobe AI Solutions')).toBeNull();
  });
});
