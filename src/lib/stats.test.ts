import { describe, expect, it } from 'vitest';
import { median, monday, quant, rate, wilson } from './stats';

describe('wilson', () => {
  it('has no interval without observations', () => {
    expect(wilson(0, 0)).toBeNull();
  });

  it('gives the textbook 95 % interval for 5 of 10', () => {
    const [lo, hi] = wilson(5, 10)!;
    expect(lo).toBeCloseTo(0.2366, 4);
    expect(hi).toBeCloseTo(0.7634, 4);
  });

  it('stays inside 0 and 1 at the extremes', () => {
    const [lo0, hi0] = wilson(0, 4)!;
    const [lo1, hi1] = wilson(4, 4)!;
    expect(lo0).toBe(0);
    expect(hi0).toBeLessThan(1);
    expect(lo1).toBeGreaterThan(0);
    expect(hi1).toBe(1);
  });
});

describe('rate', () => {
  it('marks a cell under minCell as too few', () => {
    expect(rate(2, 4, 5).few).toBe(true);
    expect(rate(2, 5, 5).few).toBe(false);
  });

  it('has no value when there is nothing to divide by', () => {
    expect(rate(0, 0, 5).v).toBeNull();
  });
});

describe('quantiles', () => {
  it('interpolates between neighbours and ignores missing values', () => {
    expect(median([4, null, 1, 3, 2])).toBe(2.5);
    expect(quant([0, 10], 0.9)).toBe(9);
    expect(median([])).toBeNull();
  });
});

describe('monday', () => {
  it('maps any day of the week to its Monday at UTC midnight', () => {
    const mon = Date.UTC(2026, 10, 9);
    expect(monday(Date.UTC(2026, 10, 11, 15))).toBe(mon);
    expect(monday(Date.UTC(2026, 10, 15, 23))).toBe(mon);
    expect(monday(mon)).toBe(mon);
  });
});
