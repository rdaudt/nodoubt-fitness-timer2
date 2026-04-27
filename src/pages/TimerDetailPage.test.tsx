import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TimerDetailPage } from './TimerDetailPage';

const { getMock, upsertMock, removeMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  upsertMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: {
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
    upsert: upsertMock,
    remove: removeMock,
  },
}));

describe('TimerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({
      id: 'timer-1',
      name: 'Demo Timer',
      sets: 1,
      repeatSetsUntilStopped: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      intervals: [
        { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
        { sequence: 2, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 15 },
      ],
    });
  });

  it('shows quick-add color labels from settings', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const warmupButton = await screen.findByRole('button', { name: '+ WARMUP' });
    expect(warmupButton).toHaveStyle({ color: '#ff8c00' });
  });

  it('persists inline quick edit on blur', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const nameInput = await screen.findByDisplayValue('Work');
    fireEvent.change(nameInput, { target: { value: 'Sprint' } });
    fireEvent.blur(nameInput);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock.mock.calls[0][0].intervals[0].name).toBe('Sprint');
  });

  afterEach(() => {
    cleanup();
  });

  it('disables sets and persists repeat mode when enabled', async () => {
    render(
      <MemoryRouter initialEntries={['/timer/timer-1']}>
        <Routes>
          <Route path="/timer/:id" element={<TimerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const repeatToggle = await screen.findByLabelText('Repeat sets until manually stopped');
    fireEvent.click(repeatToggle);

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Number of sets')).toBeDisabled();
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      repeatSetsUntilStopped: true,
      sets: 1,
    });
  });
});
