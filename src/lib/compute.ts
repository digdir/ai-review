import { fmt, pct, signed } from './format';
import { CATS, JOB_SHORT, OUT, SEVS } from './labels';
import { DAY, WEEK, median, monday, quant, rate, sum, type Rate } from './stats';
import type { Data, ExperimentConfig, Finding, Pr, Run, Status } from './types';

export const DEFAULTS: ExperimentConfig = {
  weeks: 6,
  budgetNok: 7500,
  usdNok: 10.9,
  minCell: 5,
  humanBand: [0.44, 0.6],
  importantMin: 0.5,
  dismissedMax: 0.5,
  ciMissedMin: 3,
  precisionMin: 0.7,
  mergeMaxIncrease: 0.2,
  reworkMaxIncrease: 0.05,
  privacyConfirmed: false,
  gradersFound: false,
  sensitiveChannel: false,
};

export const makeConfig = (data: Data): ExperimentConfig => ({ ...DEFAULTS, ...data.config.experiment });

const FIX_TITLE = /^(fix|revert|restore|stop|keep)\b/i;
const isReview = (r: Run) => (r.job ?? 'review') === 'review';
const ms = (iso: string) => Date.parse(iso);

export interface FlatFinding extends Finding {
  pr: number;
  prTitle: string;
  merged: boolean;
  arm: Pr['arm'];
  kind: Pr['author_kind'];
}

export interface Week {
  w: number;
  phase: 'base' | 'review';
  n: number;
  hidden: boolean;
  med: number | null;
  p90: number | null;
  noHuman: number | null;
  rework: number | null;
  reworkPending: boolean;
  red: number | null;
  codeql: number;
  dism: number | null;
  perPr: number | null;
  cost: number | null;
}

export interface Criterion {
  name: string;
  value: string;
  status: Status;
}

export interface MergeTimes {
  n: number;
  med: number | null;
  p90: number | null;
}

export interface FeedEvent {
  t: string;
  kind: string;
  cls: string;
  text: string;
}

export interface SetupItem {
  name: string;
  value: string;
  status: Status;
}

export type Metrics = ReturnType<typeof compute>;

