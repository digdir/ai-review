import { compute, makeConfig } from './compute';
import { WEEK, rate, type Rate } from './stats';
import type { Data, Decision, Phase } from './types';

export interface IndexEntry {
  repo: string;
  ok: boolean;
  at: string;
  error?: string;
}

export interface Index {
  schema: string;
  generatedAt: string;
  repos: IndexEntry[];
}

export interface FleetRow {
  repo: string;
  phase: Phase | null;
  week: number;
  decided: Decision | null;
  counts: { met: number; notmet: number; early: number } | null;
  reviewedWeek: number;
  fixed: Rate;
  dismissed: Rate;
  projected: number | null;
  spent: number;
  budgetNok: number;
  lastRun: string | null;
  lastRunFailed: boolean;
  generatedAt: string | null;
  error: string | null;
}

const none = rate(0, 0, 1);

export function row(data: Data): FleetRow {
  const config = makeConfig(data);
  const m = compute(data, config);
  const weekAgo = m.now - WEEK;
  return {
    repo: data.config.repo,
    phase: m.phase,
    week: m.week,
    decided: m.decided?.outcome ?? null,
    counts: m.counts,
    reviewedWeek: new Set(m.reviews.filter((x) => Date.parse(x.started_at) >= weekAgo && x.arm !== 'shadow').map((x) => x.pr_number)).size,
    fixed: m.repo.allFix,
    dismissed: m.repo.dismissed,
    projected: m.projected,
    spent: m.monthNok,
    budgetNok: config.budgetNok,
    lastRun: m.lastRun?.started_at ?? null,
    lastRunFailed: m.lastRun?.completed === false,
    generatedAt: data.generatedAt,
    error: null,
  };
}

/** One row per repository in the index, plus any with data but no index entry. */
export function fleet(repos: Data[], index: Index | null): FleetRow[] {
  const byRepo = new Map(repos.map((d) => [d.config.repo, d]));
  const names = [...new Set([...(index?.repos.map((r) => r.repo) ?? []), ...byRepo.keys()])].sort();
  return names.map((name) => {
    const data = byRepo.get(name);
    const entry = index?.repos.find((r) => r.repo === name);
    const failed = entry && !entry.ok ? (entry.error ?? 'Collection failed') : null;
    if (!data)
      return {
        repo: name, phase: null, week: 0, decided: null, counts: null, reviewedWeek: 0, fixed: none, dismissed: none, projected: null, spent: 0,
        budgetNok: 0, lastRun: null, lastRunFailed: false, generatedAt: null, error: failed ?? 'No data yet',
      };
    return { ...row(data), error: failed };
  });
}
