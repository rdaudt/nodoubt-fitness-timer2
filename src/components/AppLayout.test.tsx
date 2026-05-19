import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

const { coachModeMock } = vi.hoisted(() => ({
  coachModeMock: vi.fn(),
}));

vi.mock('../services/authContext', () => ({
  useCoachMode: () => coachModeMock(),
}));

vi.mock('../services/tenantContext', () => ({
  useTenant: () => ({
    profile: {
      igUsername: 'nodoubt',
      socialLinks: [],
      logoUrl: '',
      coachPhotoUrl: '',
      coachName: 'Coach',
      businessName: 'Biz',
      headerTagline: 'Tag',
    },
    toTenantPath: (path: string) => path,
  }),
}));

vi.mock('../services/perfTriage', () => ({
  getPerfTraceId: () => '',
  isPerfTriageEnabled: () => false,
  registerExpectedImage: vi.fn(),
  settleImage: vi.fn(),
}));

describe('AppLayout', () => {
  it('shows coach mode badge based on computed coach mode', () => {
    coachModeMock.mockReturnValue(true);
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<div>child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Coach mode ON')).toBeInTheDocument();

    coachModeMock.mockReturnValue(false);
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<div>child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Coach mode ON')).toBeNull();
  });
});
