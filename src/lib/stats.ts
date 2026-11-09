export const DAY = 864e5;
export const WEEK = 7 * DAY;

export function quant(xs: (number | null | undefined)[], q: number): number | null {
  const s = xs.filter((x): x is number => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

export const median = (xs: (number | null | undefined)[]): number | null => quant(xs, 0.5);

export const sum = (xs: (number | null | undefined)[]): number => xs.reduce<number>((s, x) => s + (Number(x) || 0), 0);

export function monday(ms: number): number {
  const d = new Date(ms);
  const k = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - k);
}

export function wilson(k: number, n: number): [number, number] | null {
  if (!n) return null;
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export interface Rate {
  k: number;
  n: number;
  v: number | null;
  ci: [number, number] | null;
  few: boolean;
}

export const rate = (k: number, n: number, minCell: number): Rate => ({ k, n, v: n ? k / n : null, ci: wilson(k, n), few: n < minCell });
