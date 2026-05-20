import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

const { coachModeMock } = vi.hoisted(() => ({
  coachModeMock: vi.fn(),
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

vi.mock('../services/authContext', () => ({
  useCoachMode: () => coachModeMock(),
}));

describe('AppLayout', () => {
  beforeEach(() => {
    coachModeMock.mockReturnValue(false);
  });

  it('does not render the coach mode text in the header', () => {
    render(
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

  it('hides HIIT Classes nav item for athletes', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<div>child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('HIIT Classes')).toBeNull();
  });

  it('shows HIIT Classes nav item for coaches', () => {
    coachModeMock.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<div>child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('HIIT Classes')).toBeInTheDocument();
  });
});
