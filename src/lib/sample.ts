import { DAY, WEEK } from './stats';
import type { AzureDay, Change, CiRun, CodeqlAlert, CrossRun, Data, Grading, Pr, Run, SweepRun } from './types';

export type SampleState = 'setup' | 'measuring' | 'after';

export const SAMPLE_STATES: [SampleState, string][] = [
  ['setup', 'Week 1'],
  ['measuring', 'Week 5'],
  ['after', 'After'],
];

/** Hashes of the made-up logins kari-h, ola-n and per-s, so the author filter can be tried on sample data. */
const AUTHORS = [
  'e4a36f6e82a6053005f8ada8f317d194296f37bde98eac3f0e40f2c239fa6fc0',
  '524f06163329d01fba3a5d2bbfc8d387ccf9ae00c6b9d5e345ad334c9eb92d01',
  '7a98a32a24f5c6c80f9a45cd224ce1630f30431f6c3874660010301a41613591',
];

const TITLES = [
  'Let the operator pause a strategy from the console',
  'Return 404 for a dataset from another tenant',
  'Show the audit log per service run',
  'Pin actions in the knowledge worker workflow',
  'Mask personal data in the trace exporter',
  'Validate webhook signatures in constant time',
  'Record the model gate decision in the run timeline',
  'Rewrite the dataset import as a durable job',
  'Add the review labels to the console filters',
  'Reject an empty slug when a service is created',
];

const FINDINGS = [
  'The pause route never compares the tenant with the principal',
  'Signatures are compared with === instead of a constant-time check',
  'A failed chunk is retried without resetting the offset',
  'No test states the rule that the audit log is per run',
  '`name in labels` is true for inherited names',
  'The ADR is marked built, but the route only accepts dev keys',
  'The new label has no i18n entry',
  'The import job takes the tenant from the payload',
  'The list resets its page when the data refetches',
  'Trace attributes include the tenant id in the request path',
];

const NOW: Record<SampleState, number> = {
  setup: Date.parse('2026-11-10T10:00:00Z'),
  measuring: Date.parse('2026-12-10T10:00:00Z'),
  after: Date.parse('2027-01-13T10:00:00Z'),
};

const CHANGES: Change[] = [
  { date: '2026-11-09', kind: 'setup', item: 'silent-share', note: 'Start of the experiment. Silent share set to 25 percent.', source: 'manual' },
  { date: '2026-11-09', kind: 'protocol', item: 'protocol', note: 'Protocol written in docs/experiment.md before the first results.', source: 'manual' },
  { date: '2026-11-09', kind: 'workflow', ref: 'digdir/genki#417', note: "Review every pull request with a model through the lab's Foundry", source: 'auto' },
  { date: '2026-11-12', kind: 'setup', item: 'sign-in', note: 'Dashboard sign-in working after admin consent', source: 'manual' },
  { date: '2026-11-17', kind: 'rule', ref: 'digdir/genki#431', note: 'Do not report lock files, generated files or anything CI already enforces', because: 'Most dismissed findings in week 1 were on lock files or lint', source: 'manual' },
  { date: '2026-11-19', kind: 'setup', item: 'privacy', note: 'Privacy assessment confirmed by the data protection officer', source: 'manual' },
  { date: '2026-11-23', kind: 'setup', item: 'graders', note: 'Two graders named; grading starts with the week 3 sample', source: 'manual' },
  { date: '2026-11-24', kind: 'rule', ref: 'digdir/genki#447', note: 'Tenant checks: name the route that misses the check, not the pattern', because: 'A finding was dismissed as "which route?"', source: 'manual' },
  { date: '2026-12-02', kind: 'workflow', ref: 'digdir/genki#460', note: 'Retry a failed review once', source: 'auto' },
  { date: '2026-12-08', kind: 'procedure', ref: 'digdir/genki#489', note: 'Post the review as soon as it is ready instead of after CI', because: 'Time to merge read high on 7 Dec; review rounds were waiting for CI', source: 'manual' },
  { date: '2026-12-22', kind: 'protocol', item: 'decision', outcome: 'keep', note: 'All seven criteria met at week 6. The criteria continue as health measures.', source: 'manual' },
];

