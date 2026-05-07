type NodeReq = { query?: Record<string, string | string[]>; method?: string };
type NodeRes = {
  status: (code: number) => NodeRes;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: Buffer) => void;
};

const getSingleQueryValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

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
  if (!sourceUrl || !isAllowedTenantAssetUrl(sourceUrl)) {
    response.status(400).json({ error: 'Invalid asset url.' });
    return;
  }

  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    const upstream = await fetch(sourceUrl, {
      headers: blobToken ? { Authorization: `Bearer ${blobToken}` } : undefined,
    });
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
  } catch (error) {
    console.error('tenant-asset failed', error);
    response.status(500).json({ error: 'Failed to load asset.' });
  }
}
