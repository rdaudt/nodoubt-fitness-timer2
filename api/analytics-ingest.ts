import { createTablesIfNeeded, getAnalyticsDb } from './_analyticsDb.js';
import { validateIngestBody } from './_analyticsSchema.js';

type NodeReq = {
  method?: string;
  body?: unknown;
};

type NodeRes = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const parseBody = (body: unknown): unknown => {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
};

const TENANT_ID_CACHE_TTL_MS = 5 * 60 * 1000;
const tenantIdCache = new Map<string, { id: string; expiresAt: number }>();

const resolveTenantId = async (slug: string): Promise<string> => {
  if (!slug) {
    return '';
  }
  const now = Date.now();
  const cached = tenantIdCache.get(slug);
  if (cached && cached.expiresAt > now) {
    return cached.id;
  }
  try {
    const db = getAnalyticsDb();
    const result = await db.execute({
      sql: `SELECT id FROM coach_tenants WHERE slug = ? LIMIT 1`,
      args: [slug],
    });
    const row = result.rows[0] as { id?: unknown } | undefined;
    const id = row && typeof row.id === 'string' ? row.id : '';
    tenantIdCache.set(slug, { id, expiresAt: now + TENANT_ID_CACHE_TTL_MS });
    return id;
  } catch {
    return '';
  }
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const parsed = validateIngestBody(parseBody(request.body));
  if (!parsed) {
    response.status(400).json({ error: 'Invalid analytics payload.' });
    return;
  }

  try {
    await createTablesIfNeeded();
    const tenantId = await resolveTenantId(parsed.tenantSlug);
    const db = getAnalyticsDb();
    await db.execute({
      sql: `
        INSERT INTO analytics_events (
          event_id,
          event_name,
          tenant_slug,
          tenant_id,
          occurred_at,
          received_at,
          browser_family,
          os_family,
          os_version,
          device_type,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        parsed.eventName,
        parsed.tenantSlug,
        tenantId,
        parsed.occurredAt,
        new Date().toISOString(),
        parsed.browserFamily,
        parsed.osFamily,
        parsed.osVersion,
        parsed.deviceType,
        JSON.stringify(parsed.payload),
      ],
    });
    response.status(202).json({ ok: true });
  } catch (error) {
    console.error('analytics-ingest failed', error);
    response.status(500).json({ error: 'Analytics ingest failed.' });
  }
}
