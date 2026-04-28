import { normalizeTimer, TimerRepository } from './storage';
import type { Timer } from '../types';

export const TIMER_EXPORT_FORMAT = 'nodoubt-timers-export';
export const TIMER_EXPORT_VERSION = '1';

export interface TimerExportPayload {
  format: typeof TIMER_EXPORT_FORMAT;
  version: typeof TIMER_EXPORT_VERSION;
  exportedAt: string;
  timers: Timer[];
}

const pad2 = (value: number) => value.toString().padStart(2, '0');

export const buildTimerExportFilename = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  return `nodoubt-timers-${year}-${month}-${day}-${hour}-${minute}.json`;
};

export const buildTimerExportPayload = async (): Promise<TimerExportPayload> => {
  const timers = await TimerRepository.list();
  return {
    format: TIMER_EXPORT_FORMAT,
    version: TIMER_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    timers,
  };
};

const validatePayloadShape = (payload: unknown): payload is TimerExportPayload => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const keys = Object.keys(payload as Record<string, unknown>).sort();
  const expectedKeys = ['exportedAt', 'format', 'timers', 'version'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key, index) => key === keys[index])) {
    return false;
  }
  const typed = payload as TimerExportPayload;
  return (
    typed.format === TIMER_EXPORT_FORMAT
    && typed.version === TIMER_EXPORT_VERSION
    && typeof typed.exportedAt === 'string'
    && Array.isArray(typed.timers)
  );
};

const parseImportFile = async (file: File): Promise<TimerExportPayload> => {
  let parsed: unknown;
  try {
    const content = await file.text();
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON file.');
  }
  if (!validatePayloadShape(parsed)) {
    throw new Error('Invalid export file format.');
  }
  return parsed;
};

const validateTimers = (timers: Timer[]): Timer[] => {
  const normalized = timers.map((timer) => normalizeTimer(timer));
  if (normalized.some((timer) => !timer)) {
    throw new Error('Import file contains one or more invalid timers.');
  }
  return normalized as Timer[];
};

export const exportTimersToDevice = async (): Promise<void> => {
  const payload = await buildTimerExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = buildTimerExportFilename();
  link.click();
  URL.revokeObjectURL(url);
};

export const importTimersFromFile = async (file: File): Promise<number> => {
  const payload = await parseImportFile(file);
  const timers = validateTimers(payload.timers);
  await TimerRepository.replaceAll(timers);
  return timers.length;
};
