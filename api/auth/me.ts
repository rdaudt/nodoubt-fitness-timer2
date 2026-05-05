import { clearAuthCookies, getSessionUser } from '../_auth.js';

type NodeReq = { method?: string; headers?: Record<string, string | string[]> };
type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader?: (name: string, value: string | string[]) => void;
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const user = await getSessionUser(request);
  if (!user) {
    clearAuthCookies(response);
    response.status(200).json({ user: null });
    return;
  }
  response.status(200).json({ user });
}
