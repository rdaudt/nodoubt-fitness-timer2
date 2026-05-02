import { put } from '@vercel/blob';
import {
  claimJob,
  completeJob,
  createTablesIfNeeded,
  failJobAttempt,
  findQueuedJobs,
} from './_contentJobsDb.js';
import { generateImageBase64 } from './_igGeneration.js';

type NodeReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type NodeRes = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const MAX_BATCH = 2;

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

const isAuthorized = (request: NodeReq): boolean => {
  const expected = process.env.CRON_SECRET ?? process.env.ANALYTICS_CRON_SECRET;
  if (!expected) {
    return false;
  }
  const authHeader = getHeader(request.headers, 'authorization');
  return authHeader === `Bearer ${expected}`;
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'POST' && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isAuthorized(request)) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await createTablesIfNeeded();
    const queuedJobs = await findQueuedJobs(MAX_BATCH);
    let processed = 0;

    for (const job of queuedJobs) {
      const acquired = await claimJob(job.id);
      if (!acquired) {
        continue;
      }
      processed += 1;
      try {
        const runPayload = JSON.parse(job.payloadJson) as Parameters<typeof generateImageBase64>[0];
        const imageBase64 = await generateImageBase64(runPayload);
        const imageBytes = Buffer.from(imageBase64, 'base64');
        const pathname = `generated/ig/${job.id}.png`;
        const blob = await put(pathname, imageBytes, {
          access: 'public',
          contentType: 'image/png',
          addRandomSuffix: false,
        });
        await completeJob(job.id, blob.url, pathname);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed.';
        await failJobAttempt(job.id, job.attemptCount, job.maxAttempts, message);
      }
    }

    response.status(200).json({
      ok: true,
      queued: queuedJobs.length,
      processed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    response.status(500).json({ error: message });
  }
}