export function compute(D: Data, C: ExperimentConfig) {
  const r = (k: number, n: number): Rate => rate(k, n, C.minCell);
  const now = D.now ?? Date.parse(D.generatedAt);
  const startMs = ms(D.config.start + 'T00:00:00Z');
  const baseFrom = ms(D.config.baselineFrom + 'T00:00:00Z');
  const week = Math.max(1, Math.min(C.weeks, Math.floor((now - startMs) / WEEK) + 1));
  const people = D.prs.filter((p) => !p.bot);
  const merged = people.filter((p) => p.merged && ms(p.merged) >= baseFrom);
  const mergedAt = (p: Pr) => ms(p.merged!);
  const hours = (p: Pr) => (mergedAt(p) - ms(p.created)) / 36e5;
  const base = merged.filter((p) => mergedAt(p) < startMs);
  const since = merged.filter((p) => mergedAt(p) >= startMs);
  const reviews = D.runs.filter(isReview);
  const reviewedSet = new Set(reviews.map((x) => x.pr_number));
  const treated = since.filter((p) => reviewedSet.has(p.n) && p.arm !== 'shadow');
  const shadow = since.filter((p) => p.arm === 'shadow');

  const F: FlatFinding[] = D.prs.flatMap((p) => p.findings.map((f) => ({ ...f, pr: p.n, prTitle: p.title, merged: !!p.merged, arm: p.arm, kind: p.author_kind })));
  const posted = F.filter((f) => f.arm !== 'shadow');
  const onMerged = posted.filter((f) => f.merged);
  const fixedRate = (xs: FlatFinding[]) => r(xs.filter((f) => f.outcome === 'fixed').length, xs.length);
  const bySev = SEVS.map((s) => ({ key: s as string, ...fixedRate(onMerged.filter((f) => f.severity === s)) }));
  const important = bySev[0];
  const kinds = (['agent', 'human_ai', 'unknown', null] as const)
    .map((k) => {
      const prsOfKind = since.filter((p) => reviewedSet.has(p.n) && p.arm !== 'shadow' && (p.author_kind ?? null) === k);
      return { key: String(k), prs: prsOfKind.length, ...fixedRate(onMerged.filter((f) => (f.kind ?? null) === k)) };
    })
    .filter((k) => k.prs || k.n);
  const wk = (f: Finding) => Math.floor((ms(f.posted) - startMs) / WEEK) + 1;
  const early = fixedRate(onMerged.filter((f) => wk(f) <= 2));
  const late = fixedRate(onMerged.filter((f) => wk(f) >= 5));
  const dismissed = r(posted.filter((f) => f.outcome === 'dismissed').length, posted.length);
  const preexisting = r(posted.filter((f) => f.severity === 'Pre-existing').length, posted.length);
  const reviewedPrs = [...reviewedSet].filter((n) => D.prs.some((p) => p.n === n && p.arm !== 'shadow'));
  const perPr = reviewedPrs.map((n) => posted.filter((f) => f.pr === n).length);
  const humanThreads = D.prs.flatMap((p) => p.human_threads ?? []);
  const humanRate = r(humanThreads.filter((t) => t.outcome !== 'open').length, humanThreads.length);

  const byCat = CATS.map((c) => ({ key: c as string, ...fixedRate(onMerged.filter((f) => f.category === c)) }));
  const secFindings = posted.filter((f) => f.category === 'security');
  const sensSince = since.filter((p) => p.sensitive);
  const sensBase = base.filter((p) => p.sensitive);
  const withSec = new Set(secFindings.map((f) => f.pr));
  const riskFilled = (ps: Pr[]) => r(ps.filter((p) => p.risk).length, ps.length);
  const riskMismatch = since.filter((p) => p.sensitive && p.risk === 'low').length;
  const codeqlKnown = D.codeql !== undefined;
  const codeql = D.codeql ?? [];
  const ciMissed = onMerged.filter((f) => f.severity === 'Important' && f.outcome === 'fixed').length;
  const queued = since.filter((p) => p.queued).map((p) => (mergedAt(p) - ms(p.queued!)) / 6e4);
  const grades = D.grading?.grades ?? [];
  const followup = D.grading?.followup ?? [];
  const precision = r(grades.filter((g) => g.grade === 'right_worth').length, grades.length);
  const followAcc = r(followup.filter((g) => g.correct).length, followup.length);

  const fixPrs = merged.filter((p) => FIX_TITLE.test(p.title));
  const reworked = (p: Pr) =>
    fixPrs.some((q) => q.n !== p.n && mergedAt(q) > mergedAt(p) && mergedAt(q) - mergedAt(p) <= 14 * DAY && q.files.some((f) => p.files.includes(f)));
  const settled = (p: Pr) => now - mergedAt(p) >= 14 * DAY;
  const reworkRate = (ps: Pr[]) => {
    const s = ps.filter((p) => !FIX_TITLE.test(p.title));
    return r(s.filter(reworked).length, s.length);
  };
  const ttm = (ps: Pr[]): MergeTimes => ({ n: ps.length, med: median(ps.map(hours)), p90: quant(ps.map(hours), 0.9) });
  const noHuman = (ps: Pr[]) => r(ps.filter((p) => !p.human_review).length, ps.length);

  const weeks: Week[] = [];
  for (let w = monday(baseFrom); w <= now; w += WEEK) {
    const inW = (iso: string) => {
      const t = ms(iso);
      return t >= w && t < w + WEEK;
    };
    const ps = merged.filter((p) => inW(p.merged!));
    const ciRuns = D.ci.filter((x) => inW(x.at));
    const hidden = ps.length < C.minCell;
    const fs = posted.filter((f) => inW(f.posted));
    const prsW = new Set(D.runs.filter((x) => isReview(x) && inW(x.started_at)).map((x) => x.pr_number));
    weeks.push({
      w,
      phase: w >= startMs ? 'review' : 'base',
      n: ps.length,
      hidden,
      med: hidden ? null : median(ps.map(hours)),
      p90: hidden ? null : quant(ps.map(hours), 0.9),
      noHuman: hidden ? null : noHuman(ps).v,
      rework: hidden ? null : reworkRate(ps.filter(settled)).v,
      reworkPending: ps.some((p) => !settled(p)),
      red: ciRuns.length ? ciRuns.filter((x) => x.failed).length / ciRuns.length : null,
      codeql: codeql.filter((a) => inW(a.created)).length,
      dism: fs.length ? fs.filter((f) => f.outcome === 'dismissed').length / fs.length : null,
      perPr: prsW.size ? fs.length / prsW.size : null,
      cost: w >= monday(startMs) ? sum(D.runs.filter((x) => inW(x.started_at)).map((x) => x.cost_usd)) * C.usdNok : null,
    });
  }
  const baseAvg = (k: 'med' | 'noHuman' | 'rework' | 'red'): number | null => {
    const b = weeks.filter((w) => w.phase === 'base' && w[k] != null);
    return b.length ? sum(b.map((w) => w[k])) / b.length : null;
  };

  const runCost = (rs: Run[]) => sum(rs.map((x) => x.cost_usd)) * C.usdNok;
  const nowDate = new Date(now);
  const monthStart = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1);
  const monthEnd = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() + 1, 1);
  const azureMonth = D.azure.filter((a) => ms(a.date) >= monthStart);
  const haveAzure = azureMonth.length > 0;
  const monthRuns = D.runs.filter((x) => ms(x.started_at) >= monthStart);
  const monthNok = haveAzure ? sum(azureMonth.map((a) => a.nok)) : runCost(monthRuns);
  const elapsed = Math.max(1, (now - Math.max(monthStart, startMs)) / DAY);
  const projected = monthNok + (monthNok / elapsed) * Math.max(0, (monthEnd - now) / DAY);
  const reviewedCount = reviewedSet.size;
  const records = D.runs.filter((x) => x.source === 'record' && isReview(x));
  const subagentsMedian = median(records.map((x) => x.subagents));

  const baseT = ttm(base);
  const treatedT = ttm(treated);
  const shadowT = ttm(shadow);
  const vsShadow = shadowT.n >= 10;
  const compare = vsShadow ? shadowT : baseT;
  const mergeChange = compare.med && treatedT.med != null && treatedT.n >= C.minCell ? treatedT.med / compare.med - 1 : null;
  const reworkBase = reworkRate(base.filter(settled));
  const reworkSince = reworkRate(since.filter(settled));

  const criteria: Criterion[] = [
    {
      name: `Important fix rate at least ${pct(C.importantMin)}`,
      value: important.n ? `${pct(important.v)} of ${fmt(important.n)}` : 'None yet',
      status: important.n < 10 ? 'early' : important.v! >= C.importantMin ? 'ok' : 'bad',
    },
    {
      name: 'Catches bugs the automated checks missed',
      value: `${fmt(ciMissed)} Important confirmed fixed`,
      status: week < 3 && ciMissed < C.ciMissedMin ? 'early' : ciMissed >= C.ciMissedMin ? 'ok' : 'bad',
    },
    {
      name: `Under ${pct(C.dismissedMax)} of findings dismissed`,
      value: dismissed.n ? `${pct(dismissed.v)} of ${fmt(dismissed.n)}` : 'No findings yet',
      status: dismissed.n < 20 ? 'early' : dismissed.v! < C.dismissedMax ? 'ok' : 'bad',
    },
    {
      name: `Precision at least ${pct(C.precisionMin)} in grading`,
      value: precision.n ? `${pct(precision.v)} of ${fmt(precision.n)} graded` : 'No grading yet',
      status: !precision.n ? 'wait' : precision.n < 50 ? 'early' : precision.v! >= C.precisionMin ? 'ok' : 'bad',
    },
    {
      name: `Time to merge up by at most ${pct(C.mergeMaxIncrease)}`,
      value: mergeChange == null ? '–' : `${signed(mergeChange)} vs ${vsShadow ? 'shadow group' : 'baseline'}`,
      status: treatedT.n < 20 || mergeChange == null ? 'early' : mergeChange <= C.mergeMaxIncrease ? 'ok' : 'bad',
    },
    {
      name: 'Rework no higher than before',
      value: reworkSince.n ? `${pct(reworkSince.v)} vs ${pct(reworkBase.v)}` : 'Waits 14 days after merge',
      status: reworkSince.n < 20 ? 'early' : reworkSince.v! - (reworkBase.v ?? 0) <= C.reworkMaxIncrease ? 'ok' : 'bad',
    },
    {
      name: `Within NOK ${fmt(C.budgetNok)} a month`,
      value: `NOK ${fmt(projected)} projected`,
      status: elapsed < 5 ? 'early' : projected <= C.budgetNok ? 'ok' : 'bad',
    },
  ];
  const met = criteria.filter((c) => c.status === 'ok').length;

  const decisionMs = startMs + C.weeks * WEEK;
  const running = now >= startMs && now < decisionMs;
  const lastRun = [...D.runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  const today = new Date(now).toISOString().slice(0, 10);
  const runsToday = D.runs.filter((x) => x.started_at.slice(0, 10) === today).length;

  const events: FeedEvent[] = [
    ...(D.changes ?? []).map((c) => ({ t: c.date, kind: 'CHANGE', cls: 'k-change', text: `${c.kind} · ${c.ref ? c.ref.replace(/^.*#/, '#') + ' · ' : ''}${c.note}` })),
    ...D.runs.map((x) => ({
      t: x.started_at,
      kind: x.completed === false ? 'FAILED' : JOB_SHORT[x.job ?? 'review'],
      cls: x.completed === false ? 'k-fail' : 'k-run',
      text: `#${x.pr_number ?? '?'} · ${x.duration_s != null ? fmt(x.duration_s) + ' s' : '–'} · ${x.cost_usd != null ? 'NOK ' + fmt(x.cost_usd * C.usdNok, 1) : '–'}${x.subagents != null && isReview(x) ? ` · ${x.subagents} finders` : ''}${x.arm === 'shadow' ? ' · shadow' : ''}`,
    })),
    ...F.map((f) => ({
      t: f.posted,
      kind: f.arm === 'shadow' ? 'SHADOW' : f.severity === 'Important' ? 'IMPORTANT' : f.severity === 'Nit' ? 'NIT' : 'PRE-EX',
      cls: f.severity === 'Important' ? 'k-imp' : 'k-find',
      text: `#${f.pr} · ${f.path.split('/').slice(-2).join('/')} · ${OUT[f.outcome]?.[1]?.toLowerCase() ?? f.outcome}`,
    })),
  ]
    .sort((a, b) => b.t.localeCompare(a.t))
    .slice(0, 40);

  const createdSince = people.filter((p) => ms(p.created) >= startMs).length;
  const botsSince = D.prs.filter((p) => p.bot && ms(p.created) >= startMs).length;
  const followUps = D.runs.filter((x) => x.job === 'follow-up').length;
  const fixedN = posted.filter((f) => f.outcome === 'fixed').length;
  const dismissedN = posted.filter((f) => f.outcome === 'dismissed').length;
  const shadowN = F.filter((f) => f.arm === 'shadow').length;
  const perPrMean = perPr.length ? sum(perPr) / perPr.length : null;

  const setup: SetupItem[] = [
    {
      name: 'Shadow group',
      value: D.setup?.shadowPercent ? `${fmt(D.setup.shadowPercent)}% of pull requests` : 'Off. Set REVIEW_SHADOW_PERCENT to compare',
      status: D.setup?.shadowPercent ? 'ok' : 'wait',
    },
    {
      name: 'Five finders in every review',
      value:
        subagentsMedian == null
          ? 'No recorded runs yet'
          : subagentsMedian > 0
            ? `Median ${fmt(subagentsMedian)} per review`
            : 'No finders have run. The instructions are not on main yet',
      status: subagentsMedian != null && subagentsMedian > 0 ? 'ok' : 'bad',
    },
    {
      name: 'Hand grading',
      value: grades.length ? `${fmt(grades.length)} findings graded` : C.gradersFound ? 'Ready, none graded yet' : 'Needs two graders',
      status: grades.length ? 'ok' : 'wait',
    },
    { name: 'Pulse survey', value: D.pulse?.length ? `${D.pulse.length} rounds` : 'Sent in week 2', status: D.pulse?.length ? 'ok' : 'early' },
    {
      name: 'Alerts for sensitive changes',
      value: C.sensitiveChannel ? 'Slack channel in use' : 'Slack channel from the proposal not created',
      status: C.sensitiveChannel ? 'ok' : 'wait',
    },
    {
      name: 'Privacy',
      value: C.privacyConfirmed ? 'Confirmed by the data protection officer' : 'Not confirmed with the data protection officer',
      status: C.privacyConfirmed ? 'ok' : 'wait',
    },
  ];

  const hist = [0, 1, 2, 3, 4, 5].map((k) => ({ k, v: perPr.filter((x) => (k === 5 ? x >= 5 : x === k)).length }));
  const areaCounts: Record<string, number> = {};
  for (const f of posted) {
    const k = f.path
      .split('/')
      .slice(0, f.path.startsWith('.') || f.path.startsWith('docs') ? 1 : 2)
      .join('/');
    areaCounts[k] = (areaCounts[k] || 0) + 1;
  }
  const areas = Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  const sensitiveRow = (name: string, ps: Pr[]) => {
    const enough = ps.length >= C.minCell;
    return {
      name,
      n: ps.length,
      reviewed: enough ? ps.filter((p) => reviewedSet.has(p.n)).length / ps.length : null,
      security: enough ? ps.filter((p) => withSec.has(p.n)).length / ps.length : null,
      human: enough ? ps.filter((p) => p.human_review).length / ps.length : null,
    };
  };
  const sensitiveRows = [
    sensitiveRow('Sensitive, baseline', sensBase),
    sensitiveRow('Sensitive, with review', sensSince),
    sensitiveRow('Other, with review', since.filter((p) => !p.sensitive)),
  ];

  const costPerPr = reviewedCount ? runCost(D.runs) / reviewedCount : null;
  const reviewCost = runCost(D.runs.filter(isReview));
  const followCost = runCost(D.runs.filter((x) => x.job === 'follow-up'));
  const shadowCost = runCost(D.runs.filter((x) => x.arm === 'shadow'));
  const perDay: Record<string, { d: string; c: number; prs: Set<number> }> = {};
  for (const x of D.runs) {
    const d = x.started_at.slice(0, 10);
    perDay[d] ??= { d, c: 0, prs: new Set() };
    perDay[d].c += (Number(x.cost_usd) || 0) * C.usdNok;
    if (x.pr_number) perDay[d].prs.add(x.pr_number);
  }
  const costDays = Object.values(perDay)
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(-30)
    .map((d) => ({ d: d.d, perPr: d.c / Math.max(1, d.prs.size) }));

  const daysInMonth = Math.round((monthEnd - monthStart) / DAY);
  const daily: Record<string, number> = {};
  if (haveAzure) for (const a of D.azure) daily[a.date] = (daily[a.date] || 0) + Number(a.nok);
  else
    for (const x of D.runs) {
      const d = x.started_at.slice(0, 10);
      daily[d] = (daily[d] || 0) + (Number(x.cost_usd) || 0) * C.usdNok;
    }
  const monthCumulative: [number, number][] = [];
  let cum = 0;
  for (let i = 0; i < daysInMonth; i++) {
    const t = monthStart + i * DAY;
    if (t > now) break;
    cum += daily[new Date(t).toISOString().slice(0, 10)] || 0;
    monthCumulative.push([i + 1, cum]);
  }

  const runsNewest = [...D.runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const failedRuns = D.runs.filter((x) => x.completed === false).length;
  const coverage = since.length ? since.filter((p) => reviewedSet.has(p.n)).length / since.length : null;

  const runEnd = (x: Run) => ms(x.started_at) + (x.duration_s ?? 0) * 1000;
  const firstReviewEnd = new Map<number, number>();
  for (const x of reviews) {
    if (!x.pr_number || x.completed === false || x.arm === 'shadow') continue;
    const t = runEnd(x);
    if (!firstReviewEnd.has(x.pr_number) || t < firstReviewEnd.get(x.pr_number)!) firstReviewEnd.set(x.pr_number, t);
  }
  const waits = people
    .filter((p) => ms(p.created) >= startMs && firstReviewEnd.has(p.n) && !p.draft)
    .map((p) => (firstReviewEnd.get(p.n)! - ms(p.created)) / 6e4)
    .filter((x) => x >= 0);
  const firstReview = { n: waits.length, med: median(waits), p90: quant(waits, 0.9) };
  const reviewMinutes = reviews.filter((x) => x.duration_s != null).map((x) => x.duration_s! / 60);
  const reviewTime = { n: reviewMinutes.length, med: median(reviewMinutes), p90: quant(reviewMinutes, 0.9) };
  const failRate = r(D.runs.filter((x) => x.completed === false).length, D.runs.length);
  const totalCost = runCost(D.runs.filter((x) => x.arm !== 'shadow'));
  const costPerFix = fixedN ? totalCost / fixedN : null;
  const ignored = r(onMerged.filter((f) => f.outcome === 'open').length, onMerged.length);
  const unresolvedImportant = [
    ...new Map(
      onMerged
        .filter((f) => f.severity === 'Important' && (f.outcome === 'open' || f.outcome === 'discussed'))
        .map((f) => [f.pr, { pr: f.pr, title: f.prTitle, url: f.url }]),
    ).values(),
  ];
  const withSuggestion = fixedRate(onMerged.filter((f) => f.suggestion));
  const withoutSuggestion = fixedRate(onMerged.filter((f) => !f.suggestion));
  const reviewedLines = sum(D.prs.filter((p) => reviewedSet.has(p.n) && p.arm !== 'shadow').map((p) => p.lines));
  const per100Lines = reviewedLines ? (posted.length / reviewedLines) * 100 : null;
  const tokenRuns = D.runs.filter((x) => x.tokens);
  const cacheRead = sum(tokenRuns.map((x) => x.tokens?.cache_read));
  const freshInput = sum(tokenRuns.map((x) => x.tokens?.input));
  const cacheHit = cacheRead + freshInput ? cacheRead / (cacheRead + freshInput) : null;
  const reviewAgain = reviews.filter((x) => x.review_again).length;
  const firstVersion = new Map<number, string>();
  for (const x of [...records].sort((a, b) => a.started_at.localeCompare(b.started_at)))
    if (x.pr_number && x.prompt_version && !firstVersion.has(x.pr_number)) firstVersion.set(x.pr_number, x.prompt_version);
  const promptVersions = [...new Set(records.map((x) => x.prompt_version).filter((v): v is string => !!v))]
    .map((v) => {
      const rs = records.filter((x) => x.prompt_version === v);
      const prs = new Set([...firstVersion].filter(([, w]) => w === v).map(([n]) => n));
      return {
        version: v,
        since: rs.map((x) => x.started_at).sort()[0],
        reviews: rs.length,
        prs: prs.size,
        findings: posted.filter((f) => prs.has(f.pr)).length,
        fixed: fixedRate(onMerged.filter((f) => prs.has(f.pr))),
        cost: runCost(rs) / Math.max(1, rs.length),
      };
    })
    .sort((a, b) => b.since.localeCompare(a.since));

  return {
    now, startMs, week, base, since, treated, shadow, reviews, reviewedSet, reviewedCount, F, posted, onMerged, bySev, important, kinds,
    early, late, dismissed, preexisting, perPr, perPrMean, humanThreads, humanRate, precision, followAcc, grades, weeks, baseAvg,
    baseT, treatedT, shadowT, mergeChange, reworkBase, reworkSince, monthNok, projected, haveAzure, monthStart, monthEnd,
    records, subagentsMedian, criteria, met, byCat, secFindings, sensSince, sensBase, withSec, riskFilled, riskMismatch, codeql, codeqlKnown,
    ciMissed, queued, decisionMs, running, lastRun, runsToday, events, createdSince, botsSince, followUps, fixedN, dismissedN,
    shadowN, setup, hist, areas, sensitiveRows, costPerPr, reviewCost, followCost, shadowCost, costDays, daysInMonth,
    monthCumulative, runsNewest, failedRuns, coverage, firstReview, reviewTime, failRate, totalCost, costPerFix, ignored,
    unresolvedImportant, withSuggestion, withoutSuggestion, per100Lines, cacheHit, reviewAgain, promptVersions,
  };
}

export function filterFindings(F: FlatFinding[], severity: string, outcome: string): FlatFinding[] {
  const order: Record<string, number> = { Important: 0, Nit: 1, 'Pre-existing': 2 };
  return F.filter(
    (f) =>
      (severity === 'All' || f.severity === severity) &&
      (outcome === 'All' ? f.arm !== 'shadow' : outcome === 'shadow' ? f.arm === 'shadow' : f.arm !== 'shadow' && f.outcome === outcome),
  ).sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || b.posted.localeCompare(a.posted));
}
