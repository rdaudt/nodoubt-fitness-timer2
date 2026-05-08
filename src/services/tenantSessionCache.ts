import type { PublicTemplate, TenantPublicProfile } from '../types';

const SESSION_KEY = 'tenant_session_cache_v1';
const TEN_MINUTES_MS = 10 * 60 * 1000;

export type TenantCacheSource = 'memory' | 'sessionStorage';

export interface TenantCacheEntry {
  slug: string;
  profile: TenantPublicProfile | null;
  templates: PublicTemplate[];
  fetchedAt: number;
}

const memoryCache = new Map<string, TenantCacheEntry>();

const normalizeEntry = (value: unknown): TenantCacheEntry | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const slug = typeof row.slug === 'string' ? row.slug.trim().toLowerCase() : '';
  if (!slug) {
    return null;
  }
  const templates = Array.isArray(row.templates) ? (row.templates as PublicTemplate[]) : [];
  const fetchedAt = Number(row.fetchedAt);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    return null;
  }
  return {
    slug,
    profile: (row.profile as TenantPublicProfile | null) ?? null,
    templates,
    fetchedAt,
  };
};

const readSessionMap = (): Record<string, TenantCacheEntry> => {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, TenantCacheEntry> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const normalized = normalizeEntry(value);
      if (normalized) {
        result[key] = normalized;
      }
    });
    return result;
  } catch {
    return {};
  }
};

const writeSessionMap = (entries: Record<string, TenantCacheEntry>): void => {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage failures
  }
};

export const getTenantSessionCache = (slug: string): { entry: TenantCacheEntry; source: TenantCacheSource } | null => {
  const normalizedSlug = slug.trim().toLowerCase();
  const inMemory = memoryCache.get(normalizedSlug);
  if (inMemory) {
    return { entry: inMemory, source: 'memory' };
  }
  const map = readSessionMap();
  const fromSession = map[normalizedSlug];
  if (!fromSession) {
    return null;
  }
  memoryCache.set(normalizedSlug, fromSession);
  return { entry: fromSession, source: 'sessionStorage' };
};

export const setTenantSessionCache = (slug: string, profile: TenantPublicProfile | null, templates: PublicTemplate[]): TenantCacheEntry => {
  const normalizedSlug = slug.trim().toLowerCase();
  const entry: TenantCacheEntry = {
    slug: normalizedSlug,
    profile,
    templates,
    fetchedAt: Date.now(),
  };
  memoryCache.set(normalizedSlug, entry);
  const map = readSessionMap();
  map[normalizedSlug] = entry;
  writeSessionMap(map);
  return entry;
};

export const clearTenantSessionCache = (): void => {
  memoryCache.clear();
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage failures
  }
};

export const isTenantCacheStale = (entry: TenantCacheEntry): boolean => Date.now() - entry.fetchedAt > TEN_MINUTES_MS;
