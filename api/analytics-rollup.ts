import { createTablesIfNeeded, getAnalyticsDb } from './_analyticsDb.js';

type NodeReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type NodeRes = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

const getHeader = (headers: NodeReq['headers'], name: string): string | null => {
  if (!headers) {
    return null;
  }
  const value = headers[name.toLowerCase()] ?? headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const requireAuthorizedCron = (request: NodeReq): boolean => {
  const expected = process.env.CRON_SECRET ?? process.env.ANALYTICS_CRON_SECRET;
  if (!expected) {
    return false;
  }
  const authHeader = getHeader(request.headers, 'authorization');
  if (authHeader === `Bearer ${expected}`) {
    return true;
  }
  const legacyHeader = getHeader(request.headers, 'x-analytics-cron-secret');
  return legacyHeader === expected;
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'POST' && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireAuthorizedCron(request)) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const day = utcDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const nextDay = utcDay(new Date(new Date(`${day}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000));

  try {
    await createTablesIfNeeded();
    const db = getAnalyticsDb();
    await db.execute({
      sql: `
        INSERT INTO analytics_rollup_daily (
          day_utc,
          app_opened_count,
          timer_created_count,
          timer_cloned_count,
          template_created_from_timer_count,
          timer_created_from_template_count,
          timer_run_completed_count,
          timer_run_incomplete_count,
          timer_run_coach_mode_count,
          timers_exported_count,
          timers_imported_count,
          timers_exported_total,
          timers_imported_total,
          total_timer_duration_sec_sum,
          station_count_sum,
          rounds_per_station_sum,
          work_sec_sum,
          rest_sec_sum,
          warmup_enabled_count,
          warmup_sec_sum,
          cooldown_enabled_count,
          cooldown_sec_sum
        )
        SELECT
          ? AS day_utc,
          SUM(CASE WHEN event_name = 'app_opened' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_created' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_cloned' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'template_created_from_timer' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_created_from_template' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_incomplete' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_coach_mode' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timers_exported' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timers_imported' THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timers_exported' THEN CAST(json_extract(payload_json, '$.timerCount') AS INTEGER) ELSE 0 END),
          SUM(CASE WHEN event_name = 'timers_imported' THEN CAST(json_extract(payload_json, '$.timerCount') AS INTEGER) ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' THEN
            CAST(json_extract(payload_json, '$.stationCount') AS INTEGER)
            * CAST(json_extract(payload_json, '$.roundsPerStation') AS INTEGER)
            * (CAST(json_extract(payload_json, '$.workSec') AS INTEGER) + CAST(json_extract(payload_json, '$.restSec') AS INTEGER))
            + ((CAST(json_extract(payload_json, '$.stationCount') AS INTEGER) - 1) * CAST(json_extract(payload_json, '$.transitionSec') AS INTEGER))
            + (CASE WHEN CAST(json_extract(payload_json, '$.warmupEnabled') AS INTEGER) = 1 THEN CAST(json_extract(payload_json, '$.warmupSec') AS INTEGER) ELSE 0 END)
            + (CASE WHEN CAST(json_extract(payload_json, '$.cooldownEnabled') AS INTEGER) = 1 THEN CAST(json_extract(payload_json, '$.cooldownSec') AS INTEGER) ELSE 0 END)
          ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' THEN CAST(json_extract(payload_json, '$.stationCount') AS INTEGER) ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' THEN CAST(json_extract(payload_json, '$.roundsPerStation') AS INTEGER) ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' THEN CAST(json_extract(payload_json, '$.workSec') AS INTEGER) ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' THEN CAST(json_extract(payload_json, '$.restSec') AS INTEGER) ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' AND CAST(json_extract(payload_json, '$.warmupEnabled') AS INTEGER) = 1 THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' AND CAST(json_extract(payload_json, '$.warmupEnabled') AS INTEGER) = 1 THEN CAST(json_extract(payload_json, '$.warmupSec') AS INTEGER) ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' AND CAST(json_extract(payload_json, '$.cooldownEnabled') AS INTEGER) = 1 THEN 1 ELSE 0 END),
          SUM(CASE WHEN event_name = 'timer_run_completed' AND CAST(json_extract(payload_json, '$.cooldownEnabled') AS INTEGER) = 1 THEN CAST(json_extract(payload_json, '$.cooldownSec') AS INTEGER) ELSE 0 END)
        FROM analytics_events
        WHERE occurred_at >= ? AND occurred_at < ?
        ON CONFLICT(day_utc) DO UPDATE SET
          app_opened_count = excluded.app_opened_count,
          timer_created_count = excluded.timer_created_count,
          timer_cloned_count = excluded.timer_cloned_count,
          template_created_from_timer_count = excluded.template_created_from_timer_count,
          timer_created_from_template_count = excluded.timer_created_from_template_count,
          timer_run_completed_count = excluded.timer_run_completed_count,
          timer_run_incomplete_count = excluded.timer_run_incomplete_count,
          timer_run_coach_mode_count = excluded.timer_run_coach_mode_count,
          timers_exported_count = excluded.timers_exported_count,
          timers_imported_count = excluded.timers_imported_count,
          timers_exported_total = excluded.timers_exported_total,
          timers_imported_total = excluded.timers_imported_total,
          total_timer_duration_sec_sum = excluded.total_timer_duration_sec_sum,
          station_count_sum = excluded.station_count_sum,
          rounds_per_station_sum = excluded.rounds_per_station_sum,
          work_sec_sum = excluded.work_sec_sum,
          rest_sec_sum = excluded.rest_sec_sum,
          warmup_enabled_count = excluded.warmup_enabled_count,
          warmup_sec_sum = excluded.warmup_sec_sum,
          cooldown_enabled_count = excluded.cooldown_enabled_count,
          cooldown_sec_sum = excluded.cooldown_sec_sum
      `,
      args: [`${day}`, `${day}T00:00:00.000Z`, `${nextDay}T00:00:00.000Z`],
    });

    await db.execute({
      sql: 'DELETE FROM analytics_events WHERE received_at < ?',
      args: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()],
    });

    response.status(200).json({ ok: true, dayRolledUp: day });
  } catch (error) {
    console.error('analytics-rollup failed', error);
    response.status(500).json({ error: 'Analytics rollup failed.' });
  }
}
