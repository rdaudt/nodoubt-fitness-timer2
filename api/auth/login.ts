import { applyLoginCookies, buildLoginRedirect, redirect } from '../_auth.js';

type NodeReq = { method?: string; query?: Record<string, string | string[]>; headers?: Record<string, string | string[]> };
type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader?: (name: string, value: string | string[]) => void;
  redirect?: (status: number, url: string) => void;
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { state, nextPath, url } = buildLoginRedirect(request);
    applyLoginCookies(response, state, nextPath);
    redirect(response, url);
  } catch (error) {
    console.error('auth-login failed', error);
    response.status(500).json({ error: 'Failed to initialize Google login.' });
  }
}
