import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTimerPage } from './NewTimerPage';

const { newTimerMock, upsertMock } = vi.hoisted(() => ({
  newTimerMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('../lib/timerFactory', () => ({
  newTimer: newTimerMock,
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    upsert: upsertMock,
  },
}));

describe('NewTimerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    newTimerMock.mockReturnValue({
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
    upsertMock.mockResolvedValue(undefined);
  });

  it('creates only one timer under React StrictMode', async () => {
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
    await waitFor(() => expect(newTimerMock).toHaveBeenCalledTimes(1));
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
