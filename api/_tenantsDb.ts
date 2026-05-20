import { createClient } from '@libsql/client/web';

let cachedClient: ReturnType<typeof createClient> | null = null;
let tenantTablesPromise: Promise<void> | null = null;

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

type TenantsDb = ReturnType<typeof getTenantsDb>;
type ManagedTable = 'coach_class_locations' | 'coach_hiit_classes';

const getExistingColumns = async (db: TenantsDb, tableName: ManagedTable): Promise<Set<string>> => {
  const result = await db.execute({
    sql: `PRAGMA table_info(${tableName})`,
    args: [],
  });
  return new Set(result.rows.map((row) => String((row as Record<string, unknown>).name ?? '')));
};

const isDuplicateColumnError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const cause = error instanceof Error ? String((error as { cause?: unknown }).cause ?? '') : '';
  return /duplicate column name/i.test(`${message} ${cause}`);
};

const addMissingColumns = async (
  db: TenantsDb,
  tableName: ManagedTable,
  columns: Array<{ name: string; definition: string }>,
): Promise<void> => {
  const existing = await getExistingColumns(db, tableName);
  for (const column of columns) {
    if (!existing.has(column.name)) {
      try {
        await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${column.definition}`);
        existing.add(column.name);
      } catch (error) {
        if (!isDuplicateColumnError(error)) {
          throw error;
        }
        existing.add(column.name);
      }
    }
  }
};

const createTenantTables = async () => {
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
      CREATE TABLE IF NOT EXISTS coach_class_locations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        business_name TEXT NOT NULL DEFAULT '',
        location_name TEXT NOT NULL,
        logo_url TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    `
      CREATE TABLE IF NOT EXISTS coach_hiit_classes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        coach_google_sub TEXT NOT NULL,
        timer_id TEXT NOT NULL,
        timer_name_at_run TEXT NOT NULL,
        timer_snapshot_json TEXT NOT NULL,
        station_workout_types_json TEXT NOT NULL DEFAULT '[]',
        total_per_station_ms INTEGER NOT NULL,
        total_work_ms INTEGER NOT NULL,
        category TEXT NOT NULL DEFAULT 'GENERAL',
        complete INTEGER NOT NULL DEFAULT 0,
        ran_at TEXT NOT NULL,
        class_date TEXT,
        start_time TEXT,
        end_time TEXT,
        location_id TEXT,
        location_label_at_run TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_coach_tenants_slug_status ON coach_tenants (slug, status);`,
    `CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_social_links_tenant_sort ON coach_social_links (tenant_id, sort_order);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_templates_tenant_status_sort ON coach_templates (tenant_id, status, sort_order);`,
  ], 'write');

  await addMissingColumns(db, 'coach_class_locations', [
    { name: 'business_name', definition: `business_name TEXT NOT NULL DEFAULT ''` },
    { name: 'location_name', definition: `location_name TEXT NOT NULL DEFAULT ''` },
    { name: 'logo_url', definition: `logo_url TEXT NOT NULL DEFAULT ''` },
    { name: 'is_default', definition: `is_default INTEGER NOT NULL DEFAULT 0` },
    { name: 'sort_order', definition: `sort_order INTEGER NOT NULL DEFAULT 0` },
    { name: 'created_at', definition: `created_at TEXT NOT NULL DEFAULT ''` },
    { name: 'updated_at', definition: `updated_at TEXT NOT NULL DEFAULT ''` },
  ]);
  await addMissingColumns(db, 'coach_hiit_classes', [
    { name: 'coach_google_sub', definition: `coach_google_sub TEXT NOT NULL DEFAULT ''` },
    { name: 'timer_id', definition: `timer_id TEXT NOT NULL DEFAULT ''` },
    { name: 'timer_name_at_run', definition: `timer_name_at_run TEXT NOT NULL DEFAULT ''` },
    { name: 'timer_snapshot_json', definition: `timer_snapshot_json TEXT NOT NULL DEFAULT '{}'` },
    { name: 'station_workout_types_json', definition: `station_workout_types_json TEXT NOT NULL DEFAULT '[]'` },
    { name: 'total_per_station_ms', definition: `total_per_station_ms INTEGER NOT NULL DEFAULT 0` },
    { name: 'total_work_ms', definition: `total_work_ms INTEGER NOT NULL DEFAULT 0` },
    { name: 'category', definition: `category TEXT NOT NULL DEFAULT 'GENERAL'` },
    { name: 'complete', definition: `complete INTEGER NOT NULL DEFAULT 0` },
    { name: 'ran_at', definition: `ran_at TEXT NOT NULL DEFAULT ''` },
    { name: 'class_date', definition: `class_date TEXT` },
    { name: 'start_time', definition: `start_time TEXT` },
    { name: 'end_time', definition: `end_time TEXT` },
    { name: 'location_id', definition: `location_id TEXT` },
    { name: 'location_label_at_run', definition: `location_label_at_run TEXT` },
    { name: 'created_at', definition: `created_at TEXT NOT NULL DEFAULT ''` },
    { name: 'updated_at', definition: `updated_at TEXT NOT NULL DEFAULT ''` },
  ]);

  await db.batch([
    `CREATE INDEX IF NOT EXISTS idx_coach_class_locations_tenant_sort ON coach_class_locations (tenant_id, sort_order);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_hiit_classes_tenant_ran_at ON coach_hiit_classes (tenant_id, ran_at);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_hiit_classes_tenant_class_time ON coach_hiit_classes (tenant_id, class_date, start_time);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_hiit_classes_location ON coach_hiit_classes (location_id);`,
  ], 'write');
};

export const createTenantTablesIfNeeded = async () => {
  if (!tenantTablesPromise) {
    tenantTablesPromise = createTenantTables().catch((error) => {
      tenantTablesPromise = null;
      throw error;
    });
  }
  await tenantTablesPromise;
};
