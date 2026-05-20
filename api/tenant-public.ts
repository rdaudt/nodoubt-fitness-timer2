import { getTenantsDb } from './_tenantsDb.js';

type NodeReq = {
  query?: Record<string, string | string[]>;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader: (name: string, value: string) => void;
};

const normalizeSlug = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const normalizePositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.floor(parsed)));
};
const getHeader = (headers: NodeReq['headers'], name: string): string => {
  if (!headers) {
    return '';
  }
  const raw = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
};
const perfEnabled = process.env.PERF_TRIAGE_ENABLED === '1';
const perfLog = (traceId: string, route: string, stage: string, valueMs: number, extra?: Record<string, unknown>) => {
  if (!perfEnabled) {
    return;
  }
  console.log('[perf-triage-api]', {
    endpoint: 'tenant-public',
    traceId,
    route,
    stage,
    ms: Math.round(valueMs),
    ...extra,
  });
};
const normalizeAssetUrl = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return '';
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') {
      return '';
    }
    if (parsed.hostname.endsWith('.blob.vercel-storage.com')) {
      return `/api/tenant-asset?url=${encodeURIComponent(parsed.toString())}`;
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const slug = normalizeSlug(request.query?.slug);
  const view = normalizeString(request.query?.view).toLowerCase();
  const traceId = getHeader(request.headers, 'x-perf-trace-id');
  const route = getHeader(request.headers, 'x-perf-route');
  const startedAt = Date.now();
  try {
    const db = getTenantsDb();
    if (view === 'directory') {
      const query = normalizeString(request.query?.query).slice(0, 80);
      const page = normalizePositiveInt(request.query?.page, 1, 999);
      const pageSize = normalizePositiveInt(request.query?.pageSize, 12, 50);
      const offset = (page - 1) * pageSize;
      const search = `%${query.toLowerCase()}%`;
      const dbStart = Date.now();
      const countResult = await db.execute({
        sql: `
          SELECT COUNT(*) AS count
          FROM coach_tenants
          WHERE status = 'published'
            AND (
              LOWER(coach_name) LIKE ?
              OR LOWER(business_name) LIKE ?
            )
        `,
        args: [search, search],
      });
      const total = Number((countResult.rows[0] as Record<string, unknown> | undefined)?.count ?? 0) || 0;
      const listResult = await db.execute({
        sql: `
          SELECT slug, coach_name, business_name, coach_photo_url, ig_username, created_at
          FROM coach_tenants
          WHERE status = 'published'
            AND (
              LOWER(coach_name) LIKE ?
              OR LOWER(business_name) LIKE ?
            )
          ORDER BY coach_name ASC, business_name ASC, created_at ASC
          LIMIT ? OFFSET ?
        `,
        args: [search, search, pageSize, offset],
      });
      perfLog(traceId, route, 'directory-query', Date.now() - dbStart, { total, returned: listResult.rows.length });
      response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      response.status(200).json({
        items: listResult.rows.map((item) => ({
          slug: String((item as Record<string, unknown>).slug ?? ''),
          coachName: String((item as Record<string, unknown>).coach_name ?? ''),
          businessName: String((item as Record<string, unknown>).business_name ?? ''),
          coachPhotoUrl: normalizeAssetUrl((item as Record<string, unknown>).coach_photo_url),
          igUsername: String((item as Record<string, unknown>).ig_username ?? ''),
        })),
        page,
        pageSize,
        total,
        hasNextPage: offset + listResult.rows.length < total,
      });
      perfLog(traceId, route, 'total', Date.now() - startedAt);
      return;
    }
    if (!slug) {
      response.status(400).json({ error: 'Missing slug.' });
      return;
    }
    const dbStart = Date.now();
    const tenantResult = await db.execute({
      sql: `
        SELECT id, slug, business_name, coach_name, header_tagline, ig_username, bio, logo_url, coach_photo_url, qr_code_url
        FROM coach_tenants
        WHERE slug = ? AND status = 'published'
        LIMIT 1
      `,
      args: [slug],
    });
    perfLog(traceId, route, 'tenant-query', Date.now() - dbStart, { found: tenantResult.rows.length > 0 });
    const row = tenantResult.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      response.status(404).json({ error: 'Tenant not found.' });
      return;
    }
    const socialStart = Date.now();
    const socialResult = await db.execute({
      sql: `
        SELECT label, url, sort_order
        FROM coach_social_links
        WHERE tenant_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `,
      args: [String(row.id)],
    });
    perfLog(traceId, route, 'social-query', Date.now() - socialStart, { socialCount: socialResult.rows.length });
    response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
    response.status(200).json({
      id: String(row.id),
      slug: String(row.slug),
      businessName: String(row.business_name ?? ''),
      coachName: String(row.coach_name ?? ''),
      headerTagline: String(row.header_tagline ?? ''),
      igUsername: String(row.ig_username ?? ''),
      bio: String(row.bio ?? ''),
      logoUrl: normalizeAssetUrl(row.logo_url),
      coachPhotoUrl: normalizeAssetUrl(row.coach_photo_url),
      qrCodeUrl: normalizeAssetUrl(row.qr_code_url),
      socialLinks: socialResult.rows.map((item) => ({
        label: String((item as Record<string, unknown>).label ?? ''),
        url: String((item as Record<string, unknown>).url ?? ''),
        sortOrder: Number((item as Record<string, unknown>).sort_order ?? 0),
      })),
    });
    perfLog(traceId, route, 'total', Date.now() - startedAt);
  } catch (error) {
    console.error('tenant-public failed', error);
    response.status(500).json({ error: 'Failed to load tenant profile.' });
  }
}
