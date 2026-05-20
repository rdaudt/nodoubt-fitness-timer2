import type { HiitClass, HiitClassLocation, TimerRun } from '../types';

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asNullableString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const apiUrl = (action: 'hiit-classes' | 'class-locations', tenantSlug: string, id?: string): string => {
  const params = new URLSearchParams({
    action,
    tenantSlug,
  });
  if (id) {
    params.set('id', id);
  }
  return `/api/auth?${params.toString()}`;
};

const parseHiitClass = (value: unknown): HiitClass | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asString(row.id);
  const timerId = asString(row.timerId);
  const timerNameAtRun = asString(row.timerNameAtRun);
  if (!id || !timerId || !timerNameAtRun) {
    return null;
  }
  return {
    id,
    timerId,
    timerNameAtRun,
    timerSnapshot: row.timerSnapshot as TimerRun['timerSnapshot'],
    stationWorkoutTypes: Array.isArray(row.stationWorkoutTypes) ? row.stationWorkoutTypes.map((item) => asString(item)) : [],
    totalPerStationMs: asNumber(row.totalPerStationMs),
    totalWorkMs: asNumber(row.totalWorkMs),
    category: row.category === 'FAT-LOSS' || row.category === 'PERFORMANCE' ? row.category : 'GENERAL',
    complete: Boolean(row.complete),
    ranAt: asString(row.ranAt),
    location: asString(row.location),
    classDate: asNullableString(row.classDate),
    startTime: asNullableString(row.startTime),
    endTime: asNullableString(row.endTime),
    locationId: asNullableString(row.locationId),
    locationLabelAtRun: asNullableString(row.locationLabelAtRun),
    createdAt: asString(row.createdAt),
    updatedAt: asString(row.updatedAt),
  };
};

const parseLocation = (value: unknown): HiitClassLocation | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asString(row.id);
  const label = asString(row.label);
  if (!id || !label) {
    return null;
  }
  return {
    id,
    label,
    logoUrl: asString(row.logoUrl),
    isDefault: Boolean(row.isDefault),
    sortOrder: asNumber(row.sortOrder),
  };
};

const requestJson = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (payload as { error?: unknown }).error === 'string'
      ? (payload as { error: string }).error
      : 'HIIT Class request failed.';
    throw new Error(message);
  }
  return payload;
};

export const sortHiitClasses = (classes: HiitClass[]): HiitClass[] => [...classes].sort((a, b) => {
  const getSortKey = (item: HiitClass): string => {
    if (item.classDate) {
      return `${item.classDate}T${item.startTime ?? '00:00'}`;
    }
    return item.ranAt;
  };
  return getSortKey(b).localeCompare(getSortKey(a));
});

export const HiitClassApi = {
  async list(tenantSlug: string): Promise<HiitClass[]> {
    const payload = await requestJson(apiUrl('hiit-classes', tenantSlug));
    const raw = Array.isArray((payload as { classes?: unknown }).classes)
      ? (payload as { classes: unknown[] }).classes
      : [];
    return sortHiitClasses(raw.map((item) => parseHiitClass(item)).filter((item): item is HiitClass => Boolean(item)));
  },
  async create(tenantSlug: string, run: TimerRun): Promise<HiitClass> {
    const payload = await requestJson(apiUrl('hiit-classes', tenantSlug), {
      method: 'POST',
      body: JSON.stringify({ run }),
    });
    const hiitClass = parseHiitClass((payload as { class?: unknown }).class);
    if (!hiitClass) {
      throw new Error('Invalid HIIT Class response.');
    }
    return hiitClass;
  },
  async update(
    tenantSlug: string,
    id: string,
    patch: Pick<HiitClass, 'classDate' | 'startTime' | 'endTime' | 'locationId'>,
  ): Promise<HiitClass> {
    const payload = await requestJson(apiUrl('hiit-classes', tenantSlug, id), {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const hiitClass = parseHiitClass((payload as { class?: unknown }).class);
    if (!hiitClass) {
      throw new Error('Invalid HIIT Class response.');
    }
    return hiitClass;
  },
  async remove(tenantSlug: string, id: string): Promise<void> {
    await requestJson(apiUrl('hiit-classes', tenantSlug, id), { method: 'DELETE' });
  },
  async listLocations(tenantSlug: string): Promise<HiitClassLocation[]> {
    const payload = await requestJson(apiUrl('class-locations', tenantSlug));
    const raw = Array.isArray((payload as { locations?: unknown }).locations)
      ? (payload as { locations: unknown[] }).locations
      : [];
    return raw.map((item) => parseLocation(item)).filter((item): item is HiitClassLocation => Boolean(item));
  },
};
