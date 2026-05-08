import {
  applyLoginCookies,
  buildLoginRedirect,
  clearAuthCookies,
  createAuthenticatedSession,
  deleteCurrentUser,
  getCallbackCode,
  getSessionUser,
  getValidatedOauthState,
  redirect,
  setCookies,
} from './_auth.js';
import { createTenantTablesIfNeeded } from './_tenantsDb.js';

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

const setNoStore = (response: NodeRes): void => {
  response.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.setHeader?.('Pragma', 'no-cache');
  response.setHeader?.('Expires', '0');
};

const getAction = (request: NodeReq): string => {
  const raw = request.query?.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  return typeof action === 'string' ? action.trim().toLowerCase() : '';
};

const handleLogin = async (request: NodeReq, response: NodeRes): Promise<void> => {
  setNoStore(response);
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { state, nextPath, url } = await buildLoginRedirect(request);
  applyLoginCookies(response, request, state, nextPath);
  redirect(response, url);
};

const handleCallback = async (request: NodeReq, response: NodeRes): Promise<void> => {
  setNoStore(response);
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const code = getCallbackCode(request);
  const { isValid, nextPath } = await getValidatedOauthState(request);
  if (!code || !isValid) {
    clearAuthCookies(response, request);
    redirect(response, '/login?error=invalid_oauth_state');
    return;
  }
  await createTenantTablesIfNeeded();
  const { cookie } = await createAuthenticatedSession(code, request);
  setCookies(response, [cookie]);
  redirect(response, nextPath);
};

const handleMe = async (request: NodeReq, response: NodeRes): Promise<void> => {
  setNoStore(response);
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const user = await getSessionUser(request);
  if (!user) {
    clearAuthCookies(response, request);
    response.status(200).json({ user: null });
    return;
  }
  response.status(200).json({ user });
};

const handleLogout = async (request: NodeReq, response: NodeRes): Promise<void> => {
  setNoStore(response);
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  clearAuthCookies(response, request);
  response.status(200).json({ ok: true });
};

const handleAccountDelete = async (request: NodeReq, response: NodeRes): Promise<void> => {
  setNoStore(response);
  if (request.method !== 'DELETE') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const user = await getSessionUser(request);
  if (!user?.sub) {
    clearAuthCookies(response, request);
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }
  await deleteCurrentUser(user.sub);
  clearAuthCookies(response, request);
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
      clearAuthCookies(response, request);
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
