/** A round top for an axis and the gridlines under it. */
export function niceMax(max: number, floor = 1): { top: number; ticks: number[] } {
  const m = Math.max(max, floor);
  const step = 10 ** Math.floor(Math.log10(m / 2));
  const half = [1, 2, 2.5, 5, 10].map((k) => k * step).find((s) => s * 2 >= m) ?? m / 2;
  return { top: half * 2, ticks: [0, half, half * 2] };
}
