import { openDB } from 'idb';
import { DEFAULT_SETTINGS } from '../config';
import { normalizeTimerFields } from '../lib/timerRules';
import type { AppSettings, Timer, TimerRun } from '../types';

interface AppDb {
  timers: {
    key: string;
    value: Timer;
  };
  settings: {
    key: string;
    value: AppSettingsRow;
  };
  timerRuns: {
    key: string;
    value: TimerRun;
    indexes: {
      'by-timer-id': string;
      'by-ran-at': string;
    };
  };
}

interface AppSettingsRow {
  key: 'app';
  value: AppSettings;
}

const DB_NAME = 'nodoubt-hiit';
const DB_VERSION = 2;

const dbPromise = openDB<AppDb>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('timers')) {
      db.createObjectStore('timers', { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }

    if (!db.objectStoreNames.contains('timerRuns')) {
      const timerRunsStore = db.createObjectStore('timerRuns', { keyPath: 'id' });
      timerRunsStore.createIndex('by-timer-id', 'timerId');
      timerRunsStore.createIndex('by-ran-at', 'ranAt');
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

const normalizeTimerRun = (run: TimerRun): TimerRun | null => {
  if (!run || typeof run !== 'object' || typeof run.id !== 'string' || typeof run.timerId !== 'string') {
    return null;
  }
  const snapshot = normalizeTimer(run.timerSnapshot);
  if (!snapshot) {
    return null;
  }
  return {
    ...run,
    timerSnapshot: snapshot,
    complete: run.complete ?? true,
    location: run.location ?? '',
  };
};

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
      endIntervalLongBeep: row.value.endIntervalLongBeep ?? DEFAULT_SETTINGS.endIntervalLongBeep,
      countdownLast5Beeps: row.value.countdownLast5Beeps ?? DEFAULT_SETTINGS.countdownLast5Beeps,
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

export const TimerRunRepository = {
  async listAll(): Promise<TimerRun[]> {
    const db = await dbPromise;
    const runs = await db.getAll('timerRuns');
    const valid: TimerRun[] = [];
    await Promise.all(runs.map(async (run) => {
      const normalized = normalizeTimerRun(run);
      if (!normalized) {
        await db.delete('timerRuns', run.id);
        return;
      }
      valid.push(normalized);
    }));
    return valid.sort((a, b) => +new Date(b.ranAt) - +new Date(a.ranAt));
  },
  async listByTimer(timerId: string): Promise<TimerRun[]> {
    const db = await dbPromise;
    const runs = await db.getAllFromIndex('timerRuns', 'by-timer-id', timerId);
    const valid: TimerRun[] = [];
    await Promise.all(runs.map(async (run) => {
      const normalized = normalizeTimerRun(run);
      if (!normalized) {
        await db.delete('timerRuns', run.id);
        return;
      }
      valid.push(normalized);
    }));
    return valid.sort((a, b) => +new Date(b.ranAt) - +new Date(a.ranAt));
  },
  async create(run: TimerRun): Promise<void> {
    const db = await dbPromise;
    const normalized = normalizeTimerRun(run);
    if (!normalized) {
      return;
    }
    await db.put('timerRuns', normalized);
  },
  async update(run: TimerRun): Promise<void> {
    const db = await dbPromise;
    const normalized = normalizeTimerRun(run);
    if (!normalized) {
      return;
    }
    await db.put('timerRuns', normalized);
  },
  async remove(id: string): Promise<void> {
    const db = await dbPromise;
    await db.delete('timerRuns', id);
  },
};
