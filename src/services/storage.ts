import { openDB } from 'idb';
import { DEFAULT_SETTINGS } from '../config';
import { normalizeTimerFields } from '../lib/timerRules';
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

const isCurrentTimer = (timer: unknown): timer is Timer => (
  Boolean(timer)
  && typeof timer === 'object'
  && typeof (timer as Timer).id === 'string'
  && typeof (timer as Timer).name === 'string'
  && typeof (timer as Timer).stationCount === 'number'
  && typeof (timer as Timer).roundsPerStation === 'number'
);

export const normalizeTimer = (timer: Timer): Timer | null => {
  if (!isCurrentTimer(timer)) {
    return null;
  }
  return normalizeTimerFields(timer);
};

export const TimerRepository = {
  async list(): Promise<Timer[]> {
    const db = await dbPromise;
    const timers = await db.getAll('timers');
    const valid: Timer[] = [];

    await Promise.all(timers.map(async (timer) => {
      const normalized = normalizeTimer(timer);
      if (!normalized) {
        await db.delete('timers', timer.id);
        return;
      }
      valid.push(normalized);
    }));

    return valid.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  },
  async get(id: string): Promise<Timer | undefined> {
    const db = await dbPromise;
    const timer = await db.get('timers', id);
    if (!timer) {
      return undefined;
    }
    const normalized = normalizeTimer(timer);
    if (!normalized) {
      await db.delete('timers', id);
      return undefined;
    }
    return normalized;
  },
  async upsert(timer: Timer): Promise<void> {
    const db = await dbPromise;
    await db.put('timers', normalizeTimerFields(timer));
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
      coachMode: row.value.coachMode ?? DEFAULT_SETTINGS.coachMode,
      kobeEverywhere: row.value.kobeEverywhere ?? DEFAULT_SETTINGS.kobeEverywhere,
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
