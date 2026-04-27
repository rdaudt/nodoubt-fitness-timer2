import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunningTimerPage } from './RunningTimerPage';

const { getMock, startMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  startMock: vi.fn(),
}));

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: {
      coachMode: true,
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
    },
  }),
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    get: getMock,
  },
}));

vi.mock('../lib/useTimerRunner', () => ({
  useTimerRunner: () => ({
    timeline: [],
    state: {
      status: 'completed',
      pauseReason: null,
      currentIndex: 0,
      currentRemainingMs: 0,
      totalRemainingMs: 0,
    },
    start: startMock,
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  }),
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

const renderRunningPage = (initialPath: string) => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path="/timer/:id/run" element={<RunningTimerPage />} />
    </Routes>
  </MemoryRouter>,
);

describe('RunningTimerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue(timer);
  });

  afterEach(() => {
    cleanup();
  });

  it('returns home after a timer started from the home page completes', async () => {
    renderRunningPage('/timer/timer-1/run?from=home');

    expect(await screen.findByRole('link', { name: 'Done' })).toHaveAttribute('href', '/');
  });

  it('returns to timer detail after a timer started from detail completes', async () => {
    renderRunningPage('/timer/timer-1/run');

    expect(await screen.findByRole('link', { name: 'Done' })).toHaveAttribute('href', '/timer/timer-1');
  });
});
