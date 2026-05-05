import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { getTenantsDb } from './_tenantsDb.js';

const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const SESSION_COOKIE = 'nd_timer_session';
const OAUTH_STATE_COOKIE = 'nd_timer_oauth_state';
const OAUTH_NEXT_COOKIE = 'nd_timer_oauth_next';
const SESSION_MAX_AGE_SEC = 8 * 60 * 60;
const OAUTH_STATE_MAX_AGE_SEC = 10 * 60;

type HeadersValue = string | string[] | undefined;
type NodeReq = { headers?: Record<string, HeadersValue>; query?: Record<string, string | string[]> };
type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader?: (name: string, value: string | string[]) => void;
  redirect?: (status: number, url: string) => void;
};

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
  isCoach: boolean;
}

interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getCookieHeader = (headers: Record<string, HeadersValue> | undefined): string => {
  if (!headers) {
    return '';
  }
  const cookie = headers.cookie ?? headers.Cookie;
  if (Array.isArray(cookie)) {
    return cookie.join('; ');
  }
  return cookie ?? '';
};

const parseCookies = (cookieHeader: string): Record<string, string> => {
  const pairs = cookieHeader.split(';').map((item) => item.trim()).filter(Boolean);
  const map: Record<string, string> = {};
  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    map[key] = decodeURIComponent(value);
  }
  return map;
};

const isSecureCookie = (): boolean => requireEnv('APP_BASE_URL').startsWith('https://');

const serializeCookie = (
  name: string,
  value: string,
  maxAgeSec: number,
): string => {
  const secure = isSecureCookie() ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
};

const clearCookie = (name: string): string => {
  const secure = isSecureCookie() ? '; Secure' : '';
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
};

const getSessionSecret = (): Uint8Array => new TextEncoder().encode(requireEnv('AUTH_SESSION_SECRET'));

const asArray = (value: string | string[] | undefined): string[] => (Array.isArray(value) ? value : value ? [value] : []);

const normalizeNextPath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return '/';
  }
  // Reject protocol-relative and backslash-prefixed paths.
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }
  return trimmed;
};

export const setCookies = (response: NodeRes, cookies: string[]) => {
  response.setHeader?.('Set-Cookie', cookies);
};

export const readCookie = (request: NodeReq, key: string): string => {
  const cookies = parseCookies(getCookieHeader(request.headers));
  return cookies[key] ?? '';
};

export const clearAuthCookies = (response: NodeRes) => {
  setCookies(response, [clearCookie(SESSION_COOKIE), clearCookie(OAUTH_STATE_COOKIE), clearCookie(OAUTH_NEXT_COOKIE)]);
};

export const buildLoginRedirect = (request: NodeReq): { state: string; nextPath: string; url: string } => {
  const baseUrl = requireEnv('APP_BASE_URL');
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const callbackUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/callback`;
  const requestedNext = asArray(request.query?.next)[0] ?? '';
  const nextPath = normalizeNextPath(requestedNext);
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return { state, nextPath, url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
};

const exchangeCodeForTokens = async (code: string): Promise<{ id_token: string }> => {
  const baseUrl = requireEnv('APP_BASE_URL');
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const callbackUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/callback`;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`Failed to exchange code: ${response.status}`);
  }
  return response.json() as Promise<{ id_token: string }>;
};

const verifyGoogleIdentity = async (idToken: string): Promise<GoogleIdentity> => {
  const audience = requireEnv('GOOGLE_CLIENT_ID');
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, { audience });
  if (!payload.iss || !GOOGLE_ISSUERS.has(String(payload.iss))) {
    throw new Error('Invalid Google issuer.');
  }
  const sub = String(payload.sub ?? '');
  const email = String(payload.email ?? '').trim().toLowerCase();
  if (!sub || !email) {
    throw new Error('Missing Google identity fields.');
  }
  return {
    sub,
    email,
    name: String(payload.name ?? ''),
    picture: String(payload.picture ?? ''),
  };
};

const resolveCoachStatusByEmail = async (email: string): Promise<boolean> => {
  const db = getTenantsDb();
  const result = await db.execute({
    sql: `
      SELECT id
      FROM coach_tenants
      WHERE lower(owner_email) = lower(?)
      LIMIT 1
    `,
    args: [email],
  });
  return result.rows.length > 0;
};

const upsertAppUser = async (user: SessionUser): Promise<void> => {
  const now = new Date().toISOString();
  const db = getTenantsDb();
  await db.execute({
    sql: `
      INSERT INTO app_users (
        google_sub,
        email,
        name,
        picture_url,
        is_coach,
        created_at,
        updated_at,
        last_login_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(google_sub) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        picture_url = excluded.picture_url,
        is_coach = excluded.is_coach,
        updated_at = excluded.updated_at,
        last_login_at = excluded.last_login_at
    `,
    args: [
      user.sub,
      user.email,
      user.name,
      user.picture,
      user.isCoach ? 1 : 0,
      now,
      now,
      now,
    ],
  });
};

const createSessionToken = async (user: SessionUser): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    isCoach: user.isCoach,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SEC)
    .sign(getSessionSecret());
};

const verifySessionToken = async (token: string): Promise<SessionUser | null> => {
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return {
      sub: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      picture: String(payload.picture ?? ''),
      isCoach: Boolean(payload.isCoach),
    };
  } catch {
    return null;
  }
};

export const applyLoginCookies = (response: NodeRes, state: string, nextPath: string) => {
  setCookies(response, [
    serializeCookie(OAUTH_STATE_COOKIE, state, OAUTH_STATE_MAX_AGE_SEC),
    serializeCookie(OAUTH_NEXT_COOKIE, nextPath, OAUTH_STATE_MAX_AGE_SEC),
  ]);
};

export const createAuthenticatedSession = async (identityCode: string): Promise<{ user: SessionUser; cookie: string }> => {
  const { id_token: idToken } = await exchangeCodeForTokens(identityCode);
  const identity = await verifyGoogleIdentity(idToken);
  const isCoach = await resolveCoachStatusByEmail(identity.email);
  const user: SessionUser = {
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    picture: identity.picture,
    isCoach,
  };
  await upsertAppUser(user);
  const token = await createSessionToken(user);
  return { user, cookie: serializeCookie(SESSION_COOKIE, token, SESSION_MAX_AGE_SEC) };
};

export const getSessionUser = async (request: NodeReq): Promise<SessionUser | null> => {
  const token = readCookie(request, SESSION_COOKIE);
  return verifySessionToken(token);
};

export const getCallbackState = (request: NodeReq): string => asArray(request.query?.state)[0] ?? '';
export const getCallbackCode = (request: NodeReq): string => asArray(request.query?.code)[0] ?? '';
export const getStoredOauthState = (request: NodeReq): string => readCookie(request, OAUTH_STATE_COOKIE);
export const getStoredNextPath = (request: NodeReq): string => {
  const value = readCookie(request, OAUTH_NEXT_COOKIE);
  return normalizeNextPath(value);
};

export const deleteCurrentUser = async (userSub: string): Promise<void> => {
  const db = getTenantsDb();
  await db.execute({
    sql: `DELETE FROM app_users WHERE google_sub = ?`,
    args: [userSub],
  });
};

export const redirect = (response: NodeRes, url: string) => {
  if (response.redirect) {
    response.redirect(302, url);
    return;
  }
  response.status(302).json({ redirectTo: url });
};
