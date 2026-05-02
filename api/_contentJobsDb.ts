import { createClient } from '@libsql/client/web';
import { createHash, randomBytes } from 'node:crypto';
import type { GenerationRunPayload } from './_igGeneration.js';

let cachedClient: ReturnType<typeof createClient> | null = null;

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getContentJobsDb = () => {
  if (cachedClient) {
    return cachedClient;
  }
  const url = requireEnv('TURSO_DATABASE_URL');
  const authToken = requireEnv('TURSO_AUTH_TOKEN');
  cachedClient = createClient({ url, authToken });
  return cachedClient;
};

export type ContentJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'deleted';

export type ContentJobRow = {
  id: string;
  runId: string;
  payloadJson: string;
  status: ContentJobStatus;
  attemptCount: number;
  maxAttempts: number;
  errorMessage: string | null;
  blobUrl: string | null;
  blobPathname: string | null;
  viewTokenHash: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

const mapRow = (row: Record<string, unknown>): ContentJobRow => ({
  id: String(row.id),
  runId: String(row.run_id),
  payloadJson: String(row.payload_json),
  status: String(row.status) as ContentJobStatus,
  attemptCount: Number(row.attempt_count ?? 0),
  maxAttempts: Number(row.max_attempts ?? 3),
  errorMessage: row.error_message ? String(row.error_message) : null,
  blobUrl: row.blob_url ? String(row.blob_url) : null,
  blobPathname: row.blob_pathname ? String(row.blob_pathname) : null,
  viewTokenHash: String(row.view_token_hash),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  completedAt: row.completed_at ? String(row.completed_at) : null,
  deletedAt: row.deleted_at ? String(row.deleted_at) : null,
});

export const hashViewToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const createTablesIfNeeded = async () => {
  const db = getContentJobsDb();
  await db.batch([
    `
      CREATE TABLE IF NOT EXISTS content_jobs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        error_message TEXT,
        blob_url TEXT,
        blob_pathname TEXT,
        view_token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        deleted_at TEXT
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_content_jobs_status_updated ON content_jobs (status, updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_content_jobs_run_id_created ON content_jobs (run_id, created_at DESC);`,
  ], 'write');
};

export const createContentJob = async (runId: string, runPayload: GenerationRunPayload) => {
  const db = getContentJobsDb();
  const now = new Date().toISOString();
  const id = randomBytes(16).toString('hex');
  const viewToken = randomBytes(24).toString('base64url');
  const viewTokenHash = hashViewToken(viewToken);

  await db.execute({
    sql: `
      INSERT INTO content_jobs (
        id, run_id, payload_json, status, attempt_count, max_attempts,
        error_message, blob_url, blob_pathname, view_token_hash,
        created_at, updated_at, completed_at, deleted_at
      ) VALUES (?, ?, ?, 'queued', 0, 3, NULL, NULL, NULL, ?, ?, ?, NULL, NULL)
    `,
    args: [id, runId, JSON.stringify(runPayload), viewTokenHash, now, now],
  });

  return { id, viewToken };
};

export const getContentJobById = async (jobId: string): Promise<ContentJobRow | null> => {
  const db = getContentJobsDb();
  const result = await db.execute({
    sql: `SELECT * FROM content_jobs WHERE id = ? LIMIT 1`,
    args: [jobId],
  });
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return mapRow(row as Record<string, unknown>);
};

export const verifyJobAccess = (job: ContentJobRow, rawToken: string): boolean => {
  const token = rawToken.trim();
  if (!token) {
    return false;
  }
  return hashViewToken(token) === job.viewTokenHash;
};

export const markJobDeleted = async (jobId: string) => {
  const db = getContentJobsDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE content_jobs SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?`,
    args: [now, now, jobId],
  });
};

export const findQueuedJobs = async (limit: number): Promise<ContentJobRow[]> => {
  const db = getContentJobsDb();
  const result = await db.execute({
    sql: `
      SELECT * FROM content_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
};

export const claimJob = async (jobId: string): Promise<boolean> => {
  const db = getContentJobsDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `
      UPDATE content_jobs
      SET status = 'running', updated_at = ?
      WHERE id = ? AND status = 'queued'
    `,
    args: [now, jobId],
  });
  return Number(result.rowsAffected ?? 0) > 0;
};

export const completeJob = async (jobId: string, blobUrl: string, blobPathname: string) => {
  const db = getContentJobsDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `
      UPDATE content_jobs
      SET status = 'completed', blob_url = ?, blob_pathname = ?, completed_at = ?, updated_at = ?, error_message = NULL
      WHERE id = ?
    `,
    args: [blobUrl, blobPathname, now, now, jobId],
  });
};

export const failJobAttempt = async (jobId: string, currentAttemptCount: number, maxAttempts: number, errorMessage: string) => {
  const db = getContentJobsDb();
  const nextAttempts = currentAttemptCount + 1;
  const now = new Date().toISOString();
  const nextStatus = nextAttempts >= maxAttempts ? 'failed' : 'queued';
  await db.execute({
    sql: `
      UPDATE content_jobs
      SET status = ?, attempt_count = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [nextStatus, nextAttempts, errorMessage.slice(0, 1000), now, jobId],
  });
};
