import { describe, expect, it } from 'vitest';
import { niceMax } from './scale';

describe('chart scale', () => {
  it('rounds the top up to a number that halves cleanly', () => {
    expect(niceMax(37)).toEqual({ top: 40, ticks: [0, 20, 40] });
    expect(niceMax(4.2)).toEqual({ top: 5, ticks: [0, 2.5, 5] });
    expect(niceMax(1)).toEqual({ top: 1, ticks: [0, 0.5, 1] });
  });

  it('keeps an empty chart at the floor instead of dividing by zero', () => {
    expect(niceMax(0, 4).top).toBe(4);
  });
});
