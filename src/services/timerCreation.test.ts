import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewTimer } from './timerCreation';
import type { Timer } from '../types';

const { listMock, newTimerMock, trackAnalyticsEventMock, upsertMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  newTimerMock: vi.fn(),
  trackAnalyticsEventMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('../lib/timerFactory', () => ({
  newTimer: newTimerMock,
}));

vi.mock('./analytics', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock('./storage', () => ({
  TimerRepository: {
    list: listMock,
    upsert: upsertMock,
  },
}));

const timer: Timer = {
  id: 'timer-1',
  name: 'Pain Party',
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
  category: 'GENERAL',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('createNewTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    newTimerMock.mockReturnValue(timer);
    upsertMock.mockResolvedValue(undefined);
  });

  it('coalesces concurrent creation calls into one stored timer', async () => {
    const [first, second] = await Promise.all([createNewTimer(), createNewTimer()]);

    expect(first).toBe(timer);
    expect(second).toBe(timer);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(newTimerMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(trackAnalyticsEventMock).toHaveBeenCalledTimes(1);
  });
});
