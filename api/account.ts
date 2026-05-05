import { clearAuthCookies, deleteCurrentUser, getSessionUser } from './_auth.js';

type NodeReq = { method?: string; headers?: Record<string, string | string[]> };
type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader?: (name: string, value: string | string[]) => void;
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'DELETE') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const user = await getSessionUser(request);
  if (!user?.sub) {
    clearAuthCookies(response);
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    await deleteCurrentUser(user.sub);
    clearAuthCookies(response);
    response.status(200).json({ ok: true });
  } catch (error) {
    console.error('account delete failed', error);
    response.status(500).json({ error: 'Failed to delete account.' });
  }
}
