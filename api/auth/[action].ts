import {
  applyLoginCookies,
  buildLoginRedirect,
  clearAuthCookies,
  createAuthenticatedSession,
  deleteCurrentUser,
  getCallbackCode,
  getCallbackState,
  getSessionUser,
  getStoredNextPath,
  getStoredOauthState,
  redirect,
  setCookies,
} from '../_auth.js';
import { createTenantTablesIfNeeded } from '../_tenantsDb.js';

type NodeReq = {
  method?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[]>;
};
type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader?: (name: string, value: string | string[]) => void;
  redirect?: (status: number, url: string) => void;
};

const getAction = (request: NodeReq): string => {
  const raw = request.query?.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  return typeof action === 'string' ? action.trim().toLowerCase() : '';
};

const handleLogin = async (request: NodeReq, response: NodeRes): Promise<void> => {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { state, nextPath, url } = buildLoginRedirect(request);
  applyLoginCookies(response, state, nextPath);
  redirect(response, url);
};

const handleCallback = async (request: NodeReq, response: NodeRes): Promise<void> => {
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
  await createTenantTablesIfNeeded();
  const { cookie } = await createAuthenticatedSession(code);
  setCookies(response, [cookie]);
  redirect(response, nextPath);
};

const handleMe = async (request: NodeReq, response: NodeRes): Promise<void> => {
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
};

const handleLogout = async (request: NodeReq, response: NodeRes): Promise<void> => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  clearAuthCookies(response);
  response.status(200).json({ ok: true });
};

const handleAccountDelete = async (request: NodeReq, response: NodeRes): Promise<void> => {
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
  await deleteCurrentUser(user.sub);
  clearAuthCookies(response);
  response.status(200).json({ ok: true });
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  const action = getAction(request);
  try {
    if (action === 'login') {
      await handleLogin(request, response);
      return;
    }
    if (action === 'callback') {
      await handleCallback(request, response);
      return;
    }
    if (action === 'me') {
      await handleMe(request, response);
      return;
    }
    if (action === 'logout') {
      await handleLogout(request, response);
      return;
    }
    if (action === 'account') {
      await handleAccountDelete(request, response);
      return;
    }
    response.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error(`auth/${action || 'unknown'} failed`, error);
    if (action === 'callback') {
      clearAuthCookies(response);
      redirect(response, '/login?error=oauth_callback_failed');
      return;
    }
    if (action === 'login') {
      response.status(500).json({ error: 'Failed to initialize Google login.' });
      return;
    }
    if (action === 'account') {
      response.status(500).json({ error: 'Failed to delete account.' });
      return;
    }
    response.status(500).json({ error: 'Auth request failed.' });
  }
}
