import { openDB } from 'idb';
import { DEFAULT_SETTINGS } from '../config';
import type { AppSettings, Timer } from '../types';

interface AppDb {
  timers: {
    key: string;
    value: Timer;
  };
  settings: {
    key: string;
    value: AppSettingsRow;
  };
}

interface AppSettingsRow {
  key: 'app';
  value: AppSettings;
}

const DB_NAME = 'nodoubt-hiit';
const DB_VERSION = 1;

const dbPromise = openDB<AppDb>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('timers')) {
      db.createObjectStore('timers', { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  },
});

export const TimerRepository = {
  async list(): Promise<Timer[]> {
    const db = await dbPromise;
    const timers = await db.getAll('timers');
    return timers.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  },
  async get(id: string): Promise<Timer | undefined> {
    const db = await dbPromise;
    return db.get('timers', id);
  },
  async upsert(timer: Timer): Promise<void> {
    const db = await dbPromise;
    await db.put('timers', timer);
  },
  async remove(id: string): Promise<void> {
    const db = await dbPromise;
    await db.delete('timers', id);
  },
};

export const SettingsRepository = {
  async get(): Promise<AppSettings> {
    const db = await dbPromise;
    const row = await db.get('settings', 'app');
    if (!row?.value) {
      return DEFAULT_SETTINGS;
    }
    return {
      ...DEFAULT_SETTINGS,
      ...row.value,
      intervalColors: {
        ...DEFAULT_SETTINGS.intervalColors,
        ...row.value.intervalColors,
      },
    };
  },
  async save(settings: AppSettings): Promise<void> {
    const db = await dbPromise;
    await db.put('settings', { key: 'app', value: settings });
  },
};
