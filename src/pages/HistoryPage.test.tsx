import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './HistoryPage';

const { listClassesMock, listLocationsMock, updateClassMock, removeClassMock, listTimersMock, settingsMock, coachModeMock } = vi.hoisted(() => ({
  listClassesMock: vi.fn(),
  listLocationsMock: vi.fn(),
  updateClassMock: vi.fn(),
  removeClassMock: vi.fn(),
  listTimersMock: vi.fn(),
  settingsMock: vi.fn(),
  coachModeMock: vi.fn(),
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    list: listTimersMock,
  },
}));

vi.mock('../services/hiitClassApi', () => ({
  HiitClassApi: {
    list: listClassesMock,
    listLocations: listLocationsMock,
    update: updateClassMock,
    remove: removeClassMock,
  },
  sortHiitClasses: (classes: typeof completeRun[]) => [...classes].sort((a, b) => {
    const key = (item: typeof completeRun) => (item.classDate ? `${item.classDate}T${item.startTime ?? '00:00'}` : item.ranAt);
    return key(b).localeCompare(key(a));
  }),
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

vi.mock('../services/tenantContext', () => ({
  useTenant: () => ({
    slug: 'coach-slug',
    toTenantPath: (path: string) => path,
    profile: { logoUrl: '/logo.png' },
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
  classDate: null,
  startTime: null,
  endTime: null,
  locationId: null,
  locationLabelAtRun: null,
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
    listLocationsMock.mockResolvedValue([
      { id: 'loc-1', label: 'No Doubt - Downtown', isDefault: true, sortOrder: 1 },
    ]);
    listClassesMock.mockResolvedValue([{
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
      classDate: null,
      startTime: null,
      endTime: null,
      locationId: null,
      locationLabelAtRun: null,
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    }]);
    updateClassMock.mockResolvedValue({
      ...completeRun,
      classDate: '2026-03-01',
      startTime: '09:00',
      endTime: '10:00',
      locationId: 'loc-1',
      locationLabelAtRun: 'No Doubt - Downtown',
      location: 'No Doubt - Downtown',
    });
  });

  it('renders compact HIIT Class card and updates nullable class fields', async () => {
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
    fireEvent.change(screen.getByLabelText('Class date'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Class start time'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Class end time'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('Class location'), { target: { value: 'loc-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Class' }));
    await waitFor(() => expect(updateClassMock).toHaveBeenCalledTimes(1));
    expect(updateClassMock).toHaveBeenCalledWith('coach-slug', 'run-1', {
      classDate: '2026-03-01',
      startTime: '09:00',
      endTime: '10:00',
      locationId: 'loc-1',
    });
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
    expect(updateClassMock).not.toHaveBeenCalled();
  });

  it('defaults edit location to the coach default location when class location is null', async () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('link', { name: 'Demo Timer' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Class location')).toHaveValue('loc-1');
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    promptSpy.mockRestore();
    fetchSpy.mockRestore();
    cleanup();
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

    await screen.findByText('No HIIT Classes logged yet.');
    expect(listClassesMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Create Content' })).toBeNull();
  });

  it('hides create content button even when coach mode is on', async () => {
    listClassesMock.mockResolvedValue([completeRun]);
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

  it('renders a small location logo under location details', async () => {
    listClassesMock.mockResolvedValue([{
      ...completeRun,
      locationId: 'loc-1',
      locationLabelAtRun: 'No Doubt - Downtown',
    }]);
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Location: No Doubt - Downtown');
    expect(screen.getByAltText('Location logo')).toBeInTheDocument();
  });
});
