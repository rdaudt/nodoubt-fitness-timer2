import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerListPage } from './TimerListPage';
import type { Timer } from '../types';

const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
}));

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: {
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
    },
    saveSettings: vi.fn(),
  }),
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

  it('reassigns images when workout category filter changes', async () => {
    listMock.mockResolvedValue([
      buildTimer('timer-1', 'General Timer A', 'GENERAL'),
      buildTimer('timer-2', 'General Timer B', 'GENERAL'),
      buildTimer('timer-3', 'Fat Loss Timer', 'FAT-LOSS'),
    ]);

    const randomValues = [
      0, 0, 0, 0, 0, 0, 0,
      0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999,
    ];
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => randomValues.shift() ?? 0.5);

    const { container } = render(
      <MemoryRouter>
        <TimerListPage />
      </MemoryRouter>,
    );

    await screen.findByText('General Timer A');
    const initialGeneralImage = getImageUrls(container)[0];

    fireEvent.change(screen.getByLabelText('Workout category filter'), {
      target: { value: 'GENERAL' },
    });

    await waitFor(() => {
      const filteredImage = getImageUrls(container)[0];
      expect(filteredImage).toBeTruthy();
      expect(filteredImage).not.toBe(initialGeneralImage);
    });

    randomSpy.mockRestore();
  });
});
