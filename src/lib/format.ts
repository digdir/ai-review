const TZ = 'Europe/Oslo';

export const missing = (v: number | null | undefined): v is null | undefined => v == null || Number.isNaN(v);

export const fmt = (v: number | null | undefined, d = 0): string =>
  missing(v) ? '–' : new Intl.NumberFormat('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export const pct = (v: number | null | undefined): string => (missing(v) ? '–' : `${fmt(v * 100)}%`);

export const signed = (v: number | null | undefined): string =>
  missing(v) ? '–' : `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v * 100))}%`;

export const day = (iso: string | number): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));

export const stamp = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const clock = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const dayClock = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const nok = (v: number | null | undefined, d = 0): string => (missing(v) ? '–' : `NOK ${fmt(v, d)}`);

export const minutes = (v: number | null | undefined): string =>
  missing(v) ? '–' : v < 1 ? `${fmt(v * 60)} s` : v < 90 ? `${fmt(v, v < 10 ? 1 : 0)} min` : `${fmt(v / 60, 1)} h`;
