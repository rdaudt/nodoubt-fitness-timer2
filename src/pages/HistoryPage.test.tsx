import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './HistoryPage';

const { listAllRunsMock, listTimersMock, updateRunMock } = vi.hoisted(() => ({
  listAllRunsMock: vi.fn(),
  listTimersMock: vi.fn(),
  updateRunMock: vi.fn(),
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    list: listTimersMock,
  },
  TimerRunRepository: {
    listAll: listAllRunsMock,
    update: updateRunMock,
    remove: vi.fn(),
  },
}));

const timer = {
  id: 'timer-1',
  name: 'Demo Timer',
  stationCount: 1,
  roundsPerStation: 1,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 0,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 30,
  startStationWorkManually: false,
  warmupEnabled: false,
  warmupMinutes: 0,
  warmupSeconds: 0,
  cooldownEnabled: false,
  cooldownMinutes: 0,
  cooldownSeconds: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTimersMock.mockResolvedValue([timer]);
    listAllRunsMock.mockResolvedValue([{
      id: 'run-1',
      timerId: 'timer-1',
      timerNameAtRun: 'Demo Timer',
      timerSnapshot: timer,
      complete: false,
      ranAt: '2026-02-01T10:00:00.000Z',
      location: '',
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    }]);
    updateRunMock.mockResolvedValue(undefined);
  });

  it('renders run history and updates location', async () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Demo Timer' })).toHaveAttribute('href', '/timer/timer-1');
    expect(screen.getByText('Complete: OFF')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByLabelText('Run location');
    fireEvent.change(input, { target: { value: 'Downtown Box' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateRunMock).toHaveBeenCalledTimes(1));
    expect(updateRunMock.mock.calls[0][0]).toEqual(expect.objectContaining({ location: 'Downtown Box' }));
  });
});
