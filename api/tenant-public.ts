import { getTenantsDb } from './_tenantsDb.js';

type NodeReq = { query?: Record<string, string | string[]>; method?: string };
type NodeRes = { status: (code: number) => { json: (body: unknown) => void } };

const normalizeSlug = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');
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
  if (!slug) {
    response.status(400).json({ error: 'Missing slug.' });
    return;
  }
  try {
    const db = getTenantsDb();
    const tenantResult = await db.execute({
      sql: `
        SELECT id, slug, business_name, coach_name, bio, logo_url, coach_photo_url, qr_code_url
        FROM coach_tenants
        WHERE slug = ? AND status = 'published'
        LIMIT 1
      `,
      args: [slug],
    });
    const row = tenantResult.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      response.status(404).json({ error: 'Tenant not found.' });
      return;
    }
    const socialResult = await db.execute({
      sql: `
        SELECT label, url, sort_order
        FROM coach_social_links
        WHERE tenant_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `,
      args: [String(row.id)],
    });
    response.status(200).json({
      id: String(row.id),
      slug: String(row.slug),
      businessName: String(row.business_name ?? ''),
      coachName: String(row.coach_name ?? ''),
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
  } catch (error) {
    console.error('tenant-public failed', error);
    response.status(500).json({ error: 'Failed to load tenant profile.' });
  }
}
