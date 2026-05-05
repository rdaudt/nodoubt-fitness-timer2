import { deleteDB, openDB } from 'idb';
import { DEFAULT_SETTINGS } from '../config';
import { getStationWorkoutDurationMs, getWorkDurationMs } from '../lib/time';
import { normalizeTimerFields } from '../lib/timerRules';
import type { AppSettings, Template, Timer, TimerRun } from '../types';

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
  templates: {
    key: string;
    value: TemplateStoreRow;
  };
}

interface AppSettingsRow {
  key: 'app';
  value: AppSettings;
}

const DB_NAME_PREFIX = 'nodoubt-hiit';
const DB_VERSION = 3;
const BUILTIN_DELETE_MARKER_PREFIX = '__deleted_builtin_template__:';

interface DeletedBuiltinTemplateMarker {
  id: string;
  deletedBuiltinId: string;
  createdAt: string;
}

type TemplateStoreRow = Template | DeletedBuiltinTemplateMarker;

let currentTenantSlug = 'gabe';
const dbPromises = new Map<string, ReturnType<typeof openDB<AppDb>>>();

const getDbName = (tenantSlug: string): string => `${DB_NAME_PREFIX}:${tenantSlug}`;

const createDbPromise = (tenantSlug: string) => openDB<AppDb>(getDbName(tenantSlug), DB_VERSION, {
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

    if (!db.objectStoreNames.contains('templates')) {
      db.createObjectStore('templates', { keyPath: 'id' });
    }
  },
});

const getDbPromise = () => {
  const existing = dbPromises.get(currentTenantSlug);
  if (existing) {
    return existing;
  }
  const promise = createDbPromise(currentTenantSlug);
  dbPromises.set(currentTenantSlug, promise);
  return promise;
};

export const setStorageTenant = (tenantSlug: string) => {
  currentTenantSlug = tenantSlug.trim().toLowerCase() || 'gabe';
};

export const clearCurrentTenantLocalData = async (): Promise<void> => {
  const targetSlug = currentTenantSlug;
  const dbName = getDbName(targetSlug);
  dbPromises.delete(targetSlug);
  await deleteDB(dbName);
  window.localStorage.removeItem('active_tenant_slug');
};

const isCurrentTimer = (timer: unknown): timer is Timer => (
  Boolean(timer)
  && typeof timer === 'object'
  && typeof (timer as Timer).id === 'string'
  && typeof (timer as Timer).name === 'string'
  && typeof (timer as Timer).stationCount === 'number'
  && typeof (timer as Timer).roundsPerStation === 'number'
);

