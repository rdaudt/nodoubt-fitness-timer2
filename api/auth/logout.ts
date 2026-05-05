import { clearAuthCookies } from '../_auth.js';

type NodeReq = { method?: string };
type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader?: (name: string, value: string | string[]) => void;
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  clearAuthCookies(response);
  response.status(200).json({ ok: true });
}
