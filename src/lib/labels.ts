import type { Status } from './types';

export type Color = 'success' | 'info' | 'neutral' | 'danger' | 'warning';

export const SEVS = ['Important', 'Nit', 'Pre-existing'] as const;
export const CATS = ['security', 'correctness', 'other-paths', 'tests', 'docs'] as const;

export const KINDS: Record<string, string> = { agent: 'Agent', human_ai: 'Human with AI', unknown: 'Unknown', null: 'Before tracking' };

export const OUT: Record<string, [Color, string, string]> = {
  fixed: ['success', 'Fixed', 'The follow-up confirmed the problem is gone'],
  resolved: ['info', 'Resolved', 'A person resolved the thread without a confirmed fix'],
  outdated: ['neutral', 'Outdated', 'The lines changed, fix not confirmed'],
  dismissed: ['danger', 'Dismissed', 'The author replied that it will not be fixed'],
  discussed: ['warning', 'Discussed', 'Replies in the thread, not settled'],
  open: ['neutral', 'Open', 'No reply yet'],
};

export const OUT_COLOR: Record<string, string> = {
  fixed: 'var(--ds-color-success-base-default)',
  resolved: 'var(--ds-color-info-base-default)',
  outdated: 'var(--ds-color-neutral-border-strong)',
  dismissed: 'var(--ds-color-danger-base-default)',
  discussed: 'var(--ds-color-warning-base-default)',
  open: 'var(--ds-color-neutral-border-subtle)',
};

export const SEV_COLOR: Record<string, Color> = { Important: 'danger', Nit: 'neutral', 'Pre-existing': 'warning' };

export const STATUS: Record<Status, [Color, string]> = { ok: ['success', 'Met'], bad: ['danger', 'Not met'], early: ['neutral', 'Too early'], wait: ['warning', 'Waiting'] };
export const VERDICT: Record<Status, string> = { ok: 'GO', bad: 'NO-GO', early: 'STANDBY', wait: 'HOLD' };
export const LED: Record<Status, string> = { ok: 'ok', bad: 'bad', early: '', wait: 'wait' };
export const SETUP: Record<Status, [Color, string]> = { ok: ['success', 'Ready'], bad: ['danger', 'Fault'], wait: ['warning', 'Missing'], early: ['neutral', 'Later'] };
export const SETUP_VERDICT: Record<Status, string> = { ok: 'READY', bad: 'FAULT', wait: 'MISSING', early: 'LATER' };

export const CAT: Record<string, string> = { security: 'Security', correctness: 'Correctness', 'other-paths': 'Other paths', tests: 'Tests', docs: 'Docs and rules' };
export const JOB: Record<string, string> = { review: 'Review', 'follow-up': 'Follow-up' };
export const JOB_SHORT: Record<string, string> = { review: 'REVIEW', 'follow-up': 'FOLLOW-UP' };

export const VIEWS = [
  ['overview', 'Overview'],
  ['findings', 'Findings'],
  ['quality', 'Quality'],
  ['noise', 'Noise'],
  ['security', 'Security'],
  ['delivery', 'Delivery'],
  ['cost', 'Cost'],
  ['runs', 'Runs'],
  ['experiment', 'Experiment'],
] as const;

export type View = (typeof VIEWS)[number][0];

/** Tab ids used before the dashboard was in English. */
export const OLD_VIEWS: Record<string, View> = {
  oversikt: 'overview',
  kvalitet: 'quality',
  sikkerhet: 'security',
  stoy: 'noise',
  vakt: 'delivery',
  kostnad: 'cost',
  kjoringer: 'runs',
  om: 'experiment',
};
