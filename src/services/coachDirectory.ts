const MY_COACH_KEY = 'my_coach_slug';
const SLUG_RE = /^[a-z0-9-]{3,32}$/;

export const isValidCoachSlug = (value: string): boolean => SLUG_RE.test(value.trim().toLowerCase());

export const getMyCoachSlug = (): string => {
  const raw = window.localStorage.getItem(MY_COACH_KEY) ?? '';
  const slug = raw.trim().toLowerCase();
  return isValidCoachSlug(slug) ? slug : '';
};

export const setMyCoachSlug = (slug: string): void => {
  const normalized = slug.trim().toLowerCase();
  if (!isValidCoachSlug(normalized)) {
    return;
  }
  window.localStorage.setItem(MY_COACH_KEY, normalized);
};

export const clearMyCoachSlug = (): void => {
  window.localStorage.removeItem(MY_COACH_KEY);
};
