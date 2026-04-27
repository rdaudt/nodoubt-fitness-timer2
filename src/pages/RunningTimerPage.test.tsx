import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEntry } from '../types';
import { RunningTimerPage } from './RunningTimerPage';

const { getMock, startMock, runnerMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  startMock: vi.fn(),
  runnerMock: vi.fn(),
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
  useTimerRunner: () => runnerMock(),
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
    runnerMock.mockReturnValue({
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

  it('colors the next activity card using the next activity type color', async () => {
    const timeline: TimelineEntry[] = [
      {
        id: 'work-1-1',
        type: 'work',
        name: 'Work',
        durationMs: 30000,
        stationNumber: 1,
        roundNumber: 1,
      },
      {
        id: 'rest-1-1',
        type: 'rest',
        name: 'Rest',
        durationMs: 15000,
        stationNumber: 1,
        roundNumber: 1,
      },
    ];

    runnerMock.mockReturnValue({
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 0,
        currentRemainingMs: 12000,
        totalRemainingMs: 42000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container } = renderRunningPage('/timer/timer-1/run');

    await screen.findByText('Rest');
    expect(screen.getByText('Station 1 - Round 1 (00:15)')).toBeInTheDocument();
    const nextCard = container.querySelector('.run-next-card');

    expect(nextCard).toBeTruthy();
    expect(nextCard).toHaveStyle({ backgroundColor: '#2ecc71' });
  });

  it('uses "Station Transition N" title in current and next cards', async () => {
    const timeline: TimelineEntry[] = [
      {
        id: 'transition-2',
        type: 'stationTransition',
        name: 'Transition to 2',
        durationMs: 30000,
        stationNumber: 2,
        roundNumber: null,
      },
      {
        id: 'work-2-1',
        type: 'work',
        name: 'Work',
        durationMs: 10000,
        stationNumber: 2,
        roundNumber: 1,
      },
    ];

    runnerMock.mockReturnValue({
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 0,
        currentRemainingMs: 10000,
        totalRemainingMs: 40000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { rerender } = renderRunningPage('/timer/timer-1/run');
    expect(await screen.findByRole('heading', { name: 'Station Transition 2' })).toBeInTheDocument();

    const timelineNextTransition: TimelineEntry[] = [
      {
        id: 'work-1-1',
        type: 'work',
        name: 'Work',
        durationMs: 10000,
        stationNumber: 1,
        roundNumber: 1,
      },
      {
        id: 'transition-2',
        type: 'stationTransition',
        name: 'Transition to 2',
        durationMs: 30000,
        stationNumber: 2,
        roundNumber: null,
      },
    ];

    runnerMock.mockReturnValue({
      timeline: timelineNextTransition,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 0,
        currentRemainingMs: 9000,
        totalRemainingMs: 39000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/timer/timer-1/run']}>
        <Routes>
          <Route path="/timer/:id/run" element={<RunningTimerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Station Transition 2')).toBeInTheDocument();
  });

  it('rotates work card image across work entries', async () => {
    const timeline: TimelineEntry[] = [
      {
        id: 'work-1-1',
        type: 'work',
        name: 'Work',
        durationMs: 30000,
        stationNumber: 1,
        roundNumber: 1,
      },
      {
        id: 'work-1-2',
        type: 'work',
        name: 'Work',
        durationMs: 30000,
        stationNumber: 1,
        roundNumber: 2,
      },
    ];

    runnerMock.mockReturnValue({
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 0,
        currentRemainingMs: 12000,
        totalRemainingMs: 60000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container, rerender } = renderRunningPage('/timer/timer-1/run');
    await screen.findAllByText('Work');
    const firstImage = container.querySelector('.run-current-image');
    expect(firstImage).toBeTruthy();
    const firstSrc = firstImage?.getAttribute('src');

    runnerMock.mockReturnValue({
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 1,
        currentRemainingMs: 11000,
        totalRemainingMs: 30000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/timer/timer-1/run']}>
        <Routes>
          <Route path="/timer/:id/run" element={<RunningTimerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const secondImage = container.querySelector('.run-current-image');
    expect(secondImage).toBeTruthy();
    const secondSrc = secondImage?.getAttribute('src');
    expect(firstSrc).not.toBe(secondSrc);
  });
});
