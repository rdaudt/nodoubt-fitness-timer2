import { normalizeTimerFields } from '../lib/timerRules';
import { TemplateRepository } from './storage';
import { trackAnalyticsEvent } from './analytics';
import type { Template, Timer, WorkoutCategory } from '../types';

const BUILTIN_TEMPLATE_FORMAT = 'nodoubt-timers-template';

interface BuiltinTemplateFile {
  format: string;
  name: string;
  category: WorkoutCategory;
  stationCount: number;
  stationWorkoutTypes?: string[];
  roundsPerStation: number;
  workMinutes: number;
  workSeconds: number;
  restMinutes: number;
  restSeconds: number;
  stationTransitionMinutes: number;
  stationTransitionSeconds: number;
  startStationWorkManually: boolean;
  warmupEnabled: boolean;
  warmupMinutes: number;
  warmupSeconds: number;
  cooldownEnabled: boolean;
  cooldownMinutes: number;
  cooldownSeconds: number;
}

const builtinTemplateFiles = import.meta.glob('../../templates/*.json', { eager: true, import: 'default' });

const toBuiltinTemplateId = (filePath: string): string =>
  `builtin:${filePath.split('/').at(-1)?.replace(/\.json$/i, '') ?? crypto.randomUUID()}`;

const parseBuiltinTemplate = (value: unknown, filePath: string): Template | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const file = value as BuiltinTemplateFile;
  if (file.format !== BUILTIN_TEMPLATE_FORMAT || typeof file.name !== 'string') {
    return null;
  }
  const now = new Date().toISOString();
  const candidate = normalizeTimerFields({
    id: toBuiltinTemplateId(filePath),
    name: file.name,
    category: 'GENERAL',
    stationCount: file.stationCount,
    stationWorkoutTypes: file.stationWorkoutTypes ?? [],
    roundsPerStation: file.roundsPerStation,
    workMinutes: file.workMinutes,
    workSeconds: file.workSeconds,
    restMinutes: file.restMinutes,
    restSeconds: file.restSeconds,
    stationTransitionMinutes: file.stationTransitionMinutes,
    stationTransitionSeconds: file.stationTransitionSeconds,
    startStationWorkManually: file.startStationWorkManually,
    warmupEnabled: file.warmupEnabled,
    warmupMinutes: file.warmupMinutes,
    warmupSeconds: file.warmupSeconds,
    cooldownEnabled: file.cooldownEnabled,
    cooldownMinutes: file.cooldownMinutes,
    cooldownSeconds: file.cooldownSeconds,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ...candidate,
    source: 'builtin',
  };
};

export const loadBuiltinTemplates = (): Template[] =>
  Object.entries(builtinTemplateFiles)
    .map(([filePath, value]) => parseBuiltinTemplate(value, filePath))
    .filter((template): template is Template => Boolean(template))
    .sort((a, b) => a.name.localeCompare(b.name));

export const createTemplateFromTimer = async (timer: Timer, name: string): Promise<Template> => {
  const now = new Date().toISOString();
  const template: Template = {
    ...normalizeTimerFields({
      ...timer,
      id: crypto.randomUUID(),
      name,
      category: 'GENERAL',
      createdAt: now,
      updatedAt: now,
    }),
    source: 'user',
  };
  await TemplateRepository.upsert(template);
  trackAnalyticsEvent('template_created_from_timer', {
    category: 'GENERAL',
  });
  window.dispatchEvent(new Event('templates:changed'));
  return template;
};

export const createTimerFromTemplate = async (template: Template): Promise<Timer> => {
  const now = new Date().toISOString();
  const timer: Timer = normalizeTimerFields({
    id: crypto.randomUUID(),
    name: template.name,
    stationCount: template.stationCount,
    stationWorkoutTypes: template.stationWorkoutTypes ?? [],
    roundsPerStation: template.roundsPerStation,
    workMinutes: template.workMinutes,
    workSeconds: template.workSeconds,
    restMinutes: template.restMinutes,
    restSeconds: template.restSeconds,
    stationTransitionMinutes: template.stationTransitionMinutes,
    stationTransitionSeconds: template.stationTransitionSeconds,
    startStationWorkManually: template.startStationWorkManually,
    warmupEnabled: template.warmupEnabled,
    warmupMinutes: template.warmupMinutes,
    warmupSeconds: template.warmupSeconds,
    cooldownEnabled: template.cooldownEnabled,
    cooldownMinutes: template.cooldownMinutes,
    cooldownSeconds: template.cooldownSeconds,
    category: template.category,
    createdAt: now,
    updatedAt: now,
  });
  return timer;
};

export const listTemplates = async (): Promise<Template[]> => {
  const [userTemplates, deletedBuiltinIds] = await Promise.all([
    TemplateRepository.list(),
    TemplateRepository.listDeletedBuiltinIds(),
  ]);
  const builtinTemplates = loadBuiltinTemplates();
  const deletedSet = new Set(deletedBuiltinIds);
  const userOverrides = new Map<string, Template>();

  for (const userTemplate of userTemplates) {
    if (userTemplate.builtinTemplateId) {
      userOverrides.set(userTemplate.builtinTemplateId, userTemplate);
    }
  }

  const merged: Template[] = [...userTemplates.filter((item) => !item.builtinTemplateId)];

  for (const builtin of builtinTemplates) {
    const override = userOverrides.get(builtin.id);
    if (override) {
      merged.push(override);
      continue;
    }
    if (!deletedSet.has(builtin.id)) {
      merged.push(builtin);
    }
  }

  return merged.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
};

export const getTemplateById = async (id: string): Promise<Template | undefined> => {
  if (id.startsWith('builtin:')) {
    const merged = await listTemplates();
    return merged.find((item) => item.id === id || item.builtinTemplateId === id);
  }
  return TemplateRepository.get(id);
};

export const saveTemplate = async (template: Template): Promise<Template> => {
  const now = new Date().toISOString();
  if (template.source === 'builtin') {
    const copied: Template = {
      ...template,
      id: crypto.randomUUID(),
      source: 'user',
      builtinTemplateId: template.id,
      category: 'GENERAL',
      updatedAt: now,
      createdAt: now,
    };
    await TemplateRepository.upsert(copied);
    await TemplateRepository.clearBuiltinDeletedMark(template.id);
    window.dispatchEvent(new Event('templates:changed'));
    return copied;
  }
  const updated: Template = {
    ...template,
    source: 'user',
    category: 'GENERAL',
    updatedAt: now,
  };
  await TemplateRepository.upsert(updated);
  window.dispatchEvent(new Event('templates:changed'));
  return updated;
};

export const deleteTemplate = async (template: Template): Promise<void> => {
  if (template.source === 'builtin') {
    await TemplateRepository.markBuiltinDeleted(template.id);
  } else {
    await TemplateRepository.remove(template.id);
  }
  window.dispatchEvent(new Event('templates:changed'));
};
