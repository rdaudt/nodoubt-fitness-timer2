import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerListPage } from './TimerListPage';
import type { Timer } from '../types';

const { createNewTimerMock, listMock, settingsMock } = vi.hoisted(() => ({
  createNewTimerMock: vi.fn(),
  listMock: vi.fn(),
  settingsMock: {
    kobeEverywhere: true,
    imagesInAllTimers: true,
    bwTimerImages: true,
    endIntervalLongBeep: true,
    countdownLast5Beeps: true,
    intervalColors: {
      warmup: '#ff8c00',
      work: '#ff4444',
      rest: '#2ecc71',
      cooldown: '#3b82f6',
    },
  },
}));

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: settingsMock,
    saveSettings: vi.fn(),
  }),
}));

vi.mock('../services/authContext', () => ({
  useCoachMode: () => true,
}));

vi.mock('../services/timerCreation', () => ({
  createNewTimer: createNewTimerMock,
}));

vi.mock('../services/storage', () => ({
  TimerRepository: {
    list: listMock,
    remove: vi.fn(),
    upsert: vi.fn(),
  },
}));

const baseTimer: Omit<Timer, 'id' | 'name' | 'category'> = {
  stationCount: 2,
  roundsPerStation: 3,
  workMinutes: 0,
  workSeconds: 30,
  restMinutes: 0,
  restSeconds: 15,
  stationTransitionMinutes: 0,
  stationTransitionSeconds: 20,
  startStationWorkManually: false,
  warmupEnabled: true,
  warmupMinutes: 1,
  warmupSeconds: 0,
  cooldownEnabled: true,
  cooldownMinutes: 0,
  cooldownSeconds: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const buildTimer = (id: string, name: string, category: Timer['category']): Timer => ({
  ...baseTimer,
  id,
  name,
  category,
});

const getImageUrls = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.timer-card-feature-image'))
    .map((node) => (node as HTMLElement).style.backgroundImage)
    .map((image) => image.match(/url\("?(.*?)"?\)/)?.[1] ?? '');

describe('TimerListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.imagesInAllTimers = true;
    settingsMock.bwTimerImages = true;
    createNewTimerMock.mockResolvedValue(buildTimer('timer-new', 'New Timer', 'GENERAL'));
  });

  afterEach(() => {
    cleanup();
  });

  it('assigns an image to all visible timer cards', async () => {
    listMock.mockResolvedValue([
      buildTimer('timer-1', 'Timer 1', 'GENERAL'),
      buildTimer('timer-2', 'Timer 2', 'FAT-LOSS'),
      buildTimer('timer-3', 'Timer 3', 'PERFORMANCE'),
    ]);

    const { container } = render(
      <MemoryRouter>
        <TimerListPage />
      </MemoryRouter>,
    );

    await screen.findByText('Timer 1');
    await waitFor(() => expect(getImageUrls(container)).toHaveLength(3));
    const imageUrls = getImageUrls(container);
    expect(imageUrls).toHaveLength(3);
    expect(imageUrls.every(Boolean)).toBe(true);
  });

  it('assigns an image only to the first visible timer card when images in all timers is off', async () => {
    settingsMock.imagesInAllTimers = false;
    listMock.mockResolvedValue([
      buildTimer('timer-1', 'Timer 1', 'GENERAL'),
      buildTimer('timer-2', 'Timer 2', 'FAT-LOSS'),
      buildTimer('timer-3', 'Timer 3', 'PERFORMANCE'),
    ]);

    const { container } = render(
      <MemoryRouter>
        <TimerListPage />
      </MemoryRouter>,
    );

    await screen.findByText('Timer 1');
    await waitFor(() => expect(getImageUrls(container)).toHaveLength(1));
  });

  it('does not repeat images when visible card count is within image pool size', async () => {
    listMock.mockResolvedValue([
      buildTimer('timer-1', 'Timer 1', 'GENERAL'),
      buildTimer('timer-2', 'Timer 2', 'FAT-LOSS'),
      buildTimer('timer-3', 'Timer 3', 'PERFORMANCE'),
      buildTimer('timer-4', 'Timer 4', 'GENERAL'),
    ]);

    const { container } = render(
      <MemoryRouter>
        <TimerListPage />
      </MemoryRouter>,
    );

    await screen.findByText('Timer 1');
    await waitFor(() => expect(getImageUrls(container)).toHaveLength(4));
    const imageUrls = getImageUrls(container);
    expect(imageUrls).toHaveLength(4);
    expect(new Set(imageUrls).size).toBe(4);
  });

  it('creates only one timer when the new timer action is tapped repeatedly', async () => {
    listMock.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TimerListPage />} />
          <Route path="/timer/:id" element={<p>Timer detail</p>} />
        </Routes>
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: '+ New Timer' });
    fireEvent.click(button);
    fireEvent.click(button);

    await screen.findByText('Timer detail');
    expect(createNewTimerMock).toHaveBeenCalledTimes(1);
  });

});
