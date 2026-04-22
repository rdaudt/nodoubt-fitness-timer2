import type { AppSettings } from '../types';

export const intervalColorsAreUnique = (settings: AppSettings): boolean => {
  const values = Object.values(settings.intervalColors).map((x) => x.toLowerCase());
  return new Set(values).size === values.length;
};
