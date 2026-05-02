import { createContentJob, createTablesIfNeeded } from './_contentJobsDb.js';
import { processPendingJobs } from './content-jobs-process.js';
import { validatePayload } from './_igGeneration.js';

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

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const parsedBody = parseBody(request.body);
  const payload = validatePayload(parsedBody);
  if (!payload) {
    response.status(400).json({ error: 'Invalid request payload.' });
    return;
  }

  try {
    await createTablesIfNeeded();
    const job = await createContentJob(payload.run.id, payload.run);
    void processPendingJobs(1).catch(() => undefined);
    response.status(200).json({
      jobId: job.id,
      token: job.viewToken,
      status: 'queued',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    response.status(500).json({ error: message });
  }
}
