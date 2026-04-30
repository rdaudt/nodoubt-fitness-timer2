const EVENT_NAMES = [
  'app_opened',
  'timer_created',
  'timer_cloned',
  'timer_created_from_template',
  'template_created_from_timer',
  'timer_run_completed',
  'timer_run_incomplete',
  'timer_run_coach_mode',
  'timers_exported',
  'timers_imported',
] as const;

const BROWSER_FAMILIES = ['chrome', 'safari', 'firefox', 'edge', 'other'] as const;
const CATEGORIES = ['GENERAL', 'FAT-LOSS', 'PERFORMANCE'] as const;

export type AnalyticsEventName = typeof EVENT_NAMES[number];
export type BrowserFamily = typeof BROWSER_FAMILIES[number];

type ParsedIngestBody = {
  eventName: AnalyticsEventName;
  occurredAt: string;
  browserFamily: BrowserFamily;
  payload: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isCategory = (value: unknown): value is (typeof CATEGORIES)[number] =>
  typeof value === 'string' && CATEGORIES.includes(value as (typeof CATEGORIES)[number]);

const isFiniteNonNegativeInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isRunPayload = (value: Record<string, unknown>): boolean => (
  hasOnlyKeys(value, [
    'stationCount',
    'roundsPerStation',
    'workSec',
    'restSec',
    'transitionSec',
    'warmupEnabled',
    'warmupSec',
    'cooldownEnabled',
    'cooldownSec',
    'category',
    'coachModeAtRun',
  ])
  && isFiniteNonNegativeInt(value.stationCount)
  && value.stationCount >= 1
  && isFiniteNonNegativeInt(value.roundsPerStation)
  && value.roundsPerStation >= 1
  && isFiniteNonNegativeInt(value.workSec)
  && isFiniteNonNegativeInt(value.restSec)
  && isFiniteNonNegativeInt(value.transitionSec)
  && typeof value.warmupEnabled === 'boolean'
  && isFiniteNonNegativeInt(value.warmupSec)
  && typeof value.cooldownEnabled === 'boolean'
  && isFiniteNonNegativeInt(value.cooldownSec)
  && isCategory(value.category)
  && typeof value.coachModeAtRun === 'boolean'
);

const validatePayloadByEvent = (
  eventName: AnalyticsEventName,
  payload: Record<string, unknown>,
): boolean => {
  if (eventName === 'app_opened') {
    return hasOnlyKeys(payload, []);
  }
  if (
    eventName === 'timer_created'
    || eventName === 'timer_cloned'
    || eventName === 'timer_created_from_template'
    || eventName === 'template_created_from_timer'
  ) {
    return hasOnlyKeys(payload, ['category']) && isCategory(payload.category);
  }
  if (eventName === 'timers_exported' || eventName === 'timers_imported') {
    return hasOnlyKeys(payload, ['timerCount']) && isFiniteNonNegativeInt(payload.timerCount);
  }
  return isRunPayload(payload);
};

export const validateIngestBody = (value: unknown): ParsedIngestBody | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (!EVENT_NAMES.includes(value.eventName as AnalyticsEventName)) {
    return null;
  }
  if (!BROWSER_FAMILIES.includes(value.browserFamily as BrowserFamily)) {
    return null;
  }
  if (typeof value.occurredAt !== 'string' || Number.isNaN(new Date(value.occurredAt).getTime())) {
    return null;
  }
  if (!isRecord(value.payload)) {
    return null;
  }
  const eventName = value.eventName as AnalyticsEventName;
  if (!validatePayloadByEvent(eventName, value.payload)) {
    return null;
  }
  return {
    eventName,
    occurredAt: value.occurredAt,
    browserFamily: value.browserFamily as BrowserFamily,
    payload: value.payload,
  };
};
