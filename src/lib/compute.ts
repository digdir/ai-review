import { day, fmt, hours, nok, pct, plural, signed, usd, weekday } from './format';
import { CATS, CAT, CRITERIA, DECISION, SETUP_ITEMS, type CriterionKey } from './labels';
import { DAY, WEEK, median, monday, quant, rate, sum, type Rate } from './stats';
import type { Change, Check, Data, Decision, ExperimentConfig, Finding, Phase, Pr, Run, Severity, Status } from './types';

export const DEFAULTS: ExperimentConfig = {
  weeks: 6,
  budgetNok: 7500,
  usdNok: 10.9,
  minCell: 5,
  measureFromWeek: 3,
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

export const READ = { fix: 10, dismissed: 20, precision: 50, ttm: 20, silent: 10, rework: 20, costDays: 5, settleDays: 14, healthWeeks: 4 } as const;

const FIX_TITLE = /^(fix|revert|restore|stop|keep)\b/i;
const SETUP_KINDS: Change['kind'][] = ['rule', 'model', 'procedure', 'workflow'];
const isReview = (r: Run) => (r.job ?? 'review') === 'review';
const ms = (iso: string) => Date.parse(iso);
const changeMs = (c: Change) => ms(c.date + 'T12:00:00Z');

export type Group = 'reviewed' | 'silent' | 'none';

export interface Row {
  posted: string;
  severity: Severity;
  category: string | null;
  title: string;
  path: string;
  outcome: string;
  url: string;
  pr: number;
  prTitle: string;
  merged: boolean;
  group: Group;
  author: string | null;
  answered: string | null;
}

export interface Criterion {
  key: CriterionKey;
  status: Status;
  value: number | null;
  text: string;
  sub: string;
  n: number;
  fill: number | null;
  tick: number;
  tickLabel: string;
}

export interface Rule {
  outcome: Decision;
  text: string;
}

export interface CheckItem {
  name: string;
  text: string;
  status: Check;
}

export interface CheckOut {
  kind: string;
  tone: 'important' | 'dismissed' | 'waiting' | 'rule' | 'escaped' | 'cost' | 'size';
  title: string;
  pr: number | null;
  url: string;
  meta: string[];
}

export interface Timing {
  startMs: number;
  measureMs: number;
  decisionMs: number;
  day: number;
  week: number;
  phase: Phase;
}

/** Where `now` falls in the experiment calendar: setup before the measured weeks, after from the Monday after the last week. */
export function timing(now: number, start: string, C: ExperimentConfig): Timing {
  const startMs = ms(start + 'T00:00:00Z');
  const measureMs = startMs + (Math.max(1, C.measureFromWeek) - 1) * WEEK;
  const decisionMs = startMs + C.weeks * WEEK;
  const week = Math.floor((now - startMs) / WEEK) + 1;
  const phase: Phase = now >= decisionMs ? 'after' : now >= measureMs ? 'measuring' : 'setup';
  return { startMs, measureMs, decisionMs, day: Math.floor((now - startMs) / DAY) + 1, week, phase };
}

export const groupOf = (p: Pr, reviewed: Set<number | null | undefined>): Group =>
  p.arm === 'shadow' ? 'silent' : reviewed.has(p.n) || p.arm === 'treated' ? 'reviewed' : 'none';

export type Metrics = ReturnType<typeof compute>;

export function compute(D: Data, C: ExperimentConfig) {
  const r = (k: number, n: number): Rate => rate(k, n, C.minCell);
  const now = D.now ?? ms(D.generatedAt);
  const T = timing(now, D.config.start, C);
  const { startMs, measureMs, decisionMs, phase } = T;
  const week = Math.max(1, T.week);
  const baseFrom = ms(D.config.baselineFrom + 'T00:00:00Z');
  const changes = [...(D.changes ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const decided = [...changes].reverse().find((c) => c.outcome && changeMs(c) >= measureMs) ?? null;
  const gradingContinues = !!decided && changes.some((c) => c.item === 'grading' && changeMs(c) >= changeMs(decided));

  const people = D.prs.filter((p) => !p.bot);
  const merged = people.filter((p) => p.merged && ms(p.merged) >= baseFrom);
  const mergedAt = (p: Pr) => ms(p.merged!);
  const prHours = (p: Pr) => (mergedAt(p) - ms(p.created)) / 36e5;
  const base = merged.filter((p) => mergedAt(p) < startMs);
  const since = merged.filter((p) => mergedAt(p) >= startMs);
  const reviews = D.runs.filter(isReview);
  const reviewedSet = new Set(reviews.filter((x) => x.arm !== 'shadow').map((x) => x.pr_number));
  const ranSet = new Set(reviews.map((x) => x.pr_number));
  const prByN = new Map(D.prs.map((p) => [p.n, p]));

  const rows: Row[] = D.prs.flatMap((p) => {
    const group = groupOf(p, reviewedSet);
    const base = { pr: p.n, prTitle: p.title, merged: !!p.merged, group, author: p.author_hash ?? null };
    return [
      ...p.findings.map((f: Finding) => ({
        ...base,
        posted: f.posted,
        severity: f.severity,
        category: f.category ?? null,
        title: f.title || f.path,
        path: f.path,
        outcome: f.outcome,
        url: f.url,
        answered: f.answered ?? null,
      })),
      ...(p.recorded ?? []).map((f) => ({
        ...base,
        group: 'silent' as const,
        posted: f.posted,
        severity: f.severity,
        category: f.category ?? null,
        title: f.title || f.path,
        path: f.path,
        outcome: 'recorded',
        url: '',
        answered: null,
      })),
    ];
  });
  const posted = rows.filter((f) => f.group !== 'silent' && f.outcome !== 'recorded');
  const onMerged = posted.filter((f) => f.merged);
  const isImportant = (f: Row) => f.severity === 'Important';
  const fixedRate = (xs: Row[]) => r(xs.filter((f) => f.outcome === 'fixed').length, xs.length);
  const dismissedRate = (xs: Row[]) => r(xs.filter((f) => f.outcome === 'dismissed').length, xs.length);

  const fixPrs = merged.filter((p) => FIX_TITLE.test(p.title));
  const reworked = (p: Pr) =>
    fixPrs.some((q) => q.n !== p.n && mergedAt(q) > mergedAt(p) && mergedAt(q) - mergedAt(p) <= READ.settleDays * DAY && q.files.some((f) => p.files.includes(f)));
  const settled = (p: Pr) => now - mergedAt(p) >= READ.settleDays * DAY;
  const reworkRate = (ps: Pr[]) => {
    const s = ps.filter((p) => !FIX_TITLE.test(p.title) && settled(p));
    return r(s.filter(reworked).length, s.length);
  };
  const ttm = (ps: Pr[]) => ({ n: ps.length, med: median(ps.map(prHours)), p90: quant(ps.map(prHours), 0.9) });
  const baseT = ttm(base);
  const reworkBase = reworkRate(base);

  const runCost = (rs: Run[]) => sum(rs.map((x) => x.cost_usd)) * C.usdNok;
  const nowDate = new Date(now);
  const monthStart = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1);
  const monthEnd = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() + 1, 1);
  const azureMonth = D.azure.filter((a) => ms(a.date) >= monthStart && ms(a.date) < monthEnd);
  const haveAzure = azureMonth.length > 0;
  const monthNok = haveAzure ? sum(azureMonth.map((a) => a.nok)) : runCost(D.runs.filter((x) => ms(x.started_at) >= monthStart));
  const elapsed = (now - Math.max(monthStart, startMs)) / DAY;
  const projectedRaw = monthNok + (monthNok / Math.max(1, elapsed)) * Math.max(0, (monthEnd - now) / DAY);
  const projected = elapsed >= READ.costDays ? projectedRaw : null;
  const daysLeftMonth = Math.ceil((monthEnd - now) / DAY);

  const health = phase === 'after' && !!decided;
  const winFrom = phase === 'setup' ? startMs : health ? now - READ.healthWeeks * WEEK : measureMs;
  const winTo = phase === 'after' && !decided ? decisionMs : now;
  const inWin = (iso: string) => ms(iso) >= winFrom && ms(iso) < winTo;
  const postedW = posted.filter((f) => inWin(f.posted));
  const onMergedW = onMerged.filter((f) => inWin(f.posted));
  const mergedW = since.filter((p) => inWin(p.merged!));
  const windowLabel = phase === 'setup' ? 'so far, not counted' : health ? 'last four weeks' : 'weeks 3 to 6';

  const grades = D.grading?.grades ?? [];
  const weekOf = (t: number) => Math.floor((t - startMs) / WEEK) + 1;
  const gradesW = health && !gradingContinues ? grades : grades.filter((g) => g.week == null || (g.week >= weekOf(winFrom) && g.week <= weekOf(winTo - 1)));

  const crit = (key: CriterionKey, status: Status, value: number | null, text: string, sub: string, n: number, fill: number | null, tick: number, tickLabel: string): Criterion => ({
    key, status: phase === 'setup' ? 'early' : status, value, text, sub, n, fill: fill == null ? null : Math.max(0, Math.min(1, fill)), tick, tickLabel,
  });
  const readFrom = weekday(measureMs);
  const setupSub = (s: string) => (phase === 'setup' ? `So far, not counted. Read from ${readFrom}` : s);

  const impW = fixedRate(onMergedW.filter(isImportant));
  const disW = dismissedRate(postedW);
  const precW = r(gradesW.filter((g) => g.grade === 'right_worth').length, gradesW.length);
  const missedW = onMergedW.filter((f) => isImportant(f) && f.outcome === 'fixed').length;
  const treatedW = ttm(mergedW.filter((p) => reviewedSet.has(p.n) && p.arm !== 'shadow'));
  const silentW = ttm(mergedW.filter((p) => p.arm === 'shadow'));
  const vsSilent = silentW.n >= READ.silent;
  const compareT = vsSilent ? silentW : baseT;
  const mergeChange = compareT.med && treatedW.med != null && treatedW.n >= C.minCell ? treatedW.med / compareT.med - 1 : null;
  const reworkW = reworkRate(mergedW);
  const reworkLimit = (reworkBase.v ?? 0) + C.reworkMaxIncrease;
  const lastWeek = phase === 'after' || week >= C.weeks;

  const criteria: Criterion[] = [
    crit('fix', impW.n < READ.fix ? 'early' : impW.v! >= C.importantMin ? 'met' : 'notmet', impW.v, impW.n ? pct(impW.v) : `${fmt(impW.k)} of ${fmt(impW.n)}`,
      setupSub(impW.n < READ.fix ? `${fmt(impW.k)} of ${fmt(impW.n)} Important on merged, ${READ.fix} needed` : `${fmt(impW.k)} of ${fmt(impW.n)} Important on merged`),
      impW.n, impW.v, C.importantMin, pct(C.importantMin)),
    crit('dismissed', disW.n < READ.dismissed ? 'early' : disW.v! < C.dismissedMax ? 'met' : 'notmet', disW.v, disW.n ? pct(disW.v) : '0 of 0',
      setupSub(disW.n < READ.dismissed ? `${fmt(disW.k)} of ${fmt(disW.n)} posted, ${READ.dismissed} needed` : `${fmt(disW.k)} of ${fmt(disW.n)} posted`),
      disW.n, disW.v, C.dismissedMax, pct(C.dismissedMax)),
    crit('precision', precW.n < READ.precision ? 'early' : precW.v! >= C.precisionMin ? 'met' : 'notmet', precW.v, precW.n ? pct(precW.v) : `${fmt(precW.n)} graded`,
      phase === 'setup' ? `Grading starts ${readFrom}` : `${fmt(precW.k)} of ${fmt(precW.n)} graded${precW.n < READ.precision ? `, ${READ.precision} needed` : ''}${health && !gradingContinues ? '. Weeks 3 to 6; grading stopped after week 6' : ''}${D.grading?.agreement != null ? `. Kappa ${fmt(D.grading.agreement, 2)}` : ''}`,
      precW.n, precW.v, C.precisionMin, pct(C.precisionMin)),
    crit('missed', missedW >= C.ciMissedMin ? 'met' : lastWeek ? 'notmet' : 'early', missedW, fmt(missedW),
      setupSub(missedW >= C.ciMissedMin || lastWeek ? 'Important findings fixed before merge' : `Judged in week ${C.weeks}; ${fmt(C.ciMissedMin)} needed`),
      missedW, missedW / 10, C.ciMissedMin / 10, fmt(C.ciMissedMin)),
    crit('ttm', treatedW.n < READ.ttm || mergeChange == null ? 'early' : mergeChange <= C.mergeMaxIncrease ? 'met' : 'notmet', mergeChange,
      mergeChange == null ? `${fmt(silentW.n)} silent merged` : signed(mergeChange),
      setupSub(mergeChange == null ? `Needs ${READ.silent} silent and ${READ.ttm} reviewed merged` : `${hours(treatedW.med)} reviewed (${fmt(treatedW.n)}) against ${hours(compareT.med)} ${vsSilent ? 'silent' : 'baseline'} (${fmt(compareT.n)})`),
      treatedW.n, mergeChange == null ? null : (mergeChange + 0.3) / 0.8, (C.mergeMaxIncrease + 0.3) / 0.8, signed(C.mergeMaxIncrease)),
    crit('rework', reworkW.n < READ.rework ? 'early' : reworkW.v! <= reworkLimit ? 'met' : 'notmet', reworkW.v, reworkW.n ? pct(reworkW.v) : `${fmt(reworkW.n)} settled`,
      setupSub(`${fmt(reworkW.k)} of ${fmt(reworkW.n)} settled. Baseline ${pct(reworkBase.v)}, limit ${pct(reworkLimit)}`),
      reworkW.n, reworkW.v == null ? null : reworkW.v / 0.2, reworkLimit / 0.2, pct(reworkLimit)),
    crit('cost', projected == null ? 'early' : projected <= C.budgetNok ? 'met' : 'notmet', projected, nok(projected ?? monthNok),
      projected == null ? `Spent so far. Projection from day ${READ.costDays} of the month` : `Projected for ${new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(now)}. ${nok(monthNok)} spent`,
      Math.round(elapsed), (projected ?? monthNok) / (C.budgetNok * 1.25), 0.8, fmt(C.budgetNok)),
  ];
  const counts = { met: criteria.filter((c) => c.status === 'met').length, notmet: criteria.filter((c) => c.status === 'notmet').length, early: criteria.filter((c) => c.status === 'early').length };

  const rule = phase === 'measuring' || (phase === 'after' && !decided) ? ruleToday(criteria, changes, now) : null;

  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - DAY).toISOString().slice(0, 10);
  const failedRuns = D.runs.filter((x) => x.completed === false);
  const openPrs = people.filter((p) => !p.merged && p.state === 'OPEN');
  const waitingRows = posted.filter((f) => f.outcome === 'open' && openPrs.some((p) => p.n === f.pr));
  const oldestWait = waitingRows.length ? Math.min(...waitingRows.map((f) => ms(f.posted))) : null;
  const queue = openPrs.filter((p) => !p.draft && ranSet.has(p.n));
  const lastRun = [...D.runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  const board = {
    runsToday: D.runs.filter((x) => x.started_at.slice(0, 10) === today).length,
    failedToday: failedRuns.filter((x) => x.started_at.slice(0, 10) === today).length,
    runsYesterday: D.runs.filter((x) => x.started_at.slice(0, 10) === yesterday).length,
    failedTotal: failedRuns.length,
    waiting: { threads: waitingRows.length, prs: new Set(waitingRows.map((f) => f.pr)).size, oldestHours: oldestWait == null ? null : (now - oldestWait) / 36e5 },
    queue: { n: queue.length, queued: queue.filter((p) => p.queued).length },
  };

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
  const roundsOf = (n: number) => reviews.filter((x) => x.pr_number === n && x.completed !== false).length;

  const prsSince = people.filter((p) => ms(p.created) >= startMs);
  const reviewedPrs = prsSince.filter((p) => groupOf(p, reviewedSet) === 'reviewed' && ranSet.has(p.n));
  const postedOn = (n: number) => posted.filter((f) => f.pr === n);
  const bucket = (lines: number) => (lines < 50 ? 0 : lines <= 1000 ? 1 : 2);
  const answeredHours = posted.filter((f) => f.answered).map((f) => (ms(f.answered!) - ms(f.posted)) / 36e5).filter((h) => h >= 0);
  const mergedReviewed = reviewedPrs.filter((p) => p.merged);
  const sinceSilent = since.filter((p) => p.arm === 'shadow');
  const sinceReviewed = since.filter((p) => reviewedSet.has(p.n) && p.arm !== 'shadow');
  const meanRounds = (ps: Pr[]) => (ps.length ? sum(ps.map((p) => roundsOf(p.n))) / ps.length : null);
  const noHuman = (ps: Pr[]) => r(ps.filter((p) => !p.human_review).length, ps.length);

  const repo = {
    prs: [...prsSince]
      .sort((a, b) => b.n - a.n)
      .map((p) => {
        const fs = postedOn(p.n);
        return {
          n: p.n,
          title: p.title,
          group: groupOf(p, reviewedSet),
          important: fs.filter((f) => f.severity === 'Important').length,
          nit: fs.filter((f) => f.severity === 'Nit').length,
          pre: fs.filter((f) => f.severity === 'Pre-existing').length,
          recorded: p.recorded?.length ?? 0,
          open: fs.filter((f) => f.outcome === 'open').length,
          mergedHours: p.merged ? prHours(p) : null,
          lines: p.lines,
          escaped: !!p.escaped,
          draft: p.draft,
          author: p.author_hash ?? null,
        };
      }),
    opened: prsSince.length,
    reviewed: reviewedPrs.length,
    silent: prsSince.filter((p) => p.arm === 'shadow').length,
    bots: D.prs.filter((p) => p.bot && ms(p.created) >= startMs).length,
    allFix: fixedRate(posted),
    important: fixedRate(onMerged.filter(isImportant)),
    dismissed: dismissedRate(posted),
    withFinding: r(reviewedPrs.filter((p) => postedOn(p.n).length).length, reviewedPrs.length),
    response: { n: answeredHours.length, med: median(answeredHours), p90: quant(answeredHours, 0.9) },
    mergedOpen: r(mergedReviewed.filter((p) => postedOn(p.n).some((f) => f.outcome === 'open')).length, mergedReviewed.length),
    bySize: ['Under 50 lines', '50 to 1,000 lines', 'Over 1,000 lines'].map((label, i) => {
      const ps = reviewedPrs.filter((p) => bucket(p.lines) === i);
      return { label, n: ps.length, mean: ps.length ? sum(ps.map((p) => postedOn(p.n).length)) / ps.length : null };
    }),
    latency: (
      [
        ['Under 2 min', 0, 2],
        ['2 to 5 min', 2, 5],
        ['5 to 20 min', 5, 20],
        ['Over 20 min', 20, Infinity],
      ] as const
    ).map(([label, lo, hi]) => ({ label, n: waits.filter((w) => w >= lo && w < hi).length })),
    rounds: ['1 round', '2 rounds', '3 or more'].map((label, i) => ({
      label,
      n: reviewedPrs.filter((p) => (i === 2 ? roundsOf(p.n) >= 3 : roundsOf(p.n) === i + 1)).length,
    })),
    perWeek: Array.from({ length: Math.max(0, Math.min(week, phase === 'after' ? week : C.weeks)) }, (_, i) => {
      const from = startMs + i * WEEK;
      const prsW = new Set(reviews.filter((x) => x.arm !== 'shadow' && ms(x.started_at) >= from && ms(x.started_at) < from + WEEK).map((x) => x.pr_number));
      const fs = posted.filter((f) => ms(f.posted) >= from && ms(f.posted) < from + WEEK);
      return { week: i + 1, setup: i + 1 < C.measureFromWeek, prs: prsW.size, perPr: prsW.size ? fs.length / prsW.size : null };
    }),
    side: {
      ready: sinceSilent.length >= READ.silent,
      silentMerged: sinceSilent.length,
      ttm: [ttm(sinceReviewed).med, ttm(sinceSilent).med] as const,
      rework: [reworkRate(sinceReviewed).v, reworkRate(sinceSilent).v] as const,
      rounds: [meanRounds(sinceReviewed), meanRounds(sinceSilent)] as const,
      noHuman: [noHuman(sinceReviewed).v, noHuman(sinceSilent).v] as const,
    },
    byFinder: CATS.map((c) => {
      const fs = posted.filter((f) => f.category === c);
      return { key: c as string, label: CAT[c], n: fs.length, fixed: fixedRate(fs), dismissed: dismissedRate(fs) };
    }),
    openImportant: [
      ...new Map(onMerged.filter((f) => isImportant(f) && (f.outcome === 'open' || f.outcome === 'discussed')).map((f) => [f.pr, { pr: f.pr, title: f.prTitle, url: f.url }])).values(),
    ],
    escaped: D.prs
      .filter((p) => p.escaped && ms(p.created) >= startMs)
      .map((p) => ({ n: p.n, title: p.title, merged: p.merged }))
      .sort((a, b) => b.n - a.n),
  };

  const tokenRuns = D.runs.filter((x) => x.tokens);
  const cacheRead = sum(tokenRuns.map((x) => x.tokens?.cache_read));
  const freshInput = sum(tokenRuns.map((x) => x.tokens?.input));
  const reviewMinutes = reviews.filter((x) => x.duration_s != null).map((x) => x.duration_s! / 60);
  const runUsd = D.runs.map((x) => x.cost_usd).filter((v): v is number => v != null);
  const totalCost = runCost(D.runs);
  const fixedN = posted.filter((f) => f.outcome === 'fixed').length;
  const importantFixedN = posted.filter((f) => isImportant(f) && f.outcome === 'fixed').length;
  const denialRuns = D.runs.filter((x) => x.permission_denials != null);
  const coverageBase = prsSince.filter((p) => !p.draft);
  const codeql = D.codeql ?? [];
  const ops = {
    reviews: reviews.length,
    followUps: D.runs.filter((x) => x.job === 'follow-up').length,
    failed: r(failedRuns.length, D.runs.length),
    reviewTime: { n: reviewMinutes.length, med: median(reviewMinutes), min: quant(reviewMinutes, 0), p90: quant(reviewMinutes, 0.9) },
    emptyRereviews: emptyRereviews(D.runs),
    reviewAgain: reviews.filter((x) => x.review_again).length,
    denials: denialRuns.length ? { runs: denialRuns.length, total: sum(denialRuns.map((x) => x.permission_denials)), max: Math.max(...denialRuns.map((x) => x.permission_denials!)) } : null,
    coverage: r(coverageBase.filter((p) => ranSet.has(p.n)).length, coverageBase.length),
    runsPerDay: Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10);
      const rs = D.runs.filter((x) => x.started_at.slice(0, 10) === d);
      return { date: d, runs: rs.length, failed: rs.filter((x) => x.completed === false).length };
    }),
    failedRuns: [...failedRuns].sort((a, b) => b.started_at.localeCompare(a.started_at)),
    cost: {
      monthNok,
      haveAzure,
      projected,
      perPr: reviewedSet.size ? totalCost / reviewedSet.size : null,
      perFix: fixedN ? totalCost / fixedN : null,
      perImportantFix: importantFixedN ? totalCost / importantFixedN : null,
      cacheHit: cacheRead + freshInput ? cacheRead / (cacheRead + freshInput) : null,
      run: { min: quant(runUsd, 0), med: median(runUsd), max: quant(runUsd, 1) },
    },
    grading: [...new Set(grades.map((g) => g.week).filter((w): w is number => w != null))]
      .sort((a, b) => a - b)
      .map((w) => {
        const gs = grades.filter((g) => g.week === w);
        return { week: w, n: gs.length, right: gs.filter((g) => g.grade === 'right_worth').length };
      }),
    codeqlKnown: D.codeql !== undefined,
    codeql: Array.from({ length: Math.max(0, Math.floor((monday(now) - monday(baseFrom)) / WEEK) + 1) }, (_, i) => {
      const from = monday(baseFrom) + i * WEEK;
      return { from, base: from < startMs, n: codeql.filter((a) => ms(a.created) >= from && ms(a.created) < from + WEEK).length };
    }),
    lastRun,
  };

  const setup: CheckItem[] = SETUP_ITEMS.map(([key, name, hint]) => {
    const c = [...changes].reverse().find((x) => (x.kind === 'setup' || x.kind === 'protocol') && x.item === key);
    if (c) return { name, text: `${day(changeMs(c))}: ${c.note}`, status: 'done' };
    const fallback =
      key === 'silent-share' ? (D.setup?.shadowPercent ? `${fmt(D.setup.shadowPercent)}% from the snapshot` : null)
      : key === 'graders' ? (C.gradersFound || grades.length ? 'Graders in place' : null)
      : key === 'privacy' ? (C.privacyConfirmed ? 'Confirmed in the settings' : null)
      : key === 'channel' ? (C.sensitiveChannel ? 'Channel in use' : null)
      : null;
    return fallback ? { name, text: fallback, status: 'done' } : { name, text: `${hint}. Not in the change log yet`, status: 'todo' };
  });

  const weekAgo = now - WEEK;
  const changesWeek = changes.filter((c) => changeMs(c) >= weekAgo);
  const autoWeek = changesWeek.filter((c) => c.source === 'auto');
  const failedWeek = failedRuns.filter((x) => ms(x.started_at) >= weekAgo);
  const escapedWeek = D.prs.filter((p) => p.escaped && ms(p.created) >= weekAgo);
  const gradingWeek = week - 1;
  const pulseWeek = week === 2 || week === C.weeks;
  const checklist: CheckItem[] = [
    {
      name: 'Changes',
      text: changesWeek.length ? `${plural(changesWeek.length, 'change')} in the last seven days, ${fmt(autoWeek.length)} found automatically. Check the kinds and add anything changed outside the repository.` : 'Nothing logged in the last seven days. Add anything changed outside the repository.',
      status: autoWeek.length ? 'todo' : 'done',
    },
    {
      name: 'Failed runs',
      text: failedWeek.length ? `${plural(failedWeek.length, 'failed run')} in the last seven days.` : 'None in the last seven days.',
      status: failedWeek.length ? 'todo' : 'done',
    },
    {
      name: 'Cost',
      text: projected == null ? `${nok(monthNok)} so far this month. The projection reads from day ${READ.costDays}.` : `Projected ${nok(projected)} of ${nok(C.budgetNok)} (${pct(projected / C.budgetNok)}).`,
      status: projected != null && projected > C.budgetNok * 0.8 ? 'todo' : 'done',
    },
    {
      name: 'Grading',
      text:
        phase === 'measuring' && gradingWeek >= C.measureFromWeek
          ? grades.some((g) => g.week === gradingWeek) ? `Week ${gradingWeek} is graded.` : `Draw the week ${gradingWeek} sample and give it to the two graders.`
          : phase === 'after' && gradingContinues ? 'Grading continues by the change log.'
          : phase === 'after' ? 'Grading stopped after week 6.'
          : `Weeks ${C.measureFromWeek} to ${C.weeks}. Nothing this week.`,
      status: phase === 'measuring' && gradingWeek >= C.measureFromWeek ? (grades.some((g) => g.week === gradingWeek) ? 'done' : 'todo') : 'later',
    },
    {
      name: 'Pulse survey',
      text: pulseWeek && phase !== 'after' ? `End of week ${week}: send the three questions.` : `End of weeks 2 and ${C.weeks}. Nothing this week.`,
      status: pulseWeek && phase !== 'after' ? (D.pulse?.some((p) => p.week === week) ? 'done' : 'todo') : 'later',
    },
    {
      name: 'Missed problems',
      text: escapedWeek.length ? `${plural(escapedWeek.length, 'pull request')} labelled escaped. Check that the review had a chance to see each.` : 'No pull request labelled escaped in the last seven days.',
      status: escapedWeek.length ? 'todo' : 'done',
    },
  ];
  if (phase === 'measuring' && week >= C.weeks) checklist.push({ name: `Week ${C.weeks}`, text: 'Book the decision meeting and start the report.', status: 'todo' });
  if (phase === 'after' && !decided) checklist.push({ name: 'Decision', text: 'Log the decision in the change log as kind protocol with its outcome.', status: 'todo' });

  const recent = (iso: string) => ms(iso) >= weekAgo;
  const checkout = thingsToCheck({ D, rows: posted, changes, prByN, openPrs, reviewedSet, now, recent, usdNok: C.usdNok });

  const sizeText = repo.bySize.map((b) => `${b.label.replace(' lines', '')}: ${b.mean == null ? '–' : fmt(b.mean, 1)}`).join('. ');
  const ours: Record<string, string> = {
    substantive: `${fmt(repo.withFinding.k)} of ${fmt(repo.withFinding.n)} PRs (${pct(repo.withFinding.v)})`,
    bysize: sizeText,
    fix: `All severities ${pct(repo.allFix.v)} (${fmt(repo.allFix.k)} of ${fmt(repo.allFix.n)}). Important ${impW.n ? pct(impW.v) : '–'} (${fmt(impW.k)} of ${fmt(impW.n)}, ${windowLabel})`,
    dismissed: `${pct(repo.dismissed.v)} (${fmt(repo.dismissed.k)} of ${fmt(repo.dismissed.n)})`,
    precision: precW.n ? `${pct(precW.v)} of ${fmt(precW.n)} graded` : 'Not graded yet',
    missed: `${fmt(missedW)}, ${windowLabel}`,
    ttm: mergeChange == null ? 'Too few merged yet' : `${signed(mergeChange)} against the ${vsSilent ? 'silent group' : 'baseline'}`,
    rework: reworkW.n ? `${pct(reworkW.v)} against ${pct(reworkBase.v)} baseline` : 'None settled yet',
    latency: `p50 ${hours(firstReview.med == null ? null : firstReview.med / 60)}, p90 ${hours(firstReview.p90 == null ? null : firstReview.p90 / 60)}`,
    cost: `${usd(ops.cost.run.med)} median per run, ${nok(ops.cost.perPr)} per PR${ops.cost.perImportantFix ? `, ${nok(ops.cost.perImportantFix)} per Important fix` : ''}`,
  };

  return {
    now, T, phase, week, decided, gradingContinues, health, winFrom, winTo, windowLabel, changes, criteria, counts, rule, board, repo, ops, setup,
    checklist, checkout, ours, rows, posted, onMerged, firstReview, monthNok, projected, daysLeftMonth, haveAzure, lastRun, reviewedSet,
    reviews, since, baseT, reworkBase, mergeChange, vsSilent, precision: precW, important: impW, dismissed: disW,
  };
}

