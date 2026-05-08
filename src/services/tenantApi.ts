import type { PublicTemplate, TenantPublicProfile } from '../types';
import { isPerfTriageEnabled, recordFetchMetric } from './perfTriage';

interface PerfFetchOptions {
  traceId?: string;
  route?: string;
  onCacheSource?: (source: 'network' | 'sw-cache') => void;
}

const buildPerfHeaders = (options?: PerfFetchOptions): HeadersInit | undefined => {
  if (!options?.traceId) {
    return undefined;
  }
  return {
    'x-perf-trace-id': options.traceId,
    'x-perf-route': options.route ?? '',
  };
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeProfile = (value: unknown): TenantPublicProfile | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const typed = value as Record<string, unknown>;
  const id = asString(typed.id);
  const slug = asString(typed.slug);
  if (!id || !slug) {
    return null;
  }
  const socialLinksRaw = Array.isArray(typed.socialLinks) ? typed.socialLinks : [];
  const socialLinks = socialLinksRaw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      label: asString(row.label),
      url: asString(row.url),
      sortOrder: asNumber(row.sortOrder),
    };
  }).filter((item) => item.label && item.url);
  return {
    id,
    slug,
    businessName: asString(typed.businessName),
    coachName: asString(typed.coachName),
    headerTagline: asString(typed.headerTagline),
    igUsername: asString(typed.igUsername),
    bio: asString(typed.bio),
    logoUrl: asString(typed.logoUrl),
    coachPhotoUrl: asString(typed.coachPhotoUrl),
    qrCodeUrl: asString(typed.qrCodeUrl),
    socialLinks,
  };
};

const normalizeTemplate = (value: unknown): PublicTemplate | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const typed = value as Record<string, unknown>;
  const id = asString(typed.id);
  const name = asString(typed.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    stationCount: asNumber(typed.stationCount),
    stationWorkoutTypes: Array.isArray(typed.stationWorkoutTypes) ? typed.stationWorkoutTypes.map((v) => asString(v)) : [],
    roundsPerStation: asNumber(typed.roundsPerStation),
    workMinutes: asNumber(typed.workMinutes),
    workSeconds: asNumber(typed.workSeconds),
    restMinutes: asNumber(typed.restMinutes),
    restSeconds: asNumber(typed.restSeconds),
    stationTransitionMinutes: asNumber(typed.stationTransitionMinutes),
    stationTransitionSeconds: asNumber(typed.stationTransitionSeconds),
    startStationWorkManually: Boolean(typed.startStationWorkManually),
    warmupEnabled: Boolean(typed.warmupEnabled),
    warmupMinutes: asNumber(typed.warmupMinutes),
    warmupSeconds: asNumber(typed.warmupSeconds),
    cooldownEnabled: Boolean(typed.cooldownEnabled),
    cooldownMinutes: asNumber(typed.cooldownMinutes),
    cooldownSeconds: asNumber(typed.cooldownSeconds),
    category: 'GENERAL',
    createdAt: asString(typed.createdAt),
    updatedAt: asString(typed.updatedAt),
  };
};

export const fetchTenantPublicProfile = async (slug: string, options?: PerfFetchOptions): Promise<TenantPublicProfile | null> => {
  const startedAt = performance.now();
  const perfEnabled = isPerfTriageEnabled();
  let headersAt = startedAt;
  const response = await fetch(`/api/tenant-public?slug=${encodeURIComponent(slug)}`, {
    headers: buildPerfHeaders(options),
  });
  options?.onCacheSource?.(response.headers.get('x-sw-cache') ? 'sw-cache' : 'network');
  headersAt = performance.now();
  if (perfEnabled) {
    recordFetchMetric('tenant_public_fetch_ms', headersAt - startedAt);
    recordFetchMetric('tenant_public_headers_ms', headersAt - startedAt);
  }
  if (!response.ok) {
    return null;
  }
  const parseStart = performance.now();
  const payload = await response.json();
  if (perfEnabled) {
    recordFetchMetric('tenant_public_json_parse_ms', performance.now() - parseStart);
  }
  return normalizeProfile(payload);
};

export const fetchTenantPublicTemplates = async (slug: string, options?: PerfFetchOptions): Promise<PublicTemplate[]> => {
  const startedAt = performance.now();
  const perfEnabled = isPerfTriageEnabled();
  let headersAt = startedAt;
  const response = await fetch(`/api/tenant-templates?slug=${encodeURIComponent(slug)}`, {
    headers: buildPerfHeaders(options),
  });
  options?.onCacheSource?.(response.headers.get('x-sw-cache') ? 'sw-cache' : 'network');
  headersAt = performance.now();
  if (perfEnabled) {
    recordFetchMetric('tenant_templates_fetch_ms', headersAt - startedAt);
    recordFetchMetric('tenant_templates_headers_ms', headersAt - startedAt);
  }
  if (!response.ok) {
    return [];
  }
  const parseStart = performance.now();
  const payload = await response.json();
  if (perfEnabled) {
    recordFetchMetric('tenant_templates_json_parse_ms', performance.now() - parseStart);
  }
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map((item) => normalizeTemplate(item)).filter((item): item is PublicTemplate => Boolean(item));
};
