import { createClient } from '@libsql/client/web';

let cachedClient: ReturnType<typeof createClient> | null = null;

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getAnalyticsDb = () => {
  if (cachedClient) {
    return cachedClient;
  }
  const url = requireEnv('TURSO_DATABASE_URL');
  const authToken = requireEnv('TURSO_AUTH_TOKEN');
  cachedClient = createClient({ url, authToken });
  return cachedClient;
};

export const createTablesIfNeeded = async () => {
  const db = getAnalyticsDb();
  await db.batch([
    `
      CREATE TABLE IF NOT EXISTS analytics_events (
        event_id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        browser_family TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `,
    `
      CREATE TABLE IF NOT EXISTS analytics_rollup_daily (
        day_utc TEXT PRIMARY KEY,
        app_opened_count INTEGER NOT NULL DEFAULT 0,
        timer_created_count INTEGER NOT NULL DEFAULT 0,
        timer_cloned_count INTEGER NOT NULL DEFAULT 0,
        template_created_from_timer_count INTEGER NOT NULL DEFAULT 0,
        timer_created_from_template_count INTEGER NOT NULL DEFAULT 0,
        timer_run_completed_count INTEGER NOT NULL DEFAULT 0,
        timer_run_incomplete_count INTEGER NOT NULL DEFAULT 0,
        timer_run_coach_mode_count INTEGER NOT NULL DEFAULT 0,
        timers_exported_count INTEGER NOT NULL DEFAULT 0,
        timers_imported_count INTEGER NOT NULL DEFAULT 0,
        timers_exported_total INTEGER NOT NULL DEFAULT 0,
        timers_imported_total INTEGER NOT NULL DEFAULT 0,
        total_timer_duration_sec_sum INTEGER NOT NULL DEFAULT 0,
        station_count_sum INTEGER NOT NULL DEFAULT 0,
        rounds_per_station_sum INTEGER NOT NULL DEFAULT 0,
        work_sec_sum INTEGER NOT NULL DEFAULT 0,
        rest_sec_sum INTEGER NOT NULL DEFAULT 0,
        warmup_enabled_count INTEGER NOT NULL DEFAULT 0,
        warmup_sec_sum INTEGER NOT NULL DEFAULT 0,
        cooldown_enabled_count INTEGER NOT NULL DEFAULT 0,
        cooldown_sec_sum INTEGER NOT NULL DEFAULT 0
      );
    `,
  ], 'write');

  const requiredRollupColumns = [
    `app_opened_count INTEGER NOT NULL DEFAULT 0`,
    `timer_created_count INTEGER NOT NULL DEFAULT 0`,
    `timer_cloned_count INTEGER NOT NULL DEFAULT 0`,
    `template_created_from_timer_count INTEGER NOT NULL DEFAULT 0`,
    `timer_created_from_template_count INTEGER NOT NULL DEFAULT 0`,
    `timer_run_completed_count INTEGER NOT NULL DEFAULT 0`,
    `timer_run_incomplete_count INTEGER NOT NULL DEFAULT 0`,
    `timer_run_coach_mode_count INTEGER NOT NULL DEFAULT 0`,
    `timers_exported_count INTEGER NOT NULL DEFAULT 0`,
    `timers_imported_count INTEGER NOT NULL DEFAULT 0`,
    `timers_exported_total INTEGER NOT NULL DEFAULT 0`,
    `timers_imported_total INTEGER NOT NULL DEFAULT 0`,
    `total_timer_duration_sec_sum INTEGER NOT NULL DEFAULT 0`,
    `station_count_sum INTEGER NOT NULL DEFAULT 0`,
    `rounds_per_station_sum INTEGER NOT NULL DEFAULT 0`,
    `work_sec_sum INTEGER NOT NULL DEFAULT 0`,
    `rest_sec_sum INTEGER NOT NULL DEFAULT 0`,
    `warmup_enabled_count INTEGER NOT NULL DEFAULT 0`,
    `warmup_sec_sum INTEGER NOT NULL DEFAULT 0`,
    `cooldown_enabled_count INTEGER NOT NULL DEFAULT 0`,
    `cooldown_sec_sum INTEGER NOT NULL DEFAULT 0`,
  ];

  for (const columnDef of requiredRollupColumns) {
    try {
      await db.execute(`ALTER TABLE analytics_rollup_daily ADD COLUMN ${columnDef}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes('duplicate column name')) {
        throw error;
      }
    }
  }
};
