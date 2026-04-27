import type { Timer, TimerValidationResult } from '../types';
import { durationMs } from './time';

const cleanCount = (value: number, fallback: number): number =>
  Math.max(1, Math.floor(Number.isFinite(value) ? value : fallback));

const cleanMinutes = (value: number, fallback = 0): number =>
  Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback));

const cleanSeconds = (value: number, fallback = 0): number =>
  Math.max(0, Math.min(59, Math.floor(Number.isFinite(value) ? value : fallback)));

export const normalizeTimerFields = (timer: Timer): Timer => {
  const warmupEnabled = Boolean(timer.warmupEnabled);
  const cooldownEnabled = Boolean(timer.cooldownEnabled);

  return {
    ...timer,
    name: timer.name.trim(),
    stationCount: cleanCount(timer.stationCount, 10),
    roundsPerStation: cleanCount(timer.roundsPerStation, 3),
    workMinutes: cleanMinutes(timer.workMinutes),
    workSeconds: cleanSeconds(timer.workSeconds, 30),
    restMinutes: cleanMinutes(timer.restMinutes),
    restSeconds: cleanSeconds(timer.restSeconds, 15),
    stationTransitionMinutes: cleanMinutes(timer.stationTransitionMinutes),
    stationTransitionSeconds: cleanSeconds(timer.stationTransitionSeconds, 30),
    startStationWorkManually: Boolean(timer.startStationWorkManually),
    warmupEnabled,
    warmupMinutes: warmupEnabled ? cleanMinutes(timer.warmupMinutes, 5) : 0,
    warmupSeconds: warmupEnabled ? cleanSeconds(timer.warmupSeconds) : 0,
    cooldownEnabled,
    cooldownMinutes: cooldownEnabled ? cleanMinutes(timer.cooldownMinutes, 5) : 0,
    cooldownSeconds: cooldownEnabled ? cleanSeconds(timer.cooldownSeconds) : 0,
  };
};

export const validateTimer = (timer: Timer, existingTimers: Timer[] = []): TimerValidationResult => {
  const normalized = normalizeTimerFields(timer);
  const errors: string[] = [];
  const name = normalized.name;

  if (!name) {
    errors.push('Timer name is required.');
  }

  if (name.length > 25) {
    errors.push('Timer name must be 25 characters or fewer.');
  }

  if (existingTimers.some((item) => item.id !== normalized.id && item.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.push('Timer name must be unique.');
  }

  if (durationMs(normalized.workMinutes, normalized.workSeconds) < 1000) {
    errors.push('Work time must be at least 1 second.');
  }

  if (normalized.roundsPerStation > 1 && durationMs(normalized.restMinutes, normalized.restSeconds) < 1000) {
    errors.push('Rest time must be at least 1 second when rounds are greater than 1.');
  }

  if (durationMs(normalized.stationTransitionMinutes, normalized.stationTransitionSeconds) < 1000) {
    errors.push('Station transition time must be at least 1 second.');
  }

  if (normalized.warmupEnabled && durationMs(normalized.warmupMinutes, normalized.warmupSeconds) < 1000) {
    errors.push('Warmup time must be at least 1 second when warmup is enabled.');
  }

  if (normalized.cooldownEnabled && durationMs(normalized.cooldownMinutes, normalized.cooldownSeconds) < 1000) {
    errors.push('Cooldown time must be at least 1 second when cooldown is enabled.');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
};
