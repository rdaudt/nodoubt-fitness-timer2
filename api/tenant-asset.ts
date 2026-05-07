type NodeReq = {
  query?: Record<string, string | string[]>;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type NodeRes = {
  status: (code: number) => NodeRes;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: Buffer) => void;
};

const getSingleQueryValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';
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
    endpoint: 'tenant-asset',
    traceId,
    route,
    stage,
    ms: Math.round(valueMs),
    ...extra,
  });
};

const isAllowedTenantAssetUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sourceUrl = getSingleQueryValue(request.query?.url).trim();
  const traceId = getHeader(request.headers, 'x-perf-trace-id') || getSingleQueryValue(request.query?.traceId).trim();
  const route = getHeader(request.headers, 'x-perf-route') || getSingleQueryValue(request.query?.route).trim();
  const startedAt = Date.now();
  if (!sourceUrl || !isAllowedTenantAssetUrl(sourceUrl)) {
    response.status(400).json({ error: 'Invalid asset url.' });
    return;
  }

  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    const upstreamStarted = Date.now();
    const upstream = await fetch(sourceUrl, {
      headers: blobToken ? { Authorization: `Bearer ${blobToken}` } : undefined,
    });
    perfLog(traceId, route, 'upstream-fetch', Date.now() - upstreamStarted, { status: upstream.status });
    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'Unable to load asset.' });
      return;
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=300';
    const body = Buffer.from(await upstream.arrayBuffer());
    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', cacheControl);
    response.status(200).send(body);
    perfLog(traceId, route, 'total', Date.now() - startedAt, { bytes: body.length });
  } catch (error) {
    console.error('tenant-asset failed', error);
    response.status(500).json({ error: 'Failed to load asset.' });
  }
}
