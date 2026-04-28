import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEntry } from '../types';
import { RunningTimerPage } from './RunningTimerPage';

const { getMock, upsertMock, startMock, runnerMock, settingsMock, saveSettingsMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  upsertMock: vi.fn(),
  startMock: vi.fn(),
  runnerMock: vi.fn(),
  settingsMock: vi.fn(),
  saveSettingsMock: vi.fn(),
}));

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: settingsMock(),
    saveSettings: saveSettingsMock,
  }),
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    get: getMock,
    upsert: upsertMock,
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
    saveSettingsMock.mockResolvedValue(undefined);
    upsertMock.mockResolvedValue(undefined);
    settingsMock.mockReturnValue({
      coachMode: true,
      kobeEverywhere: true,
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
    });
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

  it('hides running card cat image when Kobe Everywhere is off', async () => {
    settingsMock.mockReturnValue({
      coachMode: true,
      kobeEverywhere: false,
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
    });

    const timeline: TimelineEntry[] = [
      {
        id: 'work-1-1',
        type: 'work',
        name: 'Work',
        durationMs: 30000,
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
        totalRemainingMs: 30000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container } = renderRunningPage('/timer/timer-1/run');
    await screen.findByText('Work');
    expect(container.querySelector('.run-current-image')).toBeNull();
  });

  it('renders map shape from station and rounds config with warmup and cooldown circles', async () => {
    getMock.mockResolvedValue({
      ...timer,
      stationCount: 3,
      roundsPerStation: 3,
      warmupEnabled: true,
      warmupMinutes: 1,
      cooldownEnabled: true,
      cooldownMinutes: 1,
    });

    const timeline: TimelineEntry[] = [
      {
        id: 'warmup',
        type: 'warmup',
        name: 'Warmup',
        durationMs: 60000,
        stationNumber: null,
        roundNumber: null,
      },
    ];

    runnerMock.mockReturnValue({
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 0,
        currentRemainingMs: 59000,
        totalRemainingMs: 180000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container } = renderRunningPage('/timer/timer-1/run');
    await screen.findByText('Warmup');

    const rows = container.querySelectorAll('.run-session-map-row');
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row.querySelectorAll('.run-session-map-circle')).toHaveLength(5);
    });

    const standaloneCircles = container.querySelectorAll('.run-session-map-standalone .run-session-map-circle');
    expect(standaloneCircles).toHaveLength(2);
  });

  it('highlights warmup and cooldown circles when active', async () => {
    getMock.mockResolvedValue({
      ...timer,
      stationCount: 2,
      roundsPerStation: 2,
      warmupEnabled: true,
      warmupMinutes: 1,
      cooldownEnabled: true,
      cooldownMinutes: 1,
    });

    const timeline: TimelineEntry[] = [
      {
        id: 'warmup',
        type: 'warmup',
        name: 'Warmup',
        durationMs: 60000,
        stationNumber: null,
        roundNumber: null,
      },
      {
        id: 'cooldown',
        type: 'cooldown',
        name: 'Cooldown',
        durationMs: 60000,
        stationNumber: null,
        roundNumber: null,
      },
    ];

    runnerMock.mockReturnValue({
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 0,
        currentRemainingMs: 20000,
        totalRemainingMs: 120000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container, rerender } = renderRunningPage('/timer/timer-1/run');
    await screen.findByText('Warmup');

    let activeStandalone = container.querySelectorAll('.run-session-map-standalone .run-session-map-circle.active');
    expect(activeStandalone).toHaveLength(1);
    expect(activeStandalone[0]).toHaveAttribute('aria-label', 'Warmup active');

    runnerMock.mockReturnValue({
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 1,
        currentRemainingMs: 15000,
        totalRemainingMs: 15000,
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

    activeStandalone = container.querySelectorAll('.run-session-map-standalone .run-session-map-circle.active');
    expect(activeStandalone).toHaveLength(1);
    expect(activeStandalone[0]).toHaveAttribute('aria-label', 'Cooldown active');
  });

  it('maps work/rest active interval to the correct station circle', async () => {
    getMock.mockResolvedValue({
      ...timer,
      stationCount: 3,
      roundsPerStation: 3,
    });

    const timeline: TimelineEntry[] = [
      {
        id: 'rest-1-2',
        type: 'rest',
        name: 'Rest',
        durationMs: 15000,
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
        currentRemainingMs: 7000,
        totalRemainingMs: 65000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container } = renderRunningPage('/timer/timer-1/run');
    await screen.findByText('Rest');

    const rows = container.querySelectorAll('.run-session-map-row');
    const firstRowActive = rows[0]?.querySelectorAll('.run-session-map-circle.active');
    const secondRowActive = rows[1]?.querySelectorAll('.run-session-map-circle.active');
    expect(firstRowActive).toHaveLength(1);
    expect(secondRowActive).toHaveLength(0);
    expect(firstRowActive?.[0]).toHaveAttribute('aria-label', 'Station 1 rest active');
  });

  it('shows transition arrow and no active station circles during station transition', async () => {
    getMock.mockResolvedValue({
      ...timer,
      stationCount: 3,
      roundsPerStation: 3,
    });

    const timeline: TimelineEntry[] = [
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
      timeline,
      state: {
        status: 'running',
        pauseReason: null,
        currentIndex: 0,
        currentRemainingMs: 9000,
        totalRemainingMs: 90000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container } = renderRunningPage('/timer/timer-1/run');
    await screen.findByRole('heading', { name: 'Station Transition 2' });

    expect(container.querySelector('.run-session-map-transition-arrow')).toBeTruthy();
    expect(container.querySelectorAll('.run-session-map-row .run-session-map-circle.active')).toHaveLength(0);
  });

  it('shows map by default and toggles it on and off', async () => {
    getMock.mockResolvedValue({
      ...timer,
      stationCount: 2,
      roundsPerStation: 2,
    });

    const timeline: TimelineEntry[] = [
      {
        id: 'work-1-1',
        type: 'work',
        name: 'Work',
        durationMs: 30000,
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
        currentRemainingMs: 16000,
        totalRemainingMs: 30000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container } = renderRunningPage('/timer/timer-1/run');
    await screen.findByText('Work');

    const toggle = screen.getByLabelText('Show session map');
    expect(container.querySelector('.run-session-map')).toBeTruthy();

    fireEvent.click(toggle);
    expect(container.querySelector('.run-session-map')).toBeNull();

    fireEvent.click(toggle);
    expect(container.querySelector('.run-session-map')).toBeTruthy();
  });

  it('uses settings interval colors for map circles', async () => {
    settingsMock.mockReturnValue({
      coachMode: true,
      kobeEverywhere: true,
      intervalColors: {
        warmup: '#111111',
        work: '#123456',
        rest: '#abcdef',
        cooldown: '#fedcba',
      },
    });

    getMock.mockResolvedValue({
      ...timer,
      stationCount: 1,
      roundsPerStation: 2,
    });

    const timeline: TimelineEntry[] = [
      {
        id: 'work-1-1',
        type: 'work',
        name: 'Work',
        durationMs: 30000,
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
        currentRemainingMs: 16000,
        totalRemainingMs: 30000,
      },
      start: startMock,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    const { container } = renderRunningPage('/timer/timer-1/run');
    await screen.findByText('Work');

    const firstWorkCircle = container.querySelector('.run-session-map-row .run-session-map-circle');
    expect(firstWorkCircle).toHaveStyle({ backgroundColor: '#123456' });
  });

  it('persists Kobe Everywhere immediately when toggled', async () => {
    renderRunningPage('/timer/timer-1/run');
    const toggle = await screen.findByLabelText('Kobe Everywhere');

    fireEvent.click(toggle);

    expect(saveSettingsMock).toHaveBeenCalledTimes(1);
    expect(saveSettingsMock).toHaveBeenCalledWith({
      coachMode: true,
      kobeEverywhere: false,
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
    });
  });

  it('persists Start Set Manually immediately when toggled', async () => {
    renderRunningPage('/timer/timer-1/run');
    const toggle = await screen.findByLabelText('Start Set Manually');

    fireEvent.click(toggle);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'timer-1',
      startStationWorkManually: true,
    }));
  });
});
