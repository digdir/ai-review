import { DAY, WEEK } from './stats';
import type { AzureDay, CiRun, CodeqlAlert, Data, Grading, Pr, Run } from './types';

/** Six weeks of made-up data in the real shape, deterministic. */
export function sample(): Data {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const s = Date.parse('2026-11-09T00:00:00Z');
  const b = Date.parse('2026-10-19T00:00:00Z');
  const now = s + 6 * WEEK - DAY;
  const files = [
    'apps/api/src/routes/services.ts',
    'apps/api/src/auth/principal.ts',
    'apps/portal/src/pages/Service.tsx',
    'apps/console/src/agents/Editor.tsx',
    'packages/composition/src/wire.ts',
    'packages/definitions/src/schema.ts',
    'packages/strategy-agent-loop/src/loop.ts',
    '.github/workflows/ci.yml',
    'docs/adr/0049.md',
  ];
  const pool = Array.from({ length: 160 }, (_, i) => files[i % files.length].replace(/(\.\w+)$/, `-${i}$1`));
  const prs: Pr[] = [];
  const runs: Run[] = [];
  const ci: CiRun[] = [];
  const azure: AzureDay[] = [];
  const codeql: CodeqlAlert[] = [];
  let n = 300;
  for (let t = b; t < now; t += DAY) {
    const count = Math.round(4 + rnd() * 6);
    for (let i = 0; i < count; i++) {
      const c = t + rnd() * DAY;
      const live = c >= s;
      const kind = rnd() < 0.15 ? 'agent' : rnd() < 0.8 ? 'human_ai' : 'unknown';
      const arm = live ? (n % 100 < 30 ? 'shadow' : 'treated') : null;
      const h = (rnd() < 0.7 ? rnd() * 1.6 : rnd() * 50) * (arm === 'treated' ? 1.08 : 1);
      const m = c + h * 36e5;
      const p: Pr = {
        n: ++n,
        title: rnd() < 0.08 ? 'Fix the thing' : 'Change something',
        state: m < now ? 'MERGED' : 'OPEN',
        draft: false,
        created: new Date(c).toISOString(),
        merged: m < now ? new Date(m).toISOString() : null,
        lines: Math.round(rnd() * 900),
        files: [pick(pool), pick(pool)],
        bot: rnd() < 0.05,
        sensitive: rnd() < 0.35,
        risk: live && rnd() < 0.8 ? pick(['low', 'low', 'sensitive']) : null,
        queued: live && m < now ? new Date(m - (5 + rnd() * 25) * 6e4).toISOString() : null,
        human_review: rnd() < 0.15,
        arm,
        author_kind: live ? kind : null,
        findings: [],
        human_threads: [],
      };
      if (live && !p.bot) {
        const cost = 1.2 + rnd() * 2.2;
        const review: Run = {
          run_id: String(9e10 + n), pr_number: n, job: 'review', arm, started_at: new Date(c + 6e4).toISOString(), completed: rnd() > 0.03,
          duration_s: Math.round(150 + rnd() * 330), turns: Math.round(25 + rnd() * 40), subagents: 5, model: 'claude-opus-5-5', cost_usd: cost,
          author_kind: kind, findings: 0, source: 'record',
        };
        runs.push(review);
        const k = Math.floor(rnd() * (kind === 'agent' ? 5 : 4));
        for (let j = 0; j < k; j++) {
          const age = (now - c) / DAY;
          const r = rnd();
          const week = Math.floor((c - s) / WEEK) + 1;
          const novelty = week <= 2 ? 0.06 : 0;
          const outcome =
            arm === 'shadow' ? (r < 0.3 ? 'outdated' : 'open')
            : age < 1.5 && r < 0.5 ? 'open'
            : r < 0.5 + novelty ? 'fixed'
            : r < 0.6 ? 'resolved'
            : r < 0.67 ? 'outdated'
            : r < 0.82 ? 'dismissed'
            : r < 0.92 ? 'discussed'
            : 'open';
          p.findings.push({
            posted: new Date(c + 3e5).toISOString(),
            severity: pick(['Important', 'Nit', 'Nit', 'Nit', 'Pre-existing']),
            category: pick(['security', 'correctness', 'correctness', 'other-paths', 'tests', 'docs']),
            path: pick(files),
            outcome,
            replies: outcome === 'discussed' ? 2 : 0,
            suggestion: rnd() < 0.6,
            url: '',
          });
        }
        review.findings = k;
        if (arm === 'treated' && k)
          runs.push({
            run_id: String(8e10 + n), pr_number: n, job: 'follow-up', arm, started_at: new Date(c + 3 * 36e5).toISOString(), completed: true,
            duration_s: 60, turns: 8, subagents: 0, model: 'claude-sonnet-5-5', cost_usd: 0.12 + rnd() * 0.1, author_kind: kind, findings: null, source: 'record',
          });
      }
      prs.push(p);
    }
    for (let j = 0; j < 6; j++) ci.push({ at: new Date(t + j * 3e6).toISOString(), failed: rnd() < 0.08 });
    if (rnd() < 0.5) codeql.push({ created: new Date(t).toISOString(), state: rnd() < 0.8 ? 'fixed' : 'open', severity: 'medium' });
    if (t >= s) azure.push({ date: new Date(t).toISOString().slice(0, 10), nok: 150 + rnd() * 140, currency: 'NOK' });
  }
  const grades: Grading['grades'] = Array.from({ length: 168 }, () => {
    const r = rnd();
    return {
      severity: pick(['Important', 'Important', 'Nit', 'Nit', 'Pre-existing']),
      grade: r < 0.71 ? 'right_worth' : r < 0.85 ? 'right_not_worth' : r < 0.96 ? 'wrong' : 'unclear',
    };
  });
  const followup = Array.from({ length: 40 }, () => ({ correct: rnd() < 0.88 }));
  return {
    schema: 'digdir.ai-review.dashboard/v1',
    generatedAt: new Date(now).toISOString(),
    config: { repo: 'digdir/genki', baselineFrom: '2026-10-19', start: '2026-11-09' },
    setup: { shadowPercent: 30 },
    codeql,
    prs: prs.map((p, i) => (i % 4 ? p : { ...p, human_threads: [{ posted: p.created, outcome: i % 8 ? 'resolved' : 'open' }] })),
    runs,
    ci,
    azure,
    grading: { grades, followup, agreement: 0.81 },
    pulse: [
      { week: 2, n: 9, useful: 3.6, noise: 3.4 },
      { week: 6, n: 8, useful: 3.8, noise: 3.9 },
    ],
    now,
  };
}
