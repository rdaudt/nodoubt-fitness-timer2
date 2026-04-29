import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../config';
import type { Timer } from '../types';
import { TimerCard } from './TimerCard';

const demoTimer: Timer = {
  id: 'timer-1',
  name: 'Demo HIIT',
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

const renderCard = (timer: Timer = demoTimer, featureImage?: string, coachMode = true) => render(
  <MemoryRouter>
    <TimerCard
      timer={timer}
      intervalColors={DEFAULT_SETTINGS.intervalColors}
      coachMode={coachMode}
      featureImage={featureImage}
      onDelete={vi.fn()}
      onClone={vi.fn()}
    />
  </MemoryRouter>,
);

describe('TimerCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders timer summary and separate detail/run links', () => {
    renderCard();

    expect(screen.getByText('Demo HIIT')).toBeInTheDocument();
    expect(screen.getByText('Stations 2')).toBeInTheDocument();
    expect(screen.getByText('Rounds 3')).toBeInTheDocument();
    expect(screen.getByText('Work 30s')).toBeInTheDocument();
    expect(screen.getByText('Rest 15s')).toBeInTheDocument();
    expect(screen.getByText('Station transition 20s')).toBeInTheDocument();
    expect(screen.getByText('05:50')).toBeInTheDocument();

    expect(screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/timer/timer-1')).toBeTruthy();
    expect(screen.getByRole('link', { name: /run demo hiit/i })).toHaveAttribute('href', '/timer/timer-1/run?from=home');
    expect(screen.getByRole('button', { name: /clone demo hiit/i })).toBeInTheDocument();
  });

  it('uses set labels when coach mode is off', () => {
    renderCard(demoTimer, undefined, false);

    expect(screen.getByText('Sets 2')).toBeInTheDocument();
    expect(screen.getByText('Set transition 20s')).toBeInTheDocument();
  });

  it('renders an optional featured image layer', () => {
    const { container } = renderCard(demoTimer, '/assets/feature.png');

    expect(container.querySelector('.timer-card-feature-image')).toHaveStyle({
      backgroundImage: 'url(/assets/feature.png)',
    });
  });
});