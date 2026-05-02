const ANALYTICS_INGEST_PATH = '/api/analytics-ingest';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVE_KEY = 'nodoubt_analytics_last_active_at_ms';

export type AnalyticsEventName =
  | 'app_opened'
  | 'timer_created'
  | 'timer_cloned'
  | 'timer_created_from_template'
  | 'template_created_from_timer'
  | 'timer_run_completed'
  | 'timer_run_incomplete'
  | 'timer_run_coach_mode'
  | 'timers_exported'
  | 'timers_imported';

export interface RunAnalyticsPayload {
  stationCount: number;
  roundsPerStation: number;
  workSec: number;
  restSec: number;
  transitionSec: number;
  warmupEnabled: boolean;
  warmupSec: number;
  cooldownEnabled: boolean;
  cooldownSec: number;
  category: 'GENERAL' | 'FAT-LOSS' | 'PERFORMANCE';
  coachModeAtRun: boolean;
}

export interface AnalyticsPayloadByEvent {
  app_opened: Record<string, never>;
  timer_created: {
    category: 'GENERAL' | 'FAT-LOSS' | 'PERFORMANCE';
  };
  timer_cloned: {
    category: 'GENERAL' | 'FAT-LOSS' | 'PERFORMANCE';
  };
  timer_created_from_template: {
    category: 'GENERAL' | 'FAT-LOSS' | 'PERFORMANCE';
  };
  template_created_from_timer: {
    category: 'GENERAL' | 'FAT-LOSS' | 'PERFORMANCE';
  };
  timer_run_completed: RunAnalyticsPayload;
  timer_run_incomplete: RunAnalyticsPayload;
  timer_run_coach_mode: RunAnalyticsPayload;
  timers_exported: {
    timerCount: number;
  };
  timers_imported: {
    timerCount: number;
  };
}

type BrowserFamily = 'chrome' | 'safari' | 'firefox' | 'edge' | 'other';
type OsFamily = 'ios' | 'android' | 'windows' | 'macos' | 'other';
type DeviceType = 'mobile' | 'tablet' | 'desktop';

const nowMs = () => Date.now();

const getStoredLastActiveMs = (): number | null => {
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const setStoredLastActiveMs = (timestampMs: number) => {
  try {
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(Math.floor(timestampMs)));
  } catch {
    // Ignore storage failures. Analytics is best-effort.
  }
};

export const detectBrowserFamily = (userAgent: string): BrowserFamily => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) {
    return 'edge';
  }
  if (ua.includes('firefox/')) {
    return 'firefox';
  }
  if (ua.includes('chrome/') || ua.includes('crios/')) {
    return 'chrome';
  }
  if (ua.includes('safari/')) {
    return 'safari';
  }
  return 'other';
};

type UaNavigatorData = {
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
    platformVersion?: string;
  };
};

const getUaPlatform = (navigatorValue: Navigator): string => (
  (navigatorValue as Navigator & UaNavigatorData).userAgentData?.platform
  ?? navigatorValue.platform
  ?? ''
);

const getUaPlatformVersion = (navigatorValue: Navigator): string => (
  (navigatorValue as Navigator & UaNavigatorData).userAgentData?.platformVersion
  ?? ''
);

export const detectOsFamily = (userAgent: string, platform: string): OsFamily => {
  const ua = userAgent.toLowerCase();
  const p = platform.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || p.includes('iphone') || p.includes('ipad')) {
    return 'ios';
  }
  if (ua.includes('android') || p.includes('android')) {
    return 'android';
  }
  if (ua.includes('windows') || p.includes('win')) {
    return 'windows';
  }
  if (ua.includes('mac os x') || p.includes('mac')) {
    return 'macos';
  }
  return 'other';
};

export const detectOsVersionMajor = (userAgent: string, osFamily: OsFamily, platformVersion?: string): string => {
  const ua = userAgent.toLowerCase();
  const platformVersionMajor = platformVersion?.match(/^(\d+)/)?.[1];
  if (platformVersionMajor) {
    return platformVersionMajor;
  }
  if (osFamily === 'ios') {
    return ua.match(/(?:iphone )?os (\d+)[._]/)?.[1]
      ?? ua.match(/cpu (?:iphone )?os (\d+)[._]/)?.[1]
      ?? 'unknown';
  }
  if (osFamily === 'android') {
    return ua.match(/android (\d+)(?:[._]\d+)?/)?.[1] ?? 'unknown';
  }
  if (osFamily === 'windows') {
    return ua.match(/windows nt (\d+)\./)?.[1] ?? 'unknown';
  }
  if (osFamily === 'macos') {
    return ua.match(/mac os x (\d+)[._]/)?.[1] ?? 'unknown';
  }
  return 'unknown';
};

export const detectDeviceType = (
  userAgent: string,
  osFamily: OsFamily,
  userAgentDataMobile?: boolean,
): DeviceType => {
  if (typeof userAgentDataMobile === 'boolean') {
    return userAgentDataMobile ? 'mobile' : 'desktop';
  }
  const ua = userAgent.toLowerCase();
  if (ua.includes('ipad') || ua.includes('tablet')) {
    return 'tablet';
  }
  if (osFamily === 'android' && !ua.includes('mobile')) {
    return 'tablet';
  }
  if (ua.includes('mobi') || ua.includes('iphone') || ua.includes('ipod') || ua.includes('android')) {
    return 'mobile';
  }
  return 'desktop';
};

const sendBeaconPayload = (body: string): boolean => {
  if (!('sendBeacon' in navigator) || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  try {
    const blob = new Blob([body], { type: 'application/json' });
    return navigator.sendBeacon(ANALYTICS_INGEST_PATH, blob);
  } catch {
    return false;
  }
};

export const trackAnalyticsEvent = <TEvent extends AnalyticsEventName>(
  eventName: TEvent,
  payload: AnalyticsPayloadByEvent[TEvent],
) => {
  const osFamily = detectOsFamily(navigator.userAgent, getUaPlatform(navigator));
  const uaDataMobile = (navigator as Navigator & UaNavigatorData).userAgentData?.mobile;
  const requestBody = JSON.stringify({
    eventName,
    occurredAt: new Date().toISOString(),
    browserFamily: detectBrowserFamily(navigator.userAgent),
    osFamily,
    osVersion: detectOsVersionMajor(navigator.userAgent, osFamily, getUaPlatformVersion(navigator)),
    deviceType: detectDeviceType(navigator.userAgent, osFamily, uaDataMobile),
    payload,
  });

  if (sendBeaconPayload(requestBody)) {
    return;
  }

  void fetch(ANALYTICS_INGEST_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
    keepalive: true,
  }).catch(() => {
    // Ignore errors; analytics should never break core app usage.
  });
};

const markActive = () => setStoredLastActiveMs(nowMs());

let listenersAttached = false;

const attachActivityListeners = () => {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;
  const onActivity = () => markActive();
  window.addEventListener('focus', onActivity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onActivity();
    }
  });
  window.addEventListener('beforeunload', onActivity);
};

export const startAnalyticsSession = () => {
  const now = nowMs();
  const lastActive = getStoredLastActiveMs();
  const isNewSession = !lastActive || now - lastActive > SESSION_TIMEOUT_MS;
  if (isNewSession) {
    trackAnalyticsEvent('app_opened', {});
  }
  setStoredLastActiveMs(now);
  attachActivityListeners();
};
