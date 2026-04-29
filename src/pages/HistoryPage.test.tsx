import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './HistoryPage';

const { listAllRunsMock, listTimersMock, updateRunMock, settingsMock } = vi.hoisted(() => ({
  listAllRunsMock: vi.fn(),
  listTimersMock: vi.fn(),
  updateRunMock: vi.fn(),
  settingsMock: vi.fn(),
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
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('kobetheabby');
    fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      imageBase64: btoa('image-bytes'),
    }), { status: 200 }));
    settingsMock.mockReturnValue({
      coachMode: true,
      kobeEverywhere: true,
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

  it('renders run history and updates location', async () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'HIIT Session Name: Demo Timer' })).toHaveAttribute('href', '/timer/timer-1');
    expect(screen.getByText('Complete: OFF')).toBeInTheDocument();
    expect(screen.getByText('Number of stations/sets: 1')).toBeInTheDocument();
    expect(screen.getByText('Number of rounds per station/set: 1')).toBeInTheDocument();
    expect(screen.getByText('Work interval time: 00:30')).toBeInTheDocument();
    expect(screen.getByText('Rest interval time: 00:00')).toBeInTheDocument();
    expect(screen.getByText('Station/set transition time: 00:30')).toBeInTheDocument();
    expect(screen.getByText('Name of the workout type in each station/set: Burpees')).toBeInTheDocument();
    expect(screen.getByText('Total time per station/set: 00:30')).toBeInTheDocument();
    expect(screen.getByText('Total work time: 00:30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByLabelText('Run location');
    fireEvent.change(input, { target: { value: 'Downtown Box' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
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

    await screen.findByRole('link', { name: 'HIIT Session Name: Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const stationInput = screen.getByLabelText('Run station 1 workout type');
    fireEvent.change(stationInput, { target: { value: 'Pullups' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateRunMock).toHaveBeenCalledTimes(1));
    expect(updateRunMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      stationWorkoutTypes: ['Pullups'],
      timerSnapshot: expect.objectContaining({
        stationWorkoutTypes: ['Burpees'],
      }),
    }));
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

    await screen.findByRole('link', { name: 'HIIT Session Name: Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

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

  it('hides IG generation button when coach mode is off', async () => {
    settingsMock.mockReturnValue({
      coachMode: false,
      kobeEverywhere: true,
      endIntervalLongBeep: true,
      countdownLast5Beeps: true,
      intervalColors: {
        warmup: '#FF8C00',
        work: '#FF4444',
        rest: '#2ECC71',
        cooldown: '#3B82F6',
      },
    });

    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'HIIT Session Name: Demo Timer' });
    expect(screen.queryByRole('button', { name: 'Generate IG Image' })).toBeNull();
  });

  it('blocks IG generation for ineligible runs', async () => {
    listAllRunsMock.mockResolvedValue([{
      id: 'run-1',
      timerId: 'timer-1',
      timerNameAtRun: 'Demo Timer',
      timerSnapshot: timer,
      stationWorkoutTypes: [''],
      totalPerStationMs: 30000,
      totalWorkMs: 30000,
      complete: false,
      ranAt: '2026-02-01T10:00:00.000Z',
      location: '',
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    }]);
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const button = await screen.findByRole('button', { name: 'Generate IG Image' });
    expect(button).toBeDisabled();
    expect(screen.getByText('IG generation requires a complete run and workout type set for every station.')).toBeInTheDocument();
  });

  it('shows error when password is invalid', async () => {
    listAllRunsMock.mockResolvedValue([completeRun]);
    promptSpy.mockReturnValue('wrong-password');
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'HIIT Session Name: Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate IG Image' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('IG generation error: Invalid password.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generates image, previews it, and auto-downloads', async () => {
    listAllRunsMock.mockResolvedValue([completeRun]);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'HIIT Session Name: Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate IG Image' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/generate-ig-image');
    expect(await screen.findByAltText('Generated IG preview for Demo Timer')).toBeInTheDocument();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('shows retryable inline error on API failure', async () => {
    listAllRunsMock.mockResolvedValue([completeRun]);
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'bad gateway' }), { status: 502 }));

    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'HIIT Session Name: Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate IG Image' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('IG generation error: bad gateway');
    fireEvent.click(screen.getByRole('button', { name: 'Generate IG Image' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });
});
