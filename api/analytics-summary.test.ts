import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();

vi.mock('./_analyticsDb', () => ({
  createTablesIfNeeded: vi.fn(async () => {}),
  getAnalyticsDb: vi.fn(() => ({
    execute: executeMock,
  })),
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
};

const createMockRes = (): { res: { status: (code: number) => { json: (body: unknown) => void } }; store: MockResponse } => {
  const store: MockResponse = { statusCode: 200, body: null };
  return {
    res: {
      status(code: number) {
        store.statusCode = code;
        return {
          json(body: unknown) {
            store.body = body;
          },
        };
      },
    },
    store,
  };
};

describe('analytics-summary API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns browser, OS and device breakdowns', async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [{ timer_run_completed_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ browser_family: 'chrome', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ os_family: 'android', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ os_version: '14', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ device_type: 'mobile', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ category: 'GENERAL', count: 1 }] });

    const { default: handler } = await import('./analytics-summary');
    const { res, store } = createMockRes();
    await handler({ method: 'GET' }, res);

    expect(store.statusCode).toBe(200);
    const body = store.body as Record<string, unknown>;
    expect(body.browserFamilyCounts).toEqual([{ browserFamily: 'chrome', count: 2 }]);
    expect(body.osFamilyCounts).toEqual([{ osFamily: 'android', count: 2 }]);
    expect(body.osVersionCounts).toEqual([{ osVersion: '14', count: 2 }]);
    expect(body.deviceTypeCounts).toEqual([{ deviceType: 'mobile', count: 2 }]);
  });
});
