import type { SessionUser } from './_auth.js';
import { getTenantsDb } from './_tenantsDb.js';

type QueryValue = string | string[] | undefined;

export type NodeReqWithBody = {
  method?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
};

export type NodeResJson = {
  status: (code: number) => { json: (body: unknown) => void };
};

type TenantRow = {
  id: string;
  slug: string;
};

class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const firstQueryValue = (value: QueryValue): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
};

const normalizeSlug = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const normalizeDate = (value: unknown): string | null => {
  if (value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, 'Invalid class date.');
  }
  return value;
};

const normalizeTime = (value: unknown, fieldName: string): string | null => {
  if (value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    throw new ApiError(400, `Invalid ${fieldName}.`);
  }
  return value;
};

const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return typeof value === 'string' ? value.trim() || null : null;
};

const requiredString = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, message);
  }
  return value.trim();
};

const requiredFiniteNumber = (value: unknown, message: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, message);
  }
  return Math.max(0, Math.floor(parsed));
};

const parseJsonArray = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
};

const parseRequestBody = (body: unknown): Record<string, unknown> => {
  if (!body) {
    return {};
  }
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown;
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      throw new ApiError(400, 'Invalid JSON body.');
    }
  }
  return typeof body === 'object' ? body as Record<string, unknown> : {};
};

const classLocationLabel = (row: Record<string, unknown>): string => {
  const businessName = String(row.business_name ?? '').trim();
  const locationName = String(row.location_name ?? '').trim();
  return businessName ? `${businessName} - ${locationName}` : locationName;
};

const authorizeCoachTenant = async (request: NodeReqWithBody, user: SessionUser | null): Promise<TenantRow> => {
  if (!user?.sub) {
    throw new ApiError(401, 'Unauthorized');
  }
  const tenantSlug = normalizeSlug(firstQueryValue(request.query?.tenantSlug));
  if (!tenantSlug) {
    throw new ApiError(400, 'Missing tenant slug.');
  }
  if (!user.coachOwnershipValid || (user.coachSlug ?? '').trim().toLowerCase() !== tenantSlug) {
    throw new ApiError(403, 'Forbidden');
  }

  const db = getTenantsDb();
  const result = await db.execute({
    sql: `
      SELECT id, slug
      FROM coach_tenants
      WHERE slug = ? AND owner_google_sub = ?
      LIMIT 1
    `,
    args: [tenantSlug, user.sub],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row?.id) {
    throw new ApiError(403, 'Forbidden');
  }
  return {
    id: String(row.id),
    slug: String(row.slug ?? tenantSlug),
  };
};

const serializeHiitClass = (row: Record<string, unknown>) => ({
  id: String(row.id),
  timerId: String(row.timer_id),
  timerNameAtRun: String(row.timer_name_at_run),
  timerSnapshot: typeof row.timer_snapshot_json === 'string' ? JSON.parse(row.timer_snapshot_json) : {},
  stationWorkoutTypes: parseJsonArray(row.station_workout_types_json),
  totalPerStationMs: Number(row.total_per_station_ms ?? 0),
  totalWorkMs: Number(row.total_work_ms ?? 0),
  category: String(row.category ?? 'GENERAL'),
  complete: Number(row.complete ?? 0) === 1,
  ranAt: String(row.ran_at),
  classDate: row.class_date === null || row.class_date === undefined ? null : String(row.class_date),
  startTime: row.start_time === null || row.start_time === undefined ? null : String(row.start_time),
  endTime: row.end_time === null || row.end_time === undefined ? null : String(row.end_time),
  locationId: row.location_id === null || row.location_id === undefined ? null : String(row.location_id),
  locationLabelAtRun: row.location_label_at_run === null || row.location_label_at_run === undefined ? null : String(row.location_label_at_run),
  location: row.location_label_at_run === null || row.location_label_at_run === undefined ? '' : String(row.location_label_at_run),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const listLocations = async (tenantId: string) => {
  const db = getTenantsDb();
  const result = await db.execute({
    sql: `
      SELECT id, business_name, location_name, is_default, sort_order
      FROM coach_class_locations
      WHERE tenant_id = ?
      ORDER BY sort_order ASC, lower(business_name) ASC, lower(location_name) ASC
    `,
    args: [tenantId],
  });
  return result.rows.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id),
      label: classLocationLabel(row),
      isDefault: Number(row.is_default ?? 0) === 1,
      sortOrder: Number(row.sort_order ?? 0),
    };
  });
};