/** Review runs of a head commit that an earlier review of the same pull request already covered. */
export function emptyRereviews(runs: Run[]): number {
  const seen = new Set<string>();
  let n = 0;
  for (const x of [...runs].filter(isReview).sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    if (!x.head_sha || !x.pr_number) continue;
    const k = `${x.pr_number}|${x.head_sha}`;
    if (seen.has(k)) n++;
    else seen.add(k);
  }
  return n;
}

/** What the rule in the protocol would give if the last week ended now. */
export function ruleToday(criteria: Criterion[], changes: Change[], now: number): Rule {
  const by = (k: CriterionKey) => criteria.find((c) => c.key === k)!;
  const name = (k: CriterionKey) => CRITERIA.find((d) => d.key === k)!.name.toLowerCase();
  const missed = criteria.filter((c) => c.status === 'notmet');
  const early = criteria.filter((c) => c.status === 'early');
  const list = (cs: Criterion[]) => cs.map((c) => name(c.key)).join(', ');
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  if (!missed.length)
    return { outcome: 'keep', text: early.length ? `No criterion is missed. Keep holds if ${list(early)} come in met.` : 'All seven criteria are met.' };
  const tightened = changes.some((c) => c.kind === 'rule' && changeMs(c) <= now);
  const fresh = [...changes].reverse().find((c) => SETUP_KINDS.includes(c.kind) && changeMs(c) <= now && now - changeMs(c) < 14 * DAY);
  const noise = (['precision', 'dismissed'] as const).filter((k) => by(k).status === 'notmet');
  if (noise.length && tightened) return { outcome: 'stop', text: cap(`${list(noise.map(by))} ${noise.length > 1 ? 'miss' : 'misses'} after the rules were tightened.`) };
  if (by('cost').status === 'notmet' && !fresh) return { outcome: 'stop', text: 'The cost is over the cap and no change to bring it down is logged.' };
  return fresh
    ? { outcome: 'adjust', text: cap(`${list(missed)} ${missed.length > 1 ? 'are' : 'is'} outside the threshold, and the change of ${day(changeMs(fresh))} (${fresh.note}) has not had time to show.`) }
    : { outcome: 'adjust', text: cap(`${list(missed)} ${missed.length > 1 ? 'are' : 'is'} outside the threshold. Adjust needs a logged change that has not had time yet; none in the last 14 days.`) };
}

