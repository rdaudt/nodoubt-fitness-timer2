import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectBrowserFamily,
  detectDeviceType,
  detectOsFamily,
  detectOsVersionMajor,
  startAnalyticsSession,
  trackAnalyticsEvent,
} from './analytics';

describe('analytics service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('detects browser families using coarse labels only', () => {
    expect(detectBrowserFamily('Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36')).toBe('chrome');
    expect(detectBrowserFamily('Mozilla/5.0 Firefox/124.0')).toBe('firefox');
    expect(detectBrowserFamily('Mozilla/5.0 Edg/124.0.0.0')).toBe('edge');
    expect(detectBrowserFamily('Mozilla/5.0 Version/17.0 Safari/605.1.15')).toBe('safari');
    expect(detectBrowserFamily('UnknownUA')).toBe('other');
  });

  it('detects OS family, version, and device type using coarse labels', () => {
    expect(detectOsFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)', 'iPhone')).toBe('ios');
    expect(detectOsVersionMajor('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)', 'ios')).toBe('17');
    expect(detectDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)', 'ios')).toBe('mobile');

    expect(detectOsFamily('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Mobile', 'Linux armv8l')).toBe('android');
    expect(detectOsVersionMajor('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Mobile', 'android')).toBe('14');
    expect(detectDeviceType('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Mobile', 'android')).toBe('mobile');

    expect(detectDeviceType('Mozilla/5.0 (Linux; Android 14; SM-X900)', 'android')).toBe('tablet');

    expect(detectOsFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')).toBe('windows');
    expect(detectOsVersionMajor('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows')).toBe('10');
    expect(detectDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows')).toBe('desktop');

    expect(detectOsFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', 'MacIntel')).toBe('macos');
    expect(detectOsVersionMajor('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', 'macos')).toBe('14');

    expect(detectOsFamily('UnknownUA', 'Unknown')).toBe('other');
    expect(detectOsVersionMajor('UnknownUA', 'other')).toBe('unknown');
  });

  it('emits app_opened only once per active session window', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon, userAgent: 'Chrome/123.0.0.0' });

    startAnalyticsSession();
    startAnalyticsSession();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const url = (sendBeacon.mock.calls[0] as unknown[])[0];
    expect(url).toBe('/api/analytics-ingest');
  });

  it('sends events with keepalive fallback when sendBeacon is unavailable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: undefined, userAgent: 'Firefox/124.0' });

    trackAnalyticsEvent('timers_imported', { timerCount: 3 });
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/analytics-ingest');
    const options = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe('POST');
    expect(options.keepalive).toBe(true);
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    expect(typeof body.osFamily).toBe('string');
    expect(typeof body.osVersion).toBe('string');
    expect(typeof body.deviceType).toBe('string');
  });
});
