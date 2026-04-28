import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { DEFAULT_SETTINGS } from '../config';

const { saveSettingsMock, exportTimersMock, importTimersMock } = vi.hoisted(() => ({
  saveSettingsMock: vi.fn(),
  exportTimersMock: vi.fn(),
  importTimersMock: vi.fn(),
}));

vi.mock('../services/settingsContext', () => ({
  useSettings: () => ({
    settings: DEFAULT_SETTINGS,
    loaded: true,
    saveSettings: saveSettingsMock,
  }),
}));

vi.mock('../services/timerTransfer', () => ({
  exportTimersToDevice: exportTimersMock,
  importTimersFromFile: importTimersMock,
}));

describe('SettingsPage import/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportTimersMock.mockResolvedValue(undefined);
    importTimersMock.mockResolvedValue(2);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders import/export controls', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Import / Export Timers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Timers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Timers' })).toBeInTheDocument();
  });

  it('exports and shows success message', async () => {
    render(<SettingsPage />);
    const exportButton = screen.getAllByRole('button', { name: 'Export Timers' }).at(-1) as HTMLButtonElement;
    fireEvent.click(exportButton);
    await waitFor(() => expect(exportTimersMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Timers exported to your device.')).toBeInTheDocument();
  });

  it('requires confirmation before import and shows success', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<SettingsPage />);

    const input = screen.getAllByLabelText('Import timers file').at(-1) as HTMLInputElement;
    const file = new File(['{}'], 'timers.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(importTimersMock).toHaveBeenCalledWith(file));
    expect(screen.getByText('Imported 2 timers.')).toBeInTheDocument();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'timers:changed' }));
  });

  it('shows error and keeps state unchanged when import fails', async () => {
    importTimersMock.mockRejectedValueOnce(new Error('Invalid export file format.'));
    render(<SettingsPage />);
    const input = screen.getAllByLabelText('Import timers file').at(-1) as HTMLInputElement;
    const file = new File(['{}'], 'timers.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(importTimersMock).toHaveBeenCalledWith(file));
    expect(screen.getByText('Invalid export file format.')).toBeInTheDocument();
  });
});