/** Made-up data in the real shape at one of three moments of the experiment, deterministic. */
export function sample(state: SampleState = 'measuring'): Data {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const s = Date.parse('2026-11-09T00:00:00Z');
  const b = Date.parse('2026-10-19T00:00:00Z');
  const now = NOW[state];
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
    const weekend = new Date(t).getUTCDay() % 6 === 0;
    const count = Math.round((weekend ? 0.5 : 3) + rnd() * (weekend ? 1 : 5));
    for (let i = 0; i < count; i++) {
      const c = t + (7 + rnd() * 9) * 36e5;
      if (c >= now) continue;
      const live = c >= s;
      const week = Math.floor((c - s) / WEEK) + 1;
      const kind = rnd() < 0.15 ? 'agent' : rnd() < 0.8 ? 'human_ai' : 'unknown';
      const arm = live ? ((n * 37) % 100 < 25 ? 'shadow' : 'treated') : null;
      const slow = arm !== 'treated' ? 1 : week >= 3 && week <= 5 ? 1.4 : week >= 6 ? 0.7 : 1;
      const h = (rnd() < 0.7 ? 0.4 + rnd() * 3 : rnd() * 40) * slow;
      const m = c + h * 36e5;
      const lines = Math.round(rnd() < 0.08 ? 1000 + rnd() * 1500 : rnd() < 0.3 ? rnd() * 50 : 50 + rnd() * 700);
      const p: Pr = {
        n: ++n,
        title: rnd() < 0.08 ? 'Fix the quota check on the batch route' : pick(TITLES),
        state: m < now ? 'MERGED' : 'OPEN',
        draft: false,
        created: new Date(c).toISOString(),
        merged: m < now ? new Date(m).toISOString() : null,
        lines,
        files: [pick(pool), pick(pool)],
        bot: rnd() < 0.05,
        sensitive: rnd() < 0.35,
        risk: live && rnd() < 0.8 ? pick(['low', 'low', 'sensitive']) : null,
        queued: live && m < now ? new Date(m - (5 + rnd() * 25) * 6e4).toISOString() : null,
        human_review: rnd() < 0.15,
        arm,
        author_kind: live ? kind : null,
        author_hash: pick(AUTHORS),
        findings: [],
        recorded: [],
        human_threads: [],
        escaped: live && n % 47 === 0,
        head: `h${n}`,
      };
      if (live && !p.bot) {
        const cost = 0.2 + rnd() * 0.8 + lines / 4000;
        const review: Run = {
          run_id: String(9e10 + n), pr_number: n, job: 'review', arm, started_at: new Date(c + 6e4).toISOString(), completed: rnd() > 0.03,
          duration_s: Math.round(40 + rnd() * 300 + lines / 10), turns: Math.round(25 + rnd() * 40), subagents: 5, model: 'claude-opus-5-5', cost_usd: cost,
          author_kind: kind, findings: 0, source: 'record', head_sha: `h${n}`, tokens: { input: 40000, output: 6000, cache_read: 60000 + Math.round(rnd() * 60000) },
        };
        runs.push(review);
        const k = Math.max(0, Math.floor(rnd() * (lines > 1000 ? 8 : lines < 50 ? 1.6 : 4.2) - (week >= 3 ? 0.4 : 0)));
        for (let j = 0; j < k; j++) {
          const posted = new Date(c + 3e5 + j * 1000).toISOString();
          const severity = pick(['Important', 'Nit', 'Nit', 'Nit', 'Pre-existing']);
          const category = pick(['security', 'correctness', 'correctness', 'other-paths', 'tests', 'docs']);
          const title = pick(FINDINGS);
          const path = pick(files);
          if (arm === 'shadow') {
            p.recorded!.push({ posted, severity, category, title, path });
            continue;
          }
          const age = (now - c) / DAY;
          const r = rnd() - (severity === 'Important' ? 0.18 : 0);
          const outcome =
            p.state === 'OPEN' && age < 3 && r < 0.6 ? 'open'
            : r < (week <= 2 ? 0.48 : 0.56) ? 'fixed'
            : r < 0.64 ? 'resolved'
            : r < 0.7 ? 'outdated'
            : r < (week <= 2 ? 0.9 : 0.86) ? 'dismissed'
            : r < 0.94 ? 'discussed'
            : 'open';
          p.findings.push({
            posted, severity, category, title, path, outcome,
            replies: outcome === 'discussed' || outcome === 'dismissed' ? 1 : 0,
            suggestion: rnd() < 0.6,
            url: `https://github.com/digdir/genki/pull/${n}#discussion_r${n}${j}`,
            answered: outcome === 'open' ? null : new Date(c + (0.3 + rnd() * 20) * 36e5).toISOString(),
          });
        }
        review.findings = k;
        if (rnd() < 0.06) runs.push({ ...review, run_id: String(7e10 + n), started_at: new Date(c + 9e5).toISOString(), review_again: true, cost_usd: cost * 0.9 });
        if (rnd() < 0.05) runs.push({ ...review, run_id: String(6e10 + n), started_at: new Date(c + 2 * 36e5).toISOString(), review_again: true, head_sha: `h${n}b`, cost_usd: cost * 0.8 });
        if (arm === 'treated' && k)
          runs.push({
            run_id: String(8e10 + n), pr_number: n, job: 'follow-up', arm, started_at: new Date(c + 3 * 36e5).toISOString(), completed: true,
            duration_s: 60, turns: 8, subagents: 0, model: 'claude-sonnet-5-5', cost_usd: 0.04 + rnd() * 0.06, author_kind: kind, findings: null, source: 'record',
          });
      }
      prs.push(p);
    }
    for (let j = 0; j < 6; j++) ci.push({ at: new Date(t + j * 3e6).toISOString(), failed: rnd() < 0.08 });
    if (rnd() < 0.5) codeql.push({ created: new Date(t).toISOString(), state: rnd() < 0.8 ? 'fixed' : 'open', severity: 'medium' });
    if (t >= s && t + DAY <= now) azure.push({ date: new Date(t).toISOString().slice(0, 10), nok: 60 + rnd() * 140, currency: 'NOK' });
  }
  const week = Math.floor((now - s) / WEEK) + 1;
  const gradedWeeks = [3, 4, 5, 6].filter((w) => w < week);
  const grades: Grading['grades'] = gradedWeeks.flatMap((w) =>
    Array.from({ length: 15 }, () => {
      const r = rnd();
      return {
        week: w,
        severity: pick(['Important', 'Important', 'Nit', 'Nit', 'Pre-existing']),
        grade: r < 0.74 ? 'right_worth' : r < 0.86 ? 'right_not_worth' : r < 0.96 ? 'wrong' : 'unclear',
      } as const;
    }),
  );
  const followup = Array.from({ length: gradedWeeks.length * 10 }, () => ({ correct: rnd() < 0.88 }));
  const sweeps: SweepRun[] = [];
  for (let t = Date.parse('2026-11-16T03:17:00Z'), i = 0; t < now; t += WEEK, i++) {
    const kind = i % 4;
    const ok = (coordinate = 'success') => ({ tenancy: 'success', rights: 'success', secrets: 'success', coordinate });
    sweeps.push({
      run_id: String(9e9 + i),
      started_at: new Date(t).toISOString(),
      conclusion: kind === 3 ? 'failure' : 'success',
      passes: kind === 0 ? ok() : kind === 1 ? { ...ok(), rights: 'failure' } : kind === 2 ? ok('skipped') : null,
      cost_usd: kind === 3 ? null : [16.4, 11.2, 9.8][kind],
      duration_s: kind === 3 ? null : 2400 + i * 60,
      model: kind === 3 ? null : 'claude-opus-5-5',
    });
  }
  const cross: CrossRun[] = [];
  let crossSeed = 7;
  const crossRnd = () => (crossSeed = (crossSeed * 16807) % 2147483647) / 2147483647;
  for (const p of prs.filter((x) => x.sensitive && x.arm && !x.bot && x.created >= '2026-11-11')) {
    const returned = Math.floor(crossRnd() * 4);
    const duplicates = Math.min(returned, Math.floor(crossRnd() * 2));
    const fresh = returned - duplicates;
    const started = Date.parse(p.created) + 9e5;
    cross.push({
      run_id: String(5e10 + p.n), pr_number: p.n, arm: p.arm!, started_at: new Date(started).toISOString(), completed: true, stopped_at_budget: crossRnd() < 0.05,
      model: 'gpt-6.1-sol', cost_usd: 0.3 + crossRnd() * 0.9, tokens: { input: 120000, output: 9000, cache_read: 40000 }, returned, duplicates,
      posted: p.arm === 'treated' ? fresh : 0,
    });
    if (p.arm !== 'treated') continue;
    for (let j = 0; j < fresh; j++) {
      const r = crossRnd();
      const outcome = r < 0.35 ? 'fixed' : r < 0.6 ? 'dismissed' : r < 0.8 ? 'resolved' : 'open';
      p.findings.push({
        reviewer: 'cross-model', posted: new Date(started + 6e5).toISOString(), severity: crossRnd() < 0.5 ? 'Important' : 'Nit', category: 'security',
        title: FINDINGS[Math.floor(crossRnd() * FINDINGS.length)], path: p.files[0], outcome, replies: outcome === 'dismissed' ? 1 : 0,
        url: `https://github.com/digdir/genki/pull/${p.n}#discussion_c${p.n}${j}`, answered: outcome === 'open' ? null : new Date(started + 5 * 36e5).toISOString(),
      });
    }
  }
  const today = new Date(now).toISOString().slice(0, 10);
  return {
    schema: 'digdir.ai-review.dashboard/v1',
    generatedAt: new Date(now).toISOString(),
    config: { repo: 'digdir/genki', baselineFrom: '2026-10-19', start: '2026-11-09' },
    setup: { shadowPercent: 25 },
    codeql,
    prs: prs.map((p, i) => (i % 4 ? p : { ...p, human_threads: [{ posted: p.created, outcome: i % 8 ? 'resolved' : 'open' }] })),
    runs,
    ci,
    azure,
    sweeps,
    cross,
    grading: grades.length ? { grades, followup, agreement: 0.66 } : null,
    changes: CHANGES.filter((c) => c.date <= today),
    pulse: [
      { week: 2, n: 9, useful: 3.6, noise: 3.4 },
      { week: 6, n: 8, useful: 3.9, noise: 3.8 },
    ].filter((p) => p.week < week),
    now,
  };
}