const getDefaultLocation = async (tenantId: string): Promise<{ id: string; label: string } | null> => {
  const db = getTenantsDb();
  const result = await db.execute({
    sql: `
      SELECT id, business_name, location_name
      FROM coach_class_locations
      WHERE tenant_id = ? AND is_default = 1
      ORDER BY sort_order ASC, lower(business_name) ASC, lower(location_name) ASC
      LIMIT 1
    `,
    args: [tenantId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row?.id ? { id: String(row.id), label: classLocationLabel(row) } : null;
};

const getLocationById = async (tenantId: string, locationId: string | null): Promise<{ id: string; label: string } | null> => {
  if (!locationId) {
    return null;
  }
  const db = getTenantsDb();
  const result = await db.execute({
    sql: `
      SELECT id, business_name, location_name
      FROM coach_class_locations
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
    `,
    args: [tenantId, locationId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row?.id ? { id: String(row.id), label: classLocationLabel(row) } : null;
};

const handleError = (response: NodeResJson, error: unknown) => {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  throw error;
};

export const handleClassLocations = async (
  request: NodeReqWithBody,
  response: NodeResJson,
  user: SessionUser | null,
): Promise<void> => {
  try {
    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const tenant = await authorizeCoachTenant(request, user);
    response.status(200).json({ locations: await listLocations(tenant.id) });
  } catch (error) {
    handleError(response, error);
  }
};

export const handleHiitClasses = async (
  request: NodeReqWithBody,
  response: NodeResJson,
  user: SessionUser | null,
): Promise<void> => {
  try {
    const tenant = await authorizeCoachTenant(request, user);
    const db = getTenantsDb();

    if (request.method === 'GET') {
      const result = await db.execute({
        sql: `
          SELECT *
          FROM coach_hiit_classes
          WHERE tenant_id = ?
          ORDER BY COALESCE(class_date || 'T' || COALESCE(start_time, '00:00'), ran_at) DESC, ran_at DESC
        `,
        args: [tenant.id],
      });
      response.status(200).json({ classes: result.rows.map((row) => serializeHiitClass(row as Record<string, unknown>)) });
      return;
    }

    if (request.method === 'POST') {
      const body = parseRequestBody(request.body);
      const run = body.run && typeof body.run === 'object' ? body.run as Record<string, unknown> : body;
      const now = new Date().toISOString();
      const defaultLocation = await getDefaultLocation(tenant.id);
      const id = requiredString(run.id, 'Missing class id.');
      await db.execute({
        sql: `
          INSERT INTO coach_hiit_classes (
            id,
            tenant_id,
            coach_google_sub,
            timer_id,
            timer_name_at_run,
            timer_snapshot_json,
            station_workout_types_json,
            total_per_station_ms,
            total_work_ms,
            category,
            complete,
            ran_at,
            class_date,
            start_time,
            end_time,
            location_id,
            location_label_at_run,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
        `,
        args: [
          id,
          tenant.id,
          user?.sub ?? '',
          requiredString(run.timerId, 'Missing timer id.'),
          requiredString(run.timerNameAtRun, 'Missing timer name.'),
          JSON.stringify(run.timerSnapshot ?? {}),
          JSON.stringify(Array.isArray(run.stationWorkoutTypes) ? run.stationWorkoutTypes : []),
          requiredFiniteNumber(run.totalPerStationMs, 'Missing total per-station duration.'),
          requiredFiniteNumber(run.totalWorkMs, 'Missing total work duration.'),
          typeof run.category === 'string' ? run.category : 'GENERAL',
          run.complete ? 1 : 0,
          requiredString(run.ranAt, 'Missing run timestamp.'),
          now.slice(0, 10),
          defaultLocation?.id ?? null,
          defaultLocation?.label ?? null,
          typeof run.createdAt === 'string' ? run.createdAt : now,
          now,
        ],
      });
      const result = await db.execute({
        sql: `SELECT * FROM coach_hiit_classes WHERE tenant_id = ? AND id = ? LIMIT 1`,
        args: [tenant.id, id],
      });
      response.status(201).json({ class: serializeHiitClass(result.rows[0] as Record<string, unknown>) });
      return;
    }

    if (request.method === 'PATCH') {
      const id = firstQueryValue(request.query?.id);
      if (!id) {
        response.status(400).json({ error: 'Missing class id.' });
        return;
      }
      const body = parseRequestBody(request.body);
      const classDate = normalizeDate(body.classDate);
      const startTime = normalizeTime(body.startTime, 'start time');
      const endTime = normalizeTime(body.endTime, 'end time');
      const requestedLocationId = optionalString(body.locationId);
      const location = await getLocationById(tenant.id, requestedLocationId);
      if (requestedLocationId && !location) {
        response.status(400).json({ error: 'Invalid location.' });
        return;
      }
      const now = new Date().toISOString();
      await db.execute({
        sql: `
          UPDATE coach_hiit_classes
          SET class_date = ?,
              start_time = ?,
              end_time = ?,
              location_id = ?,
              location_label_at_run = ?,
              updated_at = ?
          WHERE tenant_id = ? AND coach_google_sub = ? AND id = ?
        `,
        args: [
          classDate,
          startTime,
          endTime,
          location?.id ?? null,
          location?.label ?? null,
          now,
          tenant.id,
          user?.sub ?? '',
          id,
        ],
      });
      const result = await db.execute({
        sql: `SELECT * FROM coach_hiit_classes WHERE tenant_id = ? AND id = ? LIMIT 1`,
        args: [tenant.id, id],
      });
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        response.status(404).json({ error: 'HIIT Class not found.' });
        return;
      }
      response.status(200).json({ class: serializeHiitClass(row) });
      return;
    }

    if (request.method === 'DELETE') {
      const id = firstQueryValue(request.query?.id);
      if (!id) {
        response.status(400).json({ error: 'Missing class id.' });
        return;
      }
      await db.execute({
        sql: `
          DELETE FROM coach_hiit_classes
          WHERE tenant_id = ? AND coach_google_sub = ? AND id = ?
        `,
        args: [tenant.id, user?.sub ?? '', id],
      });
      response.status(200).json({ ok: true });
      return;
    }

    response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    handleError(response, error);
  }
};
