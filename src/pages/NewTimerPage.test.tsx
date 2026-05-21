import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTimerPage } from './NewTimerPage';

const { createNewTimerMock } = vi.hoisted(() => ({
  createNewTimerMock: vi.fn(),
}));

vi.mock('../services/timerCreation', () => ({
  createNewTimer: createNewTimerMock,
}));

describe('NewTimerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createNewTimerMock.mockResolvedValue({
      id: 'timer-1',
      name: 'Pain Party',
      stationCount: 10,
      roundsPerStation: 3,
      workMinutes: 0,
      workSeconds: 30,
      restMinutes: 0,
      restSeconds: 15,
      stationTransitionMinutes: 0,
      stationTransitionSeconds: 30,
      startStationWorkManually: false,
      warmupEnabled: true,
      warmupMinutes: 5,
      warmupSeconds: 0,
      cooldownEnabled: true,
      cooldownMinutes: 5,
      cooldownSeconds: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('navigates to the new timer detail under React StrictMode', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/timer/new']}>
          <Routes>
            <Route path="/timer/new" element={<NewTimerPage />} />
            <Route path="/timer/:id" element={<p>Timer detail</p>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByText('Timer detail')).toBeInTheDocument();
    await waitFor(() => expect(createNewTimerMock).toHaveBeenCalled());
  });
});
