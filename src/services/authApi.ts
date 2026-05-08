export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
  isCoach: boolean;
}

const parseUser = (value: unknown): AuthUser | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const user = value as Record<string, unknown>;
  if (typeof user.sub !== 'string' || typeof user.email !== 'string') {
    return null;
  }
  return {
    sub: user.sub,
    email: user.email,
    name: typeof user.name === 'string' ? user.name : '',
    picture: typeof user.picture === 'string' ? user.picture : '',
    isCoach: Boolean(user.isCoach),
  };
};

export const fetchMe = async (): Promise<AuthUser | null> => {
  const response = await fetch('/api/auth?action=me', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json() as { user?: unknown };
  return parseUser(payload.user);
};

export const logout = async (): Promise<void> => {
  await fetch('/api/auth?action=logout', { method: 'POST', credentials: 'include' });
};

export const deleteAccount = async (): Promise<void> => {
  const response = await fetch('/api/auth?action=account', { method: 'DELETE', credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to delete account.');
  }
};

export const getGoogleLoginUrl = (nextPath: string): string => `/api/auth?action=login&next=${encodeURIComponent(nextPath)}`;