export const normalizeTimerRun = (run: TimerRun): TimerRun | null => {
  if (!run || typeof run !== 'object' || typeof run.id !== 'string' || typeof run.timerId !== 'string') {
    return null;
  }
  const snapshot = normalizeTimer(run.timerSnapshot);
  if (!snapshot) {
    return null;
  }
  const totalPerStationMs = Number.isFinite(run.totalPerStationMs)
    ? Math.max(0, Math.floor(run.totalPerStationMs))
    : getStationWorkoutDurationMs(snapshot);
  const totalWorkMs = Number.isFinite(run.totalWorkMs)
    ? Math.max(0, Math.floor(run.totalWorkMs))
    : getWorkDurationMs(snapshot) * snapshot.roundsPerStation * snapshot.stationCount;
  return {
    ...run,
    timerSnapshot: snapshot,
    stationWorkoutTypes: Array.isArray(run.stationWorkoutTypes)
      ? run.stationWorkoutTypes
        .slice(0, snapshot.stationCount)
        .map((item) => (typeof item === 'string' ? item : String(item ?? '')).trim())
      : snapshot.stationWorkoutTypes ?? [],
    totalPerStationMs,
    totalWorkMs,
    category: 'GENERAL',
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

const isTemplateRow = (row: unknown): row is Template => (
  Boolean(row)
  && typeof row === 'object'
  && typeof (row as Template).id === 'string'
  && typeof (row as Template).name === 'string'
  && typeof (row as Template).source === 'string'
  && typeof (row as Template).stationCount === 'number'
);

export const normalizeTemplate = (template: Template): Template | null => {
  if (!isTemplateRow(template)) {
    return null;
  }
  const normalizedTimer = normalizeTimerFields({
    ...template,
    id: template.id,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  });
  return {
    ...normalizedTimer,
    source: template.source === 'builtin' ? 'builtin' : 'user',
    builtinTemplateId: typeof template.builtinTemplateId === 'string' ? template.builtinTemplateId : undefined,
  };
};

const isDeletedBuiltinMarker = (row: TemplateStoreRow): row is DeletedBuiltinTemplateMarker =>
  Boolean((row as DeletedBuiltinTemplateMarker).deletedBuiltinId);

export const TimerRepository = {
  async list(): Promise<Timer[]> {
    const db = await getDbPromise();
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
    const db = await getDbPromise();
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
    const db = await getDbPromise();
    await db.put('timers', normalizeTimerFields(timer));
  },
  async upsertMany(timers: Timer[]): Promise<void> {
    const db = await getDbPromise();
    const tx = db.transaction('timers', 'readwrite');
    for (const timer of timers) {
      await tx.store.put(normalizeTimerFields(timer));
    }
    await tx.done;
  },
  async remove(id: string): Promise<void> {
    const db = await getDbPromise();
    await db.delete('timers', id);
  },
  async clearAll(): Promise<void> {
    const db = await getDbPromise();
    await db.clear('timers');
  },
  async replaceAll(timers: Timer[]): Promise<void> {
    const db = await getDbPromise();
    const tx = db.transaction('timers', 'readwrite');
    await tx.store.clear();
    for (const timer of timers) {
      await tx.store.put(normalizeTimerFields(timer));
    }
    await tx.done;
  },
};

export const TemplateRepository = {
  async list(): Promise<Template[]> {
    const db = await getDbPromise();
    const rows = await db.getAll('templates');
    const valid: Template[] = [];

    await Promise.all(rows.map(async (row) => {
      if (isDeletedBuiltinMarker(row)) {
        return;
      }
      const normalized = normalizeTemplate(row);
      if (!normalized) {
        await db.delete('templates', row.id);
        return;
      }
      valid.push(normalized);
    }));

    return valid.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  },
  async get(id: string): Promise<Template | undefined> {
    const db = await getDbPromise();
    const row = await db.get('templates', id);
    if (!row || isDeletedBuiltinMarker(row)) {
      return undefined;
    }
    const normalized = normalizeTemplate(row);
    if (!normalized) {
      await db.delete('templates', id);
      return undefined;
    }
    return normalized;
  },
  async upsert(template: Template): Promise<void> {
    const db = await getDbPromise();
    const normalized = normalizeTemplate(template);
    if (!normalized) {
      return;
    }
    await db.put('templates', normalized);
  },
  async remove(id: string): Promise<void> {
    const db = await getDbPromise();
    await db.delete('templates', id);
  },
  async replaceAll(templates: Template[]): Promise<void> {
    const db = await getDbPromise();
    const tx = db.transaction('templates', 'readwrite');
    await tx.store.clear();
    for (const template of templates) {
      const normalized = normalizeTemplate(template);
      if (normalized) {
        await tx.store.put(normalized);
      }
    }
    await tx.done;
  },
  async listDeletedBuiltinIds(): Promise<string[]> {
    const db = await getDbPromise();
    const rows = await db.getAll('templates');
    return rows
      .filter((row): row is DeletedBuiltinTemplateMarker => isDeletedBuiltinMarker(row))
      .map((row) => row.deletedBuiltinId);
  },
  async markBuiltinDeleted(builtinTemplateId: string): Promise<void> {
    const db = await getDbPromise();
    const now = new Date().toISOString();
    await db.put('templates', {
      id: `${BUILTIN_DELETE_MARKER_PREFIX}${builtinTemplateId}`,
      deletedBuiltinId: builtinTemplateId,
      createdAt: now,
    });
  },
  async clearBuiltinDeletedMark(builtinTemplateId: string): Promise<void> {
    const db = await getDbPromise();
    await db.delete('templates', `${BUILTIN_DELETE_MARKER_PREFIX}${builtinTemplateId}`);
  },
};

export const SettingsRepository = {
  async get(): Promise<AppSettings> {
    const db = await getDbPromise();
    const row = await db.get('settings', 'app');
    if (!row?.value) {
      return DEFAULT_SETTINGS;
    }
    return {
      ...DEFAULT_SETTINGS,
      ...row.value,
      coachMode: row.value.coachMode ?? DEFAULT_SETTINGS.coachMode,
      kobeEverywhere: row.value.kobeEverywhere ?? DEFAULT_SETTINGS.kobeEverywhere,
      imagesInAllTimers: row.value.imagesInAllTimers ?? DEFAULT_SETTINGS.imagesInAllTimers,
      bwTimerImages: row.value.bwTimerImages ?? DEFAULT_SETTINGS.bwTimerImages,
      endIntervalLongBeep: row.value.endIntervalLongBeep ?? DEFAULT_SETTINGS.endIntervalLongBeep,
      countdownLast5Beeps: row.value.countdownLast5Beeps ?? DEFAULT_SETTINGS.countdownLast5Beeps,
      intervalColors: {
        ...DEFAULT_SETTINGS.intervalColors,
        ...row.value.intervalColors,
      },
    };
  },
  async save(settings: AppSettings): Promise<void> {
    const db = await getDbPromise();
    await db.put('settings', { key: 'app', value: settings });
  },
};

export const TimerRunRepository = {
  async listAll(): Promise<TimerRun[]> {
    const db = await getDbPromise();
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
    const db = await getDbPromise();
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
    const db = await getDbPromise();
    const normalized = normalizeTimerRun(run);
    if (!normalized) {
      return;
    }
    await db.put('timerRuns', normalized);
  },
  async update(run: TimerRun): Promise<void> {
    const db = await getDbPromise();
    const normalized = normalizeTimerRun(run);
    if (!normalized) {
      return;
    }
    await db.put('timerRuns', normalized);
  },
  async remove(id: string): Promise<void> {
    const db = await getDbPromise();
    await db.delete('timerRuns', id);
  },
};
