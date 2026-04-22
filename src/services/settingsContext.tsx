import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS } from '../config';
import type { AppSettings } from '../types';
import { SettingsRepository } from './storage';

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  saveSettings: (next: AppSettings) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SettingsRepository.get().then((result) => {
      setSettings(result);
      setLoaded(true);
    });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loaded,
      saveSettings: async (next: AppSettings) => {
        await SettingsRepository.save(next);
        setSettings(next);
      },
    }),
    [loaded, settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
};
