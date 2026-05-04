import type { PublicTemplate, TenantPublicProfile } from '../types';

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

export const fetchTenantPublicProfile = async (slug: string): Promise<TenantPublicProfile | null> => {
  const response = await fetch(`/api/tenant-public?slug=${encodeURIComponent(slug)}`);
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  return normalizeProfile(payload);
};

export const fetchTenantPublicTemplates = async (slug: string): Promise<PublicTemplate[]> => {
  const response = await fetch(`/api/tenant-templates?slug=${encodeURIComponent(slug)}`);
  if (!response.ok) {
    return [];
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map((item) => normalizeTemplate(item)).filter((item): item is PublicTemplate => Boolean(item));
};
