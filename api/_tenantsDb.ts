import { createClient } from '@libsql/client/web';

let cachedClient: ReturnType<typeof createClient> | null = null;

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getTenantsDb = () => {
  if (cachedClient) {
    return cachedClient;
  }
  const url = requireEnv('TURSO_DATABASE_URL');
  const authToken = requireEnv('TURSO_AUTH_TOKEN');
  cachedClient = createClient({ url, authToken });
  return cachedClient;
};

export const createTenantTablesIfNeeded = async () => {
  const db = getTenantsDb();
  await db.batch([
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
    `CREATE INDEX IF NOT EXISTS idx_coach_tenants_slug_status ON coach_tenants (slug, status);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_social_links_tenant_sort ON coach_social_links (tenant_id, sort_order);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_templates_tenant_status_sort ON coach_templates (tenant_id, status, sort_order);`,
  ], 'write');
};
