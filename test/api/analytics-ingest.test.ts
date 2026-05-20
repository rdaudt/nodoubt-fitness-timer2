import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();
const batchMock = vi.fn();

vi.mock('../../api/_analyticsDb', () => ({
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

const baseValidBody = {
  eventName: 'timer_created' as const,
  occurredAt: '2026-04-29T12:00:00.000Z',
  browserFamily: 'chrome' as const,
  osFamily: 'android' as const,
  osVersion: '14',
  deviceType: 'mobile' as const,
  payload: { category: 'GENERAL', coachMode: false },
};

const isTenantLookup = (sql: string) => /FROM coach_tenants/i.test(sql);

describe('analytics-ingest API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid payload', async () => {
    const { default: handler } = await import('../../api/analytics-ingest');
    const { res, store } = createMockRes();

    await handler({ method: 'POST', body: { foo: 'bar' } }, res);

    expect(store.statusCode).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('accepts valid event payload and stores it', async () => {
    executeMock.mockResolvedValue({ rowsAffected: 1, rows: [] });
    const { default: handler } = await import('../../api/analytics-ingest');
    const { res, store } = createMockRes();

    await handler({ method: 'POST', body: baseValidBody }, res);

    expect(store.statusCode).toBe(202);
    const insertCall = executeMock.mock.calls.find(
      ([call]) => !isTenantLookup((call as { sql: string }).sql),
    );
    expect(insertCall).toBeDefined();
    const insertArgs = (insertCall![0] as { args: unknown[] }).args;
    expect(insertArgs[1]).toBe('timer_created');
    expect(insertArgs[2]).toBe('');
    expect(insertArgs[3]).toBe('');
  });

  it('rejects payload with invalid device metadata', async () => {
    const { default: handler } = await import('../../api/analytics-ingest');
    const { res, store } = createMockRes();

    await handler({
      method: 'POST',
      body: {
        ...baseValidBody,
        osFamily: 'linux',
        osVersion: '14.2',
        deviceType: 'console',
      },
    }, res);

    expect(store.statusCode).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects payload missing coachMode in event payload', async () => {
    const { default: handler } = await import('../../api/analytics-ingest');
    const { res, store } = createMockRes();
    await handler({
      method: 'POST',
      body: {
        ...baseValidBody,
        payload: { category: 'GENERAL' },
      },
    }, res);
    expect(store.statusCode).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('resolves tenant_id from a known slug', async () => {
    executeMock.mockImplementation(async (call: { sql: string; args: unknown[] }) => {
      if (isTenantLookup(call.sql)) {
        return { rows: [{ id: 'tenant-uuid-123' }] };
      }
      return { rowsAffected: 1, rows: [] };
    });
    const { default: handler } = await import('../../api/analytics-ingest');
    const { res, store } = createMockRes();

    await handler({ method: 'POST', body: { ...baseValidBody, tenantSlug: 'acme-fit' } }, res);

    expect(store.statusCode).toBe(202);
    const lookupCalls = executeMock.mock.calls.filter(([call]) => isTenantLookup((call as { sql: string }).sql));
    expect(lookupCalls).toHaveLength(1);
    expect((lookupCalls[0][0] as { args: unknown[] }).args[0]).toBe('acme-fit');
    const insertCall = executeMock.mock.calls.find(
      ([call]) => !isTenantLookup((call as { sql: string }).sql),
    );
    const insertArgs = (insertCall![0] as { args: unknown[] }).args;
    expect(insertArgs[2]).toBe('acme-fit');
    expect(insertArgs[3]).toBe('tenant-uuid-123');
  });

  it('inserts empty tenant_id when slug is unknown', async () => {
    executeMock.mockImplementation(async (call: { sql: string }) => {
      if (isTenantLookup(call.sql)) {
        return { rows: [] };
      }
      return { rowsAffected: 1, rows: [] };
    });
    const { default: handler } = await import('../../api/analytics-ingest');
    const { res, store } = createMockRes();

    await handler({ method: 'POST', body: { ...baseValidBody, tenantSlug: 'nope-nope' } }, res);

    expect(store.statusCode).toBe(202);
    const insertCall = executeMock.mock.calls.find(
      ([call]) => !isTenantLookup((call as { sql: string }).sql),
    );
    const insertArgs = (insertCall![0] as { args: unknown[] }).args;
    expect(insertArgs[3]).toBe('');
  });

  it('caches the tenant lookup across requests', async () => {
    executeMock.mockImplementation(async (call: { sql: string }) => {
      if (isTenantLookup(call.sql)) {
        return { rows: [{ id: 'tenant-uuid-cache' }] };
      }
      return { rowsAffected: 1, rows: [] };
    });
    const { default: handler } = await import('../../api/analytics-ingest');

    const { res: r1 } = createMockRes();
    await handler({ method: 'POST', body: { ...baseValidBody, tenantSlug: 'cached-slug' } }, r1);
    const { res: r2 } = createMockRes();
    await handler({ method: 'POST', body: { ...baseValidBody, tenantSlug: 'cached-slug' } }, r2);

    const lookupCalls = executeMock.mock.calls.filter(([call]) => isTenantLookup((call as { sql: string }).sql));
    expect(lookupCalls).toHaveLength(1);
  });
});
