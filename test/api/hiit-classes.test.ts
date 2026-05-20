import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();

vi.mock('../../api/_tenantsDb', () => ({
  getTenantsDb: vi.fn(() => ({
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

const coachUser = {
  sub: 'coach-sub',
  email: 'coach@example.com',
  name: 'Coach',
  picture: '',
  isCoach: true,
  coachSlug: 'fit-coach',
  coachOwnershipValid: true,
};

const classRow = {
  id: 'class-1',
  timer_id: 'timer-1',
  timer_name_at_run: 'Demo Timer',
  timer_snapshot_json: JSON.stringify({ id: 'timer-1', name: 'Demo Timer' }),
  station_workout_types_json: JSON.stringify(['Burpees']),
  total_per_station_ms: 30000,
  total_work_ms: 30000,
  category: 'GENERAL',
  complete: 1,
  ran_at: '2026-02-01T10:00:00.000Z',
  class_date: null,
  start_time: null,
  end_time: null,
  location_id: null,
  location_label_at_run: null,
  created_at: '2026-02-01T10:00:00.000Z',
  updated_at: '2026-02-01T10:00:00.000Z',
};

const tenantQuery = (sql: string) => /FROM coach_tenants/i.test(sql);
const locationsQuery = (sql: string) => /FROM coach_class_locations/i.test(sql);
const insertClass = (sql: string) => /INSERT INTO coach_hiit_classes/i.test(sql);
const updateClass = (sql: string) => /UPDATE coach_hiit_classes/i.test(sql);
const deleteClass = (sql: string) => /DELETE FROM coach_hiit_classes/i.test(sql);
const selectClass = (sql: string) => /SELECT \*[\s\S]*FROM coach_hiit_classes/i.test(sql);

describe('HIIT Classes API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeMock.mockImplementation(async (call: { sql: string }) => {
      if (tenantQuery(call.sql)) {
        return { rows: [{ id: 'tenant-1', slug: 'fit-coach' }] };
      }
      if (locationsQuery(call.sql)) {
        return { rows: [] };
      }
      if (selectClass(call.sql)) {
        return { rows: [classRow] };
      }
      return { rows: [], rowsAffected: 1 };
    });
  });

  it('returns 401 for unauthenticated class calls', async () => {
    const { handleHiitClasses } = await import('../../api/_hiitClasses');
    const { res, store } = createMockRes();

    await handleHiitClasses({ method: 'GET', query: { tenantSlug: 'fit-coach' } }, res, null);

    expect(store.statusCode).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated wrong-tenant calls', async () => {
    const { handleHiitClasses } = await import('../../api/_hiitClasses');
    const { res, store } = createMockRes();

    await handleHiitClasses({ method: 'GET', query: { tenantSlug: 'other-coach' } }, res, coachUser);

    expect(store.statusCode).toBe(403);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns only current tenant locations with formatted labels', async () => {
    executeMock.mockImplementation(async (call: { sql: string }) => {
      if (tenantQuery(call.sql)) {
        return { rows: [{ id: 'tenant-1', slug: 'fit-coach' }] };
      }
      if (locationsQuery(call.sql)) {
        return {
          rows: [
            {
              id: 'loc-1',
              business_name: 'No Doubt',
              location_name: 'Downtown',
              is_default: 1,
              sort_order: 2,
            },
          ],
        };
      }
      return { rows: [] };
    });
    const { handleClassLocations } = await import('../../api/_hiitClasses');
    const { res, store } = createMockRes();

    await handleClassLocations({ method: 'GET', query: { tenantSlug: 'fit-coach' } }, res, coachUser);

    expect(store.statusCode).toBe(200);
    expect(store.body).toEqual({
      locations: [{ id: 'loc-1', label: 'No Doubt - Downtown', isDefault: true, sortOrder: 2 }],
    });
  });

  it('creates a HIIT Class using the default location when available', async () => {
    executeMock.mockImplementation(async (call: { sql: string }) => {
      if (tenantQuery(call.sql)) {
        return { rows: [{ id: 'tenant-1', slug: 'fit-coach' }] };
      }
      if (locationsQuery(call.sql)) {
        return { rows: [{ id: 'loc-1', business_name: 'No Doubt', location_name: 'Main' }] };
      }
      if (selectClass(call.sql)) {
        return { rows: [{ ...classRow, location_id: 'loc-1', location_label_at_run: 'No Doubt - Main' }] };
      }
      return { rows: [], rowsAffected: 1 };
    });
    const { handleHiitClasses } = await import('../../api/_hiitClasses');
    const { res, store } = createMockRes();

    await handleHiitClasses({
      method: 'POST',
      query: { tenantSlug: 'fit-coach' },
      body: {
        run: {
          id: 'class-1',
          timerId: 'timer-1',
          timerNameAtRun: 'Demo Timer',
          timerSnapshot: { id: 'timer-1', name: 'Demo Timer' },
          stationWorkoutTypes: ['Burpees'],
          totalPerStationMs: 30000,
          totalWorkMs: 30000,
          complete: true,
          ranAt: '2026-02-01T10:00:00.000Z',
          createdAt: '2026-02-01T10:00:00.000Z',
        },
      },
    }, res, coachUser);

    expect(store.statusCode).toBe(201);
    const insert = executeMock.mock.calls.find(([call]) => insertClass((call as { sql: string }).sql));
    expect(insert).toBeDefined();
    const args = (insert![0] as { args: unknown[] }).args;
    expect(args[12]).toBe('loc-1');
    expect(args[13]).toBe('No Doubt - Main');
  });

  it('patch clears nullable class date, time, and location fields', async () => {
    const { handleHiitClasses } = await import('../../api/_hiitClasses');
    const { res, store } = createMockRes();

    await handleHiitClasses({
      method: 'PATCH',
      query: { tenantSlug: 'fit-coach', id: 'class-1' },
      body: { classDate: null, startTime: null, endTime: null, locationId: null },
    }, res, coachUser);

    expect(store.statusCode).toBe(200);
    const update = executeMock.mock.calls.find(([call]) => updateClass((call as { sql: string }).sql));
    expect(update).toBeDefined();
    expect((update![0] as { args: unknown[] }).args.slice(0, 5)).toEqual([null, null, null, null, null]);
  });

  it('deletes only a class owned by the current coach tenant', async () => {
    const { handleHiitClasses } = await import('../../api/_hiitClasses');
    const { res, store } = createMockRes();

    await handleHiitClasses({
      method: 'DELETE',
      query: { tenantSlug: 'fit-coach', id: 'class-1' },
    }, res, coachUser);

    expect(store.statusCode).toBe(200);
    const deletion = executeMock.mock.calls.find(([call]) => deleteClass((call as { sql: string }).sql));
    expect(deletion).toBeDefined();
    expect((deletion![0] as { args: unknown[] }).args).toEqual(['tenant-1', 'coach-sub', 'class-1']);
  });
});