interface CheckInput {
  D: Data;
  rows: Row[];
  changes: Change[];
  prByN: Map<number, Pr>;
  openPrs: Pr[];
  reviewedSet: Set<number | null | undefined>;
  now: number;
  recent: (iso: string) => boolean;
  usdNok: number;
}

/** Things to check out, by fixed rules: one item per rule, left out when nothing matches. */
export function thingsToCheck({ D, rows, changes, prByN, openPrs, reviewedSet, now, recent, usdNok }: CheckInput): CheckOut[] {
  const repo = D.config.repo;
  const prUrl = (n: number) => `https://github.com/${repo}/pull/${n}`;
  const newest = (xs: Row[]) => [...xs].sort((a, b) => b.posted.localeCompare(a.posted))[0];
  const out: CheckOut[] = [];
  const imp = newest(rows.filter((f) => f.severity === 'Important'));
  if (imp)
    out.push({ kind: 'Important', tone: 'important', title: imp.title, pr: imp.pr, url: imp.url || prUrl(imp.pr), meta: [`Latest Important, ${day(imp.posted)}`, imp.category ? CAT[imp.category] ?? imp.category : '', (OUTCOME[imp.outcome] ?? imp.outcome)].filter(Boolean) });
  const dis = newest(rows.filter((f) => f.outcome === 'dismissed'));
  if (dis) out.push({ kind: 'Dismissed', tone: 'dismissed', title: dis.title, pr: dis.pr, url: dis.url || prUrl(dis.pr), meta: [`Latest dismissed, ${day(dis.posted)}`, dis.severity] });
  const waiting = rows.filter((f) => f.outcome === 'open' && openPrs.some((p) => p.n === f.pr));
  if (waiting.length) {
    const oldest = [...waiting].sort((a, b) => a.posted.localeCompare(b.posted))[0];
    const threads = waiting.filter((f) => f.pr === oldest.pr).length;
    out.push({ kind: 'Waiting', tone: 'waiting', title: `${prByN.get(oldest.pr)?.title ?? 'Pull request'}: ${plural(threads, 'thread')} open for ${hours((now - Date.parse(oldest.posted)) / 36e5)}`, pr: oldest.pr, url: prUrl(oldest.pr), meta: ['Oldest pull request waiting on answers'] });
  }
  const rule = [...changes].reverse().find((c) => c.kind === 'rule');
  if (rule) {
    const n = Number(rule.ref?.split('#')[1]) || null;
    out.push({ kind: 'Rule', tone: 'rule', title: rule.note, pr: n, url: rule.ref ? `https://github.com/${rule.ref.replace('#', '/pull/')}` : '', meta: [`Latest rule change, ${day(changeMs(rule))}`, rule.because ? `Because: ${rule.because}` : ''].filter(Boolean) });
  }
  const esc = D.prs.filter((p) => p.escaped).sort((a, b) => b.created.localeCompare(a.created))[0];
  if (esc) out.push({ kind: 'Escaped', tone: 'escaped', title: esc.title, pr: esc.n, url: prUrl(esc.n), meta: ['Latest fix labelled escaped', day(esc.created)] });
  const costly = D.runs.filter((x) => recent(x.started_at) && x.cost_usd != null).sort((a, b) => b.cost_usd! - a.cost_usd!)[0];
  if (costly)
    out.push({ kind: 'Costliest', tone: 'cost', title: `Most expensive run this week: ${usd(costly.cost_usd)}${costly.pr_number ? ` on #${costly.pr_number}` : ''}`, pr: costly.pr_number ?? null, url: `https://github.com/${repo}/actions/runs/${costly.run_id}`, meta: [`${nok(costly.cost_usd! * usdNok)}`, day(costly.started_at), costly.review_again ? 'review again' : ''].filter(Boolean) });
  const largest = D.prs.filter((p) => reviewedSet.has(p.n) && p.arm !== 'shadow' && D.runs.some((x) => x.pr_number === p.n && recent(x.started_at))).sort((a, b) => b.lines - a.lines)[0];
  if (largest) {
    const fs = rows.filter((f) => f.pr === largest.n);
    out.push({ kind: 'Largest', tone: 'size', title: `Largest pull request reviewed this week: ${fmt(largest.lines)} lines`, pr: largest.n, url: prUrl(largest.n), meta: [largest.title, plural(fs.length, 'finding'), `${fmt(fs.filter((f) => f.outcome === 'fixed').length)} fixed`] });
  }
  return out;
}

const OUTCOME: Record<string, string> = { fixed: 'answered fixed', dismissed: 'dismissed', open: 'no answer yet', discussed: 'discussed', resolved: 'resolved', outdated: 'outdated' };

export interface FindingFilter {
  severity: string;
  outcome: string;
  group: string;
  author: string | null;
}

/** Findings for the list, newest first; silent-group findings show as recorded. */
export function filterFindings(rows: Row[], f: FindingFilter): Row[] {
  return rows
    .filter(
      (x) =>
        (f.severity === 'All' || x.severity === f.severity) &&
        (f.outcome === 'All' || x.outcome === f.outcome) &&
        (f.group === 'All' || x.group === f.group) &&
        (!f.author || x.author === f.author),
    )
    .sort((a, b) => b.posted.localeCompare(a.posted));
}

export const decisionLabel = (d: Decision) => DECISION[d];
