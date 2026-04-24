import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../config';
import type { Timer } from '../types';
import { TimerCard } from './TimerCard';

const demoTimer: Timer = {
  id: 'timer-1',
  name: 'Demo HIIT',
  sets: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  intervals: [
    { sequence: 1, name: 'Warmup', type: 'warmup', durationMinutes: 1, durationSeconds: 0 },
    { sequence: 2, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 45 },
    { sequence: 3, name: 'Rest', type: 'rest', durationMinutes: 0, durationSeconds: 15 },
    { sequence: 4, name: 'Cooldown', type: 'cooldown', durationMinutes: 0, durationSeconds: 30 },
  ],
};

const renderCard = (timer: Timer = demoTimer, featureImage?: string) => render(
  <MemoryRouter>
    <TimerCard timer={timer} intervalColors={DEFAULT_SETTINGS.intervalColors} featureImage={featureImage} onDelete={vi.fn()} />
  </MemoryRouter>,
);

describe('TimerCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders timer summary and separate detail/run links', () => {
    renderCard();

    expect(screen.getByText('Demo HIIT')).toBeInTheDocument();
    expect(screen.getByText('2 Sets')).toBeInTheDocument();
    expect(screen.getByText('Warmup 1m')).toBeInTheDocument();
    expect(screen.getByText('Work 1m 30s')).toBeInTheDocument();
    expect(screen.getByText('Rest 30s')).toBeInTheDocument();
    expect(screen.getByText('Cooldown 30s')).toBeInTheDocument();
    expect(screen.getByText('03:30')).toBeInTheDocument();

    expect(screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/timer/timer-1')).toBeTruthy();
    expect(screen.getByRole('link', { name: /run demo hiit/i })).toHaveAttribute('href', '/timer/timer-1/run?from=home');
  });

  it('omits missing interval type totals', () => {
    renderCard({
      ...demoTimer,
      intervals: [
        { sequence: 1, name: 'Work', type: 'work', durationMinutes: 0, durationSeconds: 30 },
      ],
    });

    expect(screen.getByText('Work 1m')).toBeInTheDocument();
    expect(screen.queryByText(/Warmup/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rest/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cooldown/)).not.toBeInTheDocument();
  });

  it('renders an optional featured image layer', () => {
    const { container } = renderCard(demoTimer, '/assets/feature.png');

    expect(container.querySelector('.timer-card-feature-image')).toHaveStyle({
      backgroundImage: 'url(/assets/feature.png)',
    });
  });
});
