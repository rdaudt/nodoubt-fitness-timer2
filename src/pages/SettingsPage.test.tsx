import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { DEFAULT_SETTINGS } from '../config';

const { saveSettingsMock, exportTimersMock, importTimersMock, logoutUserMock, deleteCurrentAccountMock, clearLocalDataMock } = vi.hoisted(() => ({
  saveSettingsMock: vi.fn(),
  exportTimersMock: vi.fn(),
  importTimersMock: vi.fn(),
  logoutUserMock: vi.fn(),
  deleteCurrentAccountMock: vi.fn(),
  clearLocalDataMock: vi.fn(),
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

vi.mock('../services/authContext', () => ({
  useAuth: () => ({
    loaded: true,
    user: { sub: 'sub-1', email: 'u@x.com', name: 'U', picture: '', isCoach: false },
    login: vi.fn(),
    logoutUser: logoutUserMock,
    deleteCurrentAccount: deleteCurrentAccountMock,
  }),
}));

vi.mock('../services/storage', () => ({
  clearCurrentTenantLocalData: clearLocalDataMock,
}));

describe('SettingsPage import/export', () => {
  const renderPage = () => render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    exportTimersMock.mockResolvedValue(undefined);
    importTimersMock.mockResolvedValue(2);
    logoutUserMock.mockResolvedValue(undefined);
    deleteCurrentAccountMock.mockResolvedValue(undefined);
    clearLocalDataMock.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'prompt').mockReturnValue('DELETE');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders import/export controls', () => {
    renderPage();
    expect(screen.getByLabelText('Images in all Timers')).toBeInTheDocument();
    expect(screen.getByLabelText('B&W Timer Images')).toBeInTheDocument();
    expect(screen.getByText('Import / Export Timers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Timers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Timers' })).toBeInTheDocument();
  });

  it('persists image toggles through saveSettings', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Images in all Timers'));
    fireEvent.click(screen.getByLabelText('B&W Timer Images'));

    expect(saveSettingsMock).toHaveBeenCalledWith(expect.objectContaining({
      imagesInAllTimers: true,
      bwTimerImages: false,
    }));
  });

  it('reset defaults restores image toggle defaults', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Images in all Timers'));
    fireEvent.click(screen.getByLabelText('B&W Timer Images'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Defaults' }));

    expect(saveSettingsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      imagesInAllTimers: false,
      bwTimerImages: true,
    }));
  });

  it('exports and shows success message', async () => {
    renderPage();
    const exportButton = screen.getAllByRole('button', { name: 'Export Timers' }).at(-1) as HTMLButtonElement;
    fireEvent.click(exportButton);
    await waitFor(() => expect(exportTimersMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Timers exported to your device.')).toBeInTheDocument();
  });

  it('requires confirmation before import and shows success', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderPage();

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
    renderPage();
    const input = screen.getAllByLabelText('Import timers file').at(-1) as HTMLInputElement;
    const file = new File(['{}'], 'timers.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(importTimersMock).toHaveBeenCalledWith(file));
    expect(await screen.findByText('Invalid export file format.')).toBeInTheDocument();
  });

  it('deletes account after typed confirmation', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    await waitFor(() => expect(deleteCurrentAccountMock).toHaveBeenCalledTimes(1));
    expect(clearLocalDataMock).toHaveBeenCalledTimes(1);
  });

});
