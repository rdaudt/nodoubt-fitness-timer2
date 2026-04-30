import { createTablesIfNeeded, getAnalyticsDb } from './_analyticsDb.js';

type NodeReq = {
  method?: string;
};

type NodeRes = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const hasEnv = (name: string): boolean => {
  const value = process.env[name]?.trim();
  return Boolean(value);
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const env = {
    tursoDatabaseUrl: hasEnv('TURSO_DATABASE_URL'),
    tursoAuthToken: hasEnv('TURSO_AUTH_TOKEN'),
    cronSecret: hasEnv('CRON_SECRET') || hasEnv('ANALYTICS_CRON_SECRET'),
  };

  try {
    await createTablesIfNeeded();
    const db = getAnalyticsDb();
    await db.execute('SELECT 1');

    response.status(200).json({
      ok: true,
      checks: {
        env,
        dbConnection: true,
      },
    });
  } catch (error) {
    console.error('analytics-health failed', error);
    const reason = error instanceof Error ? error.message : String(error);
    response.status(500).json({
      ok: false,
      checks: {
        env,
        dbConnection: false,
      },
      error: 'Analytics health check failed.',
      reason,
    });
  }
}
