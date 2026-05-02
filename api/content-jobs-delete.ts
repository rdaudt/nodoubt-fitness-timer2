import { del } from '@vercel/blob';
import { createTablesIfNeeded, getContentJobById, markJobDeleted, verifyJobAccess } from './_contentJobsDb.js';

type NodeReq = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type NodeRes = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const getString = (query: NodeReq['query'], key: string): string => {
  const value = query?.[key];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'DELETE') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const jobId = getString(request.query, 'jobId').trim();
  const token = getString(request.query, 'token').trim();
  if (!jobId || !token) {
    response.status(400).json({ error: 'Missing jobId or token.' });
    return;
  }

  try {
    await createTablesIfNeeded();
    const job = await getContentJobById(jobId);
    if (!job || !verifyJobAccess(job, token)) {
      response.status(404).json({ error: 'Job not found.' });
      return;
    }

    if (job.blobUrl) {
      await del(job.blobUrl);
    }
    await markJobDeleted(job.id);

    response.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    response.status(500).json({ error: message });
  }
}
