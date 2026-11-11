import { isMain } from './pulls.mjs';

export const GRADES = ['right_worth', 'right_not_worth', 'wrong', 'unclear'];
const WEEK = 7 * 864e5;
const SEVERITY = { important: 'Important', nit: 'Nit', preexisting: 'Pre-existing' };

export function weekBounds(start, week) {
  const from = Date.parse(`${start}T00:00:00Z`) + (week - 1) * WEEK;
  return { from, to: from + WEEK };
}

function random(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(xs, rnd) {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Every finding the review produced in the week, from the run records of both groups, once per pull request, file and title. */
export function weekFindings(records, data, week) {
  const { from, to } = weekBounds(data.config.start, week);
  const seen = new Set();
  const out = [];
  for (const r of [...records].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const t = Date.parse(r.started_at);
    if (r?.schema !== 'digdir.ai-review.run/v1' || t < from || t >= to || !r.pr_number) continue;
    for (const f of r.findings ?? []) {
      const key = `${r.pr_number}|${f.path}|${f.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        pr: r.pr_number,
        arm: r.arm,
        severity: SEVERITY[f.severity] ?? f.severity,
        category: f.category ?? null,
        title: f.title,
        path: f.path,
        lineStart: f.line_start ?? f.line_end ?? null,
        lineEnd: f.line_end ?? f.line_start ?? null,
        head: r.head_sha,
        base: r.base_sha,
        run: String(r.run_id),
        outcome: r.arm === 'shadow' ? 'silent' : outcomeOf(data, r.pr_number, f),
      });
    }
  }
  return out;
}

function outcomeOf(data, pr, f) {
  const posted = (data.prs.find((p) => p.n === pr)?.findings ?? []).filter(isMain);
  const sev = SEVERITY[f.severity] ?? f.severity;
  const same = posted.filter((x) => x.path === f.path && x.severity === sev);
  const exact = same.filter((x) => x.line != null && x.line === (f.line_end ?? f.line_start));
  const onPath = posted.filter((x) => x.path === f.path);
  const hit = exact.length === 1 ? exact[0] : same.length === 1 ? same[0] : onPath.length === 1 ? onPath[0] : null;
  const shared = new Set(same.map((x) => x.outcome));
  return hit?.outcome ?? (shared.size === 1 ? [...shared][0] : 'unknown');
}

/** Every Important finding plus a seeded random draw of the rest up to `max`, in a random order, with ids G-<week>-NN. */
export function drawSample(findings, { week, seed, max = 15 }) {
  const rnd = random(seed);
  const important = findings.filter((f) => f.severity === 'Important');
  const rest = shuffle(findings.filter((f) => f.severity !== 'Important'), rnd).slice(0, Math.max(0, max - important.length));
  return shuffle([...important, ...rest], rnd).map((f, i) => ({ id: `G-${week}-${String(i + 1).padStart(2, '0')}`, ...f }));
}

const lines = (f) => (f.lineStart == null ? '' : f.lineEnd && f.lineEnd !== f.lineStart ? `#L${f.lineStart}-L${f.lineEnd}` : `#L${f.lineStart}`);

/** The sheet a grader reads: the claim and the code at the time, never the group, the outcome or the thread. */
export function sheet(sample, { repo, week }) {
  const out = [
    `# Grading, ${repo}, week ${week}`,
    '',
    'Grade each finding from the claim and the change alone. Do not open the pull request or its threads.',
    '',
    '- `right_worth`: the claim holds and the change is worth making',
    '- `right_not_worth`: the claim holds but is not worth the time',
    '- `wrong`: the claim does not hold',
    '- `unclear`: cannot tell from the change',
    '',
    'Write your grades in a copy of `grades-template.json`.',
    '',
  ];
  for (const f of sample) {
    const where = `${f.path}${f.lineStart != null ? `:${f.lineStart}${f.lineEnd && f.lineEnd !== f.lineStart ? `-${f.lineEnd}` : ''}` : ''}`;
    out.push(`## ${f.id}`, '', `**${f.severity}**${f.category ? `, ${f.category}` : ''}: ${f.title}`, '', `- Where: \`${where}\``);
    if (f.head && f.base) out.push(`- The change: https://github.com/${repo}/compare/${f.base}...${f.head}`);
    if (f.head) out.push(`- The file at the time: https://github.com/${repo}/blob/${f.head}/${f.path}${lines(f)}`);
    out.push('');
  }
  return out.join('\n');
}

export const key = (sample) => Object.fromEntries(sample.map((f) => [f.id, { pr: f.pr, arm: f.arm, outcome: f.outcome, severity: f.severity, category: f.category, run: f.run }]));
export const template = (sample) => sample.map((f) => ({ id: f.id, grade: '' }));

/** Cohen's kappa for two graders over the same items, null when there is nothing to compare. */
export function kappa(pairs) {
  if (!pairs.length) return null;
  const n = pairs.length;
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pe = GRADES.reduce((s, g) => s + (pairs.filter(([a]) => a === g).length / n) * (pairs.filter(([, b]) => b === g).length / n), 0);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

/** Joins two graders' sheets for a week into graded findings, using the agreed grade where they differ. */
export function mergeWeek({ week, key: k, graders, agreed = [] }) {
  if (graders.length !== 2) throw new Error('give exactly two graders');
  const ids = Object.keys(k);
  const byId = (list, who) => {
    const m = new Map(list.map((g) => [g.id, g.grade]));
    const missing = ids.filter((id) => !GRADES.includes(m.get(id)));
    if (missing.length) throw new Error(`${who}: no valid grade for ${missing.join(', ')}`);
    return m;
  };
  const [a, b] = graders.map((g, i) => byId(g, `grader ${i + 1}`));
  const settled = new Map(agreed.map((g) => [g.id, g.grade]));
  const open = ids.filter((id) => a.get(id) !== b.get(id) && !GRADES.includes(settled.get(id)));
  if (open.length) throw new Error(`the graders differ and no agreed grade is given for ${open.join(', ')}`);
  return ids.map((id) => ({
    id,
    week,
    severity: k[id].severity,
    arm: k[id].arm,
    grade: a.get(id) === b.get(id) ? a.get(id) : settled.get(id),
    graders: [a.get(id), b.get(id)],
  }));
}

/** Puts a week's grades into the grading file, replacing that week if it was there, and recomputes the agreement. */
export function intoGrading(existing, week, graded) {
  const grades = [...(existing?.grades ?? []).filter((g) => g.week !== week), ...graded].sort((x, y) => (x.week ?? 0) - (y.week ?? 0) || String(x.id).localeCompare(String(y.id)));
  const pairs = grades.filter((g) => Array.isArray(g.graders)).map((g) => g.graders);
  return { ...(existing ?? {}), grades, followup: existing?.followup ?? [], agreement: kappa(pairs) };
}
