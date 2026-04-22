import type { Interval, ValidationResult } from '../types';

const defaultRest = (sequence: number): Interval => ({
  sequence,
  name: 'Rest',
  type: 'rest',
  durationMinutes: 0,
  durationSeconds: 30,
});

const normalizedCopy = (interval: Interval, sequence: number): Interval => ({
  ...interval,
  sequence,
  name: interval.name.trim() || `${interval.type[0].toUpperCase()}${interval.type.slice(1)}`,
  durationMinutes: Math.max(0, Math.floor(interval.durationMinutes || 0)),
  durationSeconds: Math.min(59, Math.max(0, Math.floor(interval.durationSeconds || 0))),
});

export const normalizeIntervals = (input: Interval[]): Interval[] => {
  const cleaned = input.map((item, idx) => normalizedCopy(item, idx + 1));
  const warmups = cleaned.filter((x) => x.type === 'warmup');
  const cooldowns = cleaned.filter((x) => x.type === 'cooldown');
  const core = cleaned.filter((x) => x.type === 'work' || x.type === 'rest');

  const rebuilt: Interval[] = [];
  if (warmups.length > 0) {
    rebuilt.push({ ...warmups[0], sequence: rebuilt.length + 1 });
  }

  for (let i = 0; i < core.length; i += 1) {
    const item = core[i];
    rebuilt.push({ ...item, sequence: rebuilt.length + 1 });

    if (item.type === 'work') {
      const next = core[i + 1];
      if (!next || next.type !== 'rest') {
        rebuilt.push(defaultRest(rebuilt.length + 1));
      }
    }
  }

  if (cooldowns.length > 0) {
    rebuilt.push({ ...cooldowns[0], sequence: rebuilt.length + 1 });
  }

  return rebuilt;
};

export const validateIntervals = (input: Interval[]): ValidationResult => {
  const normalized = normalizeIntervals(input);
  const errors: string[] = [];

  const works = normalized.filter((x) => x.type === 'work');
  if (works.length === 0) {
    errors.push('At least one work interval is required.');
  }

  normalized.forEach((item, idx) => {
    if (item.durationMinutes === 0 && item.durationSeconds === 0) {
      errors.push(`Interval #${idx + 1} has an invalid zero duration.`);
    }

    if (item.type === 'work') {
      const next = normalized[idx + 1];
      if (!next || next.type !== 'rest') {
        errors.push(`Work interval #${idx + 1} must be followed by rest.`);
      }
    }
  });

  const warmupIndex = normalized.findIndex((x) => x.type === 'warmup');
  if (warmupIndex > 0) {
    errors.push('Warmup must be first when present.');
  }

  const cooldownIndex = normalized.findIndex((x) => x.type === 'cooldown');
  if (cooldownIndex !== -1 && cooldownIndex !== normalized.length - 1) {
    errors.push('Cooldown must be last when present.');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
};
