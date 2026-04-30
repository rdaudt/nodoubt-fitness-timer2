import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();
const batchMock = vi.fn();

vi.mock('./_analyticsDb', () => ({
  createTablesIfNeeded: vi.fn(async () => {}),
  getAnalyticsDb: vi.fn(() => ({
    execute: executeMock,
    batch: batchMock,
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

describe('analytics-ingest API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid payload', async () => {
    const { default: handler } = await import('./analytics-ingest');
    const { res, store } = createMockRes();

    await handler({ method: 'POST', body: { foo: 'bar' } }, res);

    expect(store.statusCode).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('accepts valid event payload and stores it', async () => {
    executeMock.mockResolvedValue({ rowsAffected: 1 });
    const { default: handler } = await import('./analytics-ingest');
    const { res, store } = createMockRes();

    await handler({
      method: 'POST',
      body: {
        eventName: 'timer_created',
        occurredAt: '2026-04-29T12:00:00.000Z',
        browserFamily: 'chrome',
        payload: { category: 'GENERAL' },
      },
    }, res);

    expect(store.statusCode).toBe(202);
    expect(executeMock).toHaveBeenCalledTimes(1);
    const args = executeMock.mock.calls[0][0] as { args: unknown[] };
    expect(args.args[1]).toBe('timer_created');
  });
});
