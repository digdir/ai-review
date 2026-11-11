import { describe, expect, it } from 'vitest';
import { reportedWeek, weeklyIssue } from './weekly.mjs';

const at = (s) => Date.parse(s);
const base = (over = {}) => ({
  config: { repo: 'digdir/genki', start: '2026-11-09', experiment: { weeks: 6 } },
  prs: [],
  runs: [],
  azure: [],
  changes: [],
  ...over,
});
const pr = (n, arm, created, merged, extra = {}) => ({ n, title: `Change ${n}`, arm, bot: false, created, merged, findings: [], ...extra });
const run = (n, arm, startedAt, extra = {}) => ({ run_id: `r${n}`, pr_number: n, arm, job: 'review', started_at: startedAt, completed: true, cost_usd: 1, findings: 0, ...extra });

describe('which week a Monday reports', () => {
  it('reports the last full week, with week 1 starting on the start date', () => {
    expect(reportedWeek('2026-11-09', at('2026-11-16T06:05:00Z'))).toBe(1);
    expect(reportedWeek('2026-11-09', at('2026-11-23T06:05:00Z'))).toBe(2);
    expect(reportedWeek('2026-11-09', at('2026-11-12T06:05:00Z'))).toBe(0);
  });
});

describe('the weekly issue', () => {
  it('says nothing to report before the first week is over', () => {
    expect(weeklyIssue(base(), at('2026-11-10T06:05:00Z')).title).toBe('No full experiment week yet: digdir/genki');
  });

  it('counts reviews by group, posted findings by severity and outcome, and failed runs for the week', () => {
    const d = base({
      prs: [
        pr(1, 'treated', '2026-11-10T08:00:00Z', '2026-11-10T10:00:00Z', {
          findings: [
            { posted: '2026-11-10T09:00:00Z', severity: 'Important', outcome: 'fixed' },
            { posted: '2026-11-10T09:00:00Z', severity: 'Nit', outcome: 'dismissed' },
          ],
        }),
        pr(2, 'shadow', '2026-11-11T08:00:00Z', null),
      ],
      runs: [run(1, 'treated', '2026-11-10T08:30:00Z'), run(2, 'shadow', '2026-11-11T08:30:00Z', { findings: 3 }), run(3, 'treated', '2026-11-11T09:00:00Z', { completed: false })],
    });
    const { title, body } = weeklyIssue(d, at('2026-11-16T06:05:00Z'));
    expect(title).toBe('Experiment week 1 of 6: digdir/genki');
    expect(body).toContain('| Pull requests reviewed, posted | 2 |');
    expect(body).toContain('| Pull requests reviewed, silent | 1 |');
    expect(body).toContain('| Important findings posted | 1 |');
    expect(body).toContain('| Findings in the silent group | 3 |');
    expect(body).toContain('| Posted findings fixed / dismissed / open | 1 / 1 / 0 |');
    expect(body).toContain('Failed runs looked at: digdir/genki#3');
    expect(body).toContain('Week 1 is setup and not part of the decision.');
  });

  it('a cross-model thread does not count toward the posted findings of the week', () => {
    const posted = { posted: '2026-11-10T09:00:00Z', severity: 'Important', outcome: 'fixed' };
    const d = base({
      prs: [pr(1, 'treated', '2026-11-10T08:00:00Z', null, { findings: [posted, { ...posted, reviewer: 'cross-model', outcome: 'dismissed' }] })],
      runs: [run(1, 'treated', '2026-11-10T08:30:00Z')],
    });
    const { body } = weeklyIssue(d, at('2026-11-16T06:05:00Z'));
    expect(body).toContain('| Important findings posted | 1 |');
    expect(body).toContain('| Posted findings fixed / dismissed / open | 1 / 0 / 0 |');
  });

  it('hides the median time to merge below minCell', () => {
    const d = base({ prs: [pr(1, 'treated', '2026-11-10T08:00:00Z', '2026-11-10T10:00:00Z')] });
    expect(weeklyIssue(d, at('2026-11-16T06:05:00Z')).body).toContain('| Reviewed | 1 | fewer than 5 |');
  });

  it('lists the week’s changes and the pull requests labelled escaped', () => {
    const d = base({
      changes: [{ date: '2026-11-12', kind: 'rule', ref: 'digdir/genki#430', note: 'Tighter tenant rule', source: 'auto' }],
      prs: [pr(440, 'treated', '2026-11-13T08:00:00Z', null, { escaped: true, title: 'Fix the tenant check' })],
    });
    const { body } = weeklyIssue(d, at('2026-11-16T06:05:00Z'));
    expect(body).toContain('- 2026-11-12, rule: digdir/genki#430 Tighter tenant rule (found in the pull request)');
    expect(body).toContain('- digdir/genki#440 Fix the tenant check');
  });

  it('asks for a grading sample only in the measurement weeks, and for the merge the week after', () => {
    expect(weeklyIssue(base(), at('2026-11-23T06:05:00Z')).body).not.toContain('grading-sample');
    const week3 = weeklyIssue(base(), at('2026-11-30T06:05:00Z')).body;
    expect(week3).toContain('npm run grading-sample -- --repo digdir/genki --week 3');
    expect(week3).not.toContain('grading-merge');
    expect(weeklyIssue(base(), at('2026-12-07T06:05:00Z')).body).toContain('npm run grading-merge -- --repo digdir/genki --week 3');
  });

  it('asks for the pulse survey after weeks 2 and 6, and for the decision and report after week 6', () => {
    expect(weeklyIssue(base(), at('2026-11-23T06:05:00Z')).body).toContain('Pulse survey');
    expect(weeklyIssue(base(), at('2026-11-30T06:05:00Z')).body).not.toContain('Pulse survey');
    const last = weeklyIssue(base(), at('2026-12-21T06:05:00Z')).body;
    expect(last).toContain('Pulse survey');
    expect(last).toContain('Decision meeting');
    expect(last).toContain('Rework for week 6 read on 2027-01-04');
  });

  it('names a week after the experiment as such', () => {
    expect(weeklyIssue(base(), at('2026-12-28T06:05:00Z')).title).toBe('After the experiment, week 7: digdir/genki');
  });
});
