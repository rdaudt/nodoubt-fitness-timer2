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
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
      pauseBetweenSets: true,
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
    getMock.mockResolvedValue({
      id: 'timer-1',
      name: 'Demo Timer',
      sets: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      intervals: [
        { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
      ],
    });
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
