import { createTenantTablesIfNeeded, getTenantsDb } from './_tenantsDb.js';

type NodeReq = { query?: Record<string, string | string[]>; method?: string };
type NodeRes = { status: (code: number) => { json: (body: unknown) => void } };

const normalizeSlug = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const parseWorkoutTypes = (value: unknown): string[] => {
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

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const slug = normalizeSlug(request.query?.slug);
  if (!slug) {
    response.status(400).json({ error: 'Missing slug.' });
    return;
  }
  try {
    await createTenantTablesIfNeeded();
    const db = getTenantsDb();
    const tenantResult = await db.execute({
      sql: `
        SELECT id
        FROM coach_tenants
        WHERE slug = ? AND status = 'published'
        LIMIT 1
      `,
      args: [slug],
    });
    const tenantRow = tenantResult.rows[0] as Record<string, unknown> | undefined;
    if (!tenantRow) {
      response.status(404).json([]);
      return;
    }
    const result = await db.execute({
      sql: `
        SELECT *
        FROM coach_templates
        WHERE tenant_id = ? AND status = 'published'
        ORDER BY sort_order ASC, updated_at DESC
      `,
      args: [String(tenantRow.id)],
    });
    response.status(200).json(result.rows.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name),
        stationCount: Number(row.station_count ?? 0),
        stationWorkoutTypes: parseWorkoutTypes(row.station_workout_types_json),
        roundsPerStation: Number(row.rounds_per_station ?? 1),
        workMinutes: Number(row.work_minutes ?? 0),
        workSeconds: Number(row.work_seconds ?? 0),
        restMinutes: Number(row.rest_minutes ?? 0),
        restSeconds: Number(row.rest_seconds ?? 0),
        stationTransitionMinutes: Number(row.station_transition_minutes ?? 0),
        stationTransitionSeconds: Number(row.station_transition_seconds ?? 0),
        startStationWorkManually: Number(row.start_station_work_manually ?? 0) === 1,
        warmupEnabled: Number(row.warmup_enabled ?? 0) === 1,
        warmupMinutes: Number(row.warmup_minutes ?? 0),
        warmupSeconds: Number(row.warmup_seconds ?? 0),
        cooldownEnabled: Number(row.cooldown_enabled ?? 0) === 1,
        cooldownMinutes: Number(row.cooldown_minutes ?? 0),
        cooldownSeconds: Number(row.cooldown_seconds ?? 0),
        createdAt: String(row.created_at ?? ''),
        updatedAt: String(row.updated_at ?? ''),
      };
    }));
  } catch (error) {
    console.error('tenant-templates failed', error);
    response.status(500).json({ error: 'Failed to load tenant templates.' });
  }
}
