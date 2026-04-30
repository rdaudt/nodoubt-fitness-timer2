import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectBrowserFamily, startAnalyticsSession, trackAnalyticsEvent } from './analytics';

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
  });
});
