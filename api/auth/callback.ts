import {
  clearAuthCookies,
  createAuthenticatedSession,
  getCallbackCode,
  getCallbackState,
  getStoredNextPath,
  getStoredOauthState,
  redirect,
  setCookies,
} from '../_auth.js';
import { createTenantTablesIfNeeded } from '../_tenantsDb.js';

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
  const state = getCallbackState(request);
  const code = getCallbackCode(request);
  const expectedState = getStoredOauthState(request);
  const nextPath = getStoredNextPath(request);
  if (!state || !code || !expectedState || state !== expectedState) {
    clearAuthCookies(response);
    redirect(response, '/login?error=invalid_oauth_state');
    return;
  }
  try {
    await createTenantTablesIfNeeded();
    const { cookie } = await createAuthenticatedSession(code);
    setCookies(response, [cookie]);
    redirect(response, nextPath);
  } catch (error) {
    console.error('auth-callback failed', error);
    clearAuthCookies(response);
    redirect(response, '/login?error=oauth_callback_failed');
  }
}
