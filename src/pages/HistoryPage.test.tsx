import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './HistoryPage';

const { listAllRunsMock, listTimersMock, updateRunMock, settingsMock, coachModeMock } = vi.hoisted(() => ({
  listAllRunsMock: vi.fn(),
  listTimersMock: vi.fn(),
  updateRunMock: vi.fn(),
  settingsMock: vi.fn(),
  coachModeMock: vi.fn(),
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

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: settingsMock(),
    loaded: true,
    saveSettings: vi.fn(),
  }),
}));

vi.mock('../services/authContext', () => ({
  useCoachMode: () => coachModeMock(),
}));

const timer = {
  id: 'timer-1',
  name: 'Demo Timer',
  stationCount: 1,
  stationWorkoutTypes: ['Burpees'],
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

const completeRun = {
  id: 'run-1',
  timerId: 'timer-1',
  timerNameAtRun: 'Demo Timer',
  timerSnapshot: timer,
  stationWorkoutTypes: ['Burpees'],
  totalPerStationMs: 30000,
  totalWorkMs: 30000,
  complete: true,
  ranAt: '2026-02-01T10:00:00.000Z',
  location: '',
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-01T10:00:00.000Z',
};

describe('HistoryPage', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let promptSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('kobetheabby');
    fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      jobId: 'job-1',
      token: 'token-1',
      status: 'queued',
    }), { status: 200 }));
    settingsMock.mockReturnValue({
      kobeEverywhere: true,
      imagesInAllTimers: false,
      bwTimerImages: true,
      endIntervalLongBeep: true,
      countdownLast5Beeps: true,
      intervalColors: {
        warmup: '#FF8C00',
        work: '#FF4444',
        rest: '#2ECC71',
        cooldown: '#3B82F6',
      },
    });
    listTimersMock.mockResolvedValue([timer]);
    coachModeMock.mockReturnValue(true);
    listAllRunsMock.mockResolvedValue([{
      id: 'run-1',
      timerId: 'timer-1',
      timerNameAtRun: 'Demo Timer',
      timerSnapshot: timer,
      stationWorkoutTypes: ['Burpees'],
      totalPerStationMs: 30000,
      totalWorkMs: 30000,
      complete: false,
      ranAt: '2026-02-01T10:00:00.000Z',
      location: '',
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    }]);
    updateRunMock.mockResolvedValue(undefined);
  });

  it('renders compact run history card and updates location', async () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Demo Timer' })).toHaveAttribute('href', '/timer/timer-1');
    expect(screen.getByText('Incomplete')).toBeInTheDocument();
    expect(screen.getByText('Total Time')).toBeInTheDocument();
    expect(screen.getByText('Work/Rest')).toBeInTheDocument();
    expect(screen.getByText('Rounds')).toBeInTheDocument();
    expect(screen.getByText('Stations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByLabelText('Run location');
    fireEvent.change(input, { target: { value: 'Downtown Box' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Session' }));
    await waitFor(() => expect(updateRunMock).toHaveBeenCalledTimes(1));
    expect(updateRunMock.mock.calls[0][0]).toEqual(expect.objectContaining({ location: 'Downtown Box' }));
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    promptSpy.mockRestore();
    fetchSpy.mockRestore();
    cleanup();
  });

  it('edits run station workout types without mutating timer', async () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const stationInput = screen.getByLabelText('Run station 1 workout type');
    fireEvent.change(stationInput, { target: { value: 'Pullups' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Session' }));

    await waitFor(() => expect(updateRunMock).toHaveBeenCalledTimes(1));
    expect(updateRunMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      stationWorkoutTypes: ['Pullups'],
      timerSnapshot: expect.objectContaining({
        stationWorkoutTypes: ['Burpees'],
      }),
    }));
  });

  it('allows editing timer name in run history', async () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const runTimerNameInput = screen.getByLabelText('Run timer name');
    fireEvent.change(runTimerNameInput, { target: { value: 'Saturday Burner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Session' }));

    await waitFor(() => expect(updateRunMock).toHaveBeenCalledTimes(1));
    expect(updateRunMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      timerNameAtRun: 'Saturday Burner',
    }));
    expect(await screen.findByRole('link', { name: 'Saturday Burner' })).toBeInTheDocument();
  });

  it('cancels inline edit without saving', async () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateRunMock).not.toHaveBeenCalled();
  });

  it('exports a run entry as JSON', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Data Export' }));

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const exportedBlob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const exportedJson = JSON.parse(await exportedBlob.text());
    expect(exportedJson.stationSetWorkoutTypes).toEqual([
      {
        stationSetNumber: 1,
        workoutType: 'Burpees',
      },
    ]);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('hides share button when coach mode is off', async () => {
    settingsMock.mockReturnValue({
      kobeEverywhere: true,
      imagesInAllTimers: false,
      bwTimerImages: true,
      endIntervalLongBeep: true,
      countdownLast5Beeps: true,
      intervalColors: {
        warmup: '#FF8C00',
        work: '#FF4444',
        rest: '#2ECC71',
        cooldown: '#3B82F6',
      },
    });
    coachModeMock.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'Demo Timer' });
    expect(screen.queryByRole('button', { name: 'Create Content' })).toBeNull();
  });

  it('hides create content button even when coach mode is on', async () => {
    listAllRunsMock.mockResolvedValue([completeRun]);
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'Demo Timer' });
    expect(screen.queryByRole('button', { name: 'Create Content' })).toBeNull();
  });
});
