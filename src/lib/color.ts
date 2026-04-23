export const withAlpha = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
