const DAY = 864e5;
const WEEK = 7 * DAY;
const SEVERITIES = ['Important', 'Nit', 'Pre-existing'];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const hours = (h) => (h == null ? '–' : h < 10 ? `${h.toFixed(1)} h` : `${Math.round(h)} h`);

/** The week to report on Monday: the last full experiment week before `now`, 1 being the week that starts on `start`. */
export function reportedWeek(start, now) {
  return Math.floor((now - Date.parse(`${start}T00:00:00Z`)) / WEEK);
}

/** Title and body of the weekly issue for one repository in the experiment, from its collected data. */
export function weeklyIssue(data, now) {
  const repo = data.config.repo;
  const X = { weeks: 6, measureFromWeek: 3, minCell: 5, usdNok: 10.9, ...data.config.experiment };
  const startMs = Date.parse(`${data.config.start}T00:00:00Z`);
  const L = reportedWeek(data.config.start, now);
  if (L < 1) {
    const first = new Date(startMs + WEEK).toISOString().slice(0, 10);
    return { title: `No full experiment week yet: ${repo}`, body: `Week 1 starts ${data.config.start}. The first report is on ${first}.\n` };
  }
  const from = startMs + (L - 1) * WEEK;
  const to = from + WEEK;
  const inWeek = (iso) => {
    const t = Date.parse(iso);
    return t >= from && t < to;
  };
  const after = L > X.weeks;
  const title = after ? `After the experiment, week ${L}: ${repo}` : `Experiment week ${L} of ${X.weeks}: ${repo}`;

  const reviews = data.runs.filter((r) => (r.job ?? 'review') === 'review' && inWeek(r.started_at));
  const prsOf = (arm) => new Set(reviews.filter((r) => (arm === 'shadow' ? r.arm === 'shadow' : r.arm !== 'shadow')).map((r) => r.pr_number)).size;
  const posted = data.prs.flatMap((p) => (p.arm === 'shadow' ? [] : p.findings)).filter((f) => inWeek(f.posted));
  const silentFindings = reviews.filter((r) => r.arm === 'shadow').reduce((s, r) => s + (Number(r.findings) || 0), 0);
  const count = (pred) => posted.filter(pred).length;
  const merged = data.prs.filter((p) => !p.bot && p.merged && inWeek(p.merged));
  const mergedRow = (label, ps) => {
    const h = ps.map((p) => (Date.parse(p.merged) - Date.parse(p.created)) / 36e5);
    return `| ${label} | ${ps.length} | ${ps.length >= X.minCell ? hours(median(h)) : `fewer than ${X.minCell}`} |`;
  };
  const failed = data.runs.filter((r) => r.completed === false && inWeek(r.started_at));
  const azure = (data.azure ?? []).filter((a) => inWeek(`${a.date}T12:00:00Z`));
  const cost = azure.length
    ? azure.reduce((s, a) => s + Number(a.nok), 0)
    : data.runs.filter((r) => inWeek(r.started_at)).reduce((s, r) => s + (Number(r.cost_usd) || 0) * X.usdNok, 0);
  const changes = (data.changes ?? []).filter((c) => inWeek(`${c.date}T12:00:00Z`));
  const escaped = data.prs.filter((p) => p.escaped && inWeek(p.created));
  const link = (n) => `${repo}#${n}`;

  const out = [];
  out.push(`${day(from)} to ${day(to - DAY)}.${L < X.measureFromWeek ? ` Week ${L} is setup and not part of the decision.` : after ? ' The experiment is over; this is for the report.' : ''}`, '');
  out.push('## Last week', '');
  out.push('| | Count |', '| --- | --- |');
  out.push(`| Pull requests reviewed, posted | ${prsOf('treated')} |`, `| Pull requests reviewed, silent | ${prsOf('shadow')} |`);
  for (const s of SEVERITIES) out.push(`| ${s} findings posted | ${count((f) => f.severity === s)} |`);
  out.push(`| Findings in the silent group | ${silentFindings} |`);
  out.push(`| Posted findings fixed / dismissed / open | ${count((f) => f.outcome === 'fixed')} / ${count((f) => f.outcome === 'dismissed')} / ${count((f) => f.outcome === 'open')} |`);
  out.push(`| Failed review runs | ${failed.length} |`, `| Cost | NOK ${Math.round(cost)}${azure.length ? '' : ' (from the run records)'} |`, '');
  out.push('| Merged | Pull requests | Median time to merge |', '| --- | --- | --- |');
  out.push(mergedRow('Reviewed', merged.filter((p) => p.arm && p.arm !== 'shadow')), mergedRow('Silent', merged.filter((p) => p.arm === 'shadow')), '');

  out.push('## Changes logged', '');
  if (changes.length) for (const c of changes) out.push(`- ${c.date}, ${c.kind}: ${c.ref ? `${c.ref} ` : ''}${c.note}${c.source === 'auto' ? ' (found in the pull request)' : ''}`);
  else out.push('None.');
  out.push('', '## Problems the review missed', '');
  out.push(escaped.length ? escaped.map((p) => `- ${link(p.n)} ${p.title}`).join('\n') : 'None labelled `escaped`.', '');

  out.push('## Checklist', '');
  out.push('- [ ] Every change to the review setup last week is in the list above, with the right kind');
  out.push(`- [ ] Changes made outside the repository (model, Azure, settings) are added to \`inputs/${repo}/changes.json\``);
  if (L >= X.measureFromWeek && L <= X.weeks) out.push(`- [ ] Grading sample drawn and sent to both graders: \`npm run grading-sample -- --repo ${repo} --week ${L}\``);
  if (L - 1 >= X.measureFromWeek && L - 1 <= X.weeks) out.push(`- [ ] Grades for week ${L - 1} merged: \`npm run grading-merge -- --repo ${repo} --week ${L - 1} --graders a.json b.json\``);
  if (failed.length) out.push(`- [ ] Failed runs looked at: ${[...new Set(failed.map((r) => r.pr_number).filter(Boolean))].map(link).join(', ') || failed.length}`);
  out.push('- [ ] Fixes for bugs the review could have caught are labelled `escaped`');
  if (L === 2 || L === X.weeks) out.push('- [ ] Pulse survey sent to everyone who opened a pull request in the period');
  if (L === X.weeks) {
    out.push('- [ ] Decision meeting booked: keep, adjust or stop, from the criteria on the dashboard');
    out.push('- [ ] Report to the lab written, and the outcome filled in on the proposal');
    out.push(`- [ ] Rework for week ${X.weeks} read on ${day(to - DAY + 15 * DAY)}, 14 days after the last merge`);
  }
  return { title, body: out.join('\n') + '\n' };
}
