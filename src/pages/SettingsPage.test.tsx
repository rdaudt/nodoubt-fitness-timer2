import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const saveSettings = vi.fn();

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    loaded: true,
    saveSettings,
    settings: {
      intervalColors: {
        warmup: '#ff8c00',
        work: '#ff4444',
        rest: '#2ecc71',
        cooldown: '#3b82f6',
      },
      pauseBetweenSets: true,
    },
  }),
}));

describe('SettingsPage', () => {
  it('disables save when duplicate colors are selected', () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText('Warmup Color'), { target: { value: '#111111' } });
    fireEvent.change(screen.getByLabelText('Work Color'), { target: { value: '#111111' } });

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('renders pause between sets toggle as enabled by default', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText(/pause between sets/i)).toBeChecked();
  });
});
