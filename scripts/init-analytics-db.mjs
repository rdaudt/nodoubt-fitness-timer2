import { createClient } from '@libsql/client';

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const url = requireEnv('TURSO_DATABASE_URL');
const authToken = requireEnv('TURSO_AUTH_TOKEN');

const db = createClient({ url, authToken });

const statements = [
  `
    CREATE TABLE IF NOT EXISTS analytics_events (
      event_id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      tenant_slug TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      browser_family TEXT NOT NULL,
      os_family TEXT NOT NULL,
      os_version TEXT NOT NULL,
      device_type TEXT NOT NULL,
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
  `
    CREATE TABLE IF NOT EXISTS coach_tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      owner_google_sub TEXT NOT NULL UNIQUE,
      owner_email TEXT NOT NULL,
      business_name TEXT NOT NULL,
      coach_name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      logo_url TEXT NOT NULL DEFAULT '',
      coach_photo_url TEXT NOT NULL DEFAULT '',
      qr_code_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS coach_social_links (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS coach_templates (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      station_count INTEGER NOT NULL,
      station_workout_types_json TEXT NOT NULL DEFAULT '[]',
      rounds_per_station INTEGER NOT NULL,
      work_minutes INTEGER NOT NULL,
      work_seconds INTEGER NOT NULL,
      rest_minutes INTEGER NOT NULL,
      rest_seconds INTEGER NOT NULL,
      station_transition_minutes INTEGER NOT NULL,
      station_transition_seconds INTEGER NOT NULL,
      start_station_work_manually INTEGER NOT NULL DEFAULT 0,
      warmup_enabled INTEGER NOT NULL DEFAULT 0,
      warmup_minutes INTEGER NOT NULL DEFAULT 0,
      warmup_seconds INTEGER NOT NULL DEFAULT 0,
      cooldown_enabled INTEGER NOT NULL DEFAULT 0,
      cooldown_minutes INTEGER NOT NULL DEFAULT 0,
      cooldown_seconds INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS app_users (
      google_sub TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      picture_url TEXT NOT NULL DEFAULT '',
      is_coach INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_coach_tenants_slug_status ON coach_tenants (slug, status);`,
  `CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);`,
  `CREATE INDEX IF NOT EXISTS idx_coach_social_links_tenant_sort ON coach_social_links (tenant_id, sort_order);`,
  `CREATE INDEX IF NOT EXISTS idx_coach_templates_tenant_status_sort ON coach_templates (tenant_id, status, sort_order);`,
];

await db.batch(statements, 'write');
console.log('Analytics tables are ready.');
