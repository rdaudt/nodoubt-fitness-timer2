import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  TIMER_EXPORT_FORMAT,
  TIMER_EXPORT_VERSION,
  buildTimerExportFilename,
  exportTimersToDevice,
  importTimersFromFile,
} from './timerTransfer';

const {
  listMock,
  replaceAllMock,
  normalizeTimerMock,
  timerRunsListMock,
  settingsGetMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  replaceAllMock: vi.fn(),
  normalizeTimerMock: vi.fn(),
  timerRunsListMock: vi.fn(),
  settingsGetMock: vi.fn(),
}));

vi.mock('./storage', () => ({
  TimerRepository: {
    list: listMock,
    replaceAll: replaceAllMock,
  },
  TimerRunRepository: {
    listAll: timerRunsListMock,
  },
  SettingsRepository: {
    get: settingsGetMock,
  },
  normalizeTimer: normalizeTimerMock,
}));

const timer = {
  id: 'timer-1',
  name: 'Demo',
  stationCount: 3,
  roundsPerStation: 2,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 10,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 20,
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

describe('timerTransfer', () => {
  let createdAnchor: HTMLAnchorElement;
  const createElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([timer]);
    replaceAllMock.mockResolvedValue(undefined);
    normalizeTimerMock.mockImplementation((next) => next);
    createdAnchor = document.createElement('a');
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string): HTMLElement => {
      if (tagName === 'a') {
        return createdAnchor;
      }
      return createElement(tagName);
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:timers');
    URL.revokeObjectURL = vi.fn();
  });

  it('builds filename with local date and time', () => {
    const date = new Date(2026, 3, 28, 7, 9, 11);
    expect(buildTimerExportFilename(date)).toBe('nodoubt-timers-2026-04-28-07-09.json');
  });

  it('exports timers with strict payload shape/version and timestamped filename', async () => {
    await exportTimersToDevice();
    expect(listMock).toHaveBeenCalledTimes(1);

    const createObjectUrlMock = URL.createObjectURL as unknown as ReturnType<typeof vi.fn>;
    const blob = createObjectUrlMock.mock.calls[0][0] as Blob;
    const payload = JSON.parse(await blob.text());
    expect(payload).toEqual(expect.objectContaining({
      format: TIMER_EXPORT_FORMAT,
      version: TIMER_EXPORT_VERSION,
      exportedAt: expect.any(String),
      timers: [timer],
    }));

    expect(createdAnchor.download).toMatch(/^nodoubt-timers-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:timers');
  });

  it('rejects malformed JSON', async () => {
    const file = new File(['{"bad json"'], 'timers.json', { type: 'application/json' });
    await expect(importTimersFromFile(file)).rejects.toThrow('Invalid JSON file.');
    expect(replaceAllMock).not.toHaveBeenCalled();
  });

  it('rejects wrong format/version', async () => {
    const file = new File([JSON.stringify({
      format: 'wrong',
      version: '9',
      exportedAt: '2026-04-28T00:00:00.000Z',
      timers: [timer],
    })], 'timers.json', { type: 'application/json' });

    await expect(importTimersFromFile(file)).rejects.toThrow('Invalid export file format.');
    expect(replaceAllMock).not.toHaveBeenCalled();
  });

  it('rejects whole import when any timer is invalid', async () => {
    normalizeTimerMock
      .mockImplementationOnce((next) => next)
      .mockImplementationOnce(() => null);

    const file = new File([JSON.stringify({
      format: TIMER_EXPORT_FORMAT,
      version: TIMER_EXPORT_VERSION,
      exportedAt: '2026-04-28T00:00:00.000Z',
      timers: [timer, { ...timer, id: 'invalid' }],
    })], 'timers.json', { type: 'application/json' });

    await expect(importTimersFromFile(file)).rejects.toThrow('Import file contains one or more invalid timers.');
    expect(replaceAllMock).not.toHaveBeenCalled();
  });

  it('replaces all timers on successful import and does not touch runs/settings', async () => {
    const file = new File([JSON.stringify({
      format: TIMER_EXPORT_FORMAT,
      version: TIMER_EXPORT_VERSION,
      exportedAt: '2026-04-28T00:00:00.000Z',
      timers: [timer],
    })], 'timers.json', { type: 'application/json' });

    const count = await importTimersFromFile(file);
    expect(count).toBe(1);
    expect(replaceAllMock).toHaveBeenCalledWith([timer]);
    expect(timerRunsListMock).not.toHaveBeenCalled();
    expect(settingsGetMock).not.toHaveBeenCalled();
  });
});
