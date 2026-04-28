import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerDetailPage } from './TimerDetailPage';
import type { Timer } from '../types';

const { getMock, listMock, upsertMock, removeMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  listMock: vi.fn(),
  upsertMock: vi.fn(),
  removeMock: vi.fn(),
}));
const { settingsMock } = vi.hoisted(() => ({
  settingsMock: vi.fn(),
}));

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: settingsMock(),
  }),
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    get: getMock,
    list: listMock,
    upsert: upsertMock,
    remove: removeMock,
  },
}));

const timer: Timer = {
  id: 'timer-1',
  name: 'Demo Timer',
  stationCount: 10,
  stationWorkoutTypes: [],
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
};

describe('TimerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.mockReturnValue({
      coachMode: true,
      kobeEverywhere: true,
      endIntervalLongBeep: true,
      countdownLast5Beeps: true,
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
    });
    getMock.mockResolvedValue(timer);
    listMock.mockResolvedValue([timer]);
    upsertMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders typed timer attributes', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Timer name')).toHaveValue('Demo Timer');
    expect(screen.getByText('# Stations')).toBeInTheDocument();
    expect(screen.getByText('# Rounds/Station')).toBeInTheDocument();
    expect(screen.getByText('Timing Matrix')).toBeInTheDocument();
    expect(screen.getByText('Station Transition')).toBeInTheDocument();
    expect(screen.getByText('Cooldown')).toBeInTheDocument();
    expect(screen.getByText('Start Set Manually')).toBeInTheDocument();
  });

  it('persists name edits on blur', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const nameInput = await screen.findByLabelText('Timer name');
    fireEvent.change(nameInput, { target: { value: 'Sprint Lab' } });
    fireEvent.blur(nameInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock.mock.calls[0][0].name).toBe('Sprint Lab');
  });

  it('allows clearing count input while editing and clamps on blur', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const stationsInput = await screen.findByDisplayValue('10');
    fireEvent.input(stationsInput, { target: { value: '' } });

    fireEvent.blur(stationsInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock.mock.calls[0][0].stationCount).toBe(1);
  });

  it('persists timing matrix edits on blur', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const workInput = await screen.findByLabelText('Work time');
    fireEvent.change(workInput, { target: { value: '00:45' } });
    fireEvent.blur(workInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock.mock.calls[0][0].workMinutes).toBe(0);
    expect(upsertMock.mock.calls[0][0].workSeconds).toBe(45);
  });

  it('interprets one or two typed digits as seconds', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const workInput = await screen.findByLabelText('Work time');

    fireEvent.focus(workInput);
    fireEvent.change(workInput, { target: { value: '5' } });
    fireEvent.blur(workInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock.mock.calls[0][0].workMinutes).toBe(0);
    expect(upsertMock.mock.calls[0][0].workSeconds).toBe(5);

    fireEvent.focus(workInput);
    fireEvent.change(workInput, { target: { value: '15' } });
    fireEvent.blur(workInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(2));
    expect(upsertMock.mock.calls[1][0].workMinutes).toBe(0);
    expect(upsertMock.mock.calls[1][0].workSeconds).toBe(15);
  });

  it('interprets three or four typed digits as minutes and seconds', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const workInput = await screen.findByLabelText('Work time');

    fireEvent.focus(workInput);
    fireEvent.change(workInput, { target: { value: '130' } });
    fireEvent.blur(workInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock.mock.calls[0][0].workMinutes).toBe(1);
    expect(upsertMock.mock.calls[0][0].workSeconds).toBe(30);

    fireEvent.focus(workInput);
    fireEvent.change(workInput, { target: { value: '1510' } });
    fireEvent.blur(workInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(2));
    expect(upsertMock.mock.calls[1][0].workMinutes).toBe(15);
    expect(upsertMock.mock.calls[1][0].workSeconds).toBe(10);
  });

  it('rejects invalid seconds and does not persist out-of-range values', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const workInput = await screen.findByLabelText('Work time');
    fireEvent.focus(workInput);
    fireEvent.change(workInput, { target: { value: '1560' } });
    fireEvent.blur(workInput);

    await waitFor(() => expect(upsertMock).not.toHaveBeenCalled());
  });

  it('shows workout type inputs in coach mode and persists on blur', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const station1Input = await screen.findByLabelText('Station 1 workout type');
    fireEvent.change(station1Input, { target: { value: 'Pushups' } });
    fireEvent.blur(station1Input);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      stationWorkoutTypes: expect.arrayContaining(['Pushups']),
    }));
  });

  it('hides workout type section when coach mode is off', async () => {
    settingsMock.mockReturnValue({
      coachMode: false,
      kobeEverywhere: true,
      endIntervalLongBeep: true,
      countdownLast5Beeps: true,
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
    });

    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByLabelText('Timer name');
    expect(screen.queryByText('Workout Types (Optional)')).toBeNull();
  });
});
