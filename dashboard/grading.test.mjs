import { describe, expect, it } from 'vitest';
import { drawSample, intoGrading, kappa, key, mergeWeek, sheet, template, weekFindings } from './grading.mjs';

const data = {
  config: { repo: 'digdir/genki', start: '2026-11-09' },
  prs: [{ n: 430, findings: [{ path: 'a.ts', line: 12, severity: 'Important', outcome: 'fixed' }] }],
};
const record = (pr, arm, startedAt, findings, run = `r${pr}`) => ({
  schema: 'digdir.ai-review.run/v1', pr_number: pr, arm, started_at: startedAt, run_id: run, head_sha: `h${pr}`, base_sha: `b${pr}`, findings,
});
const f = (title, severity = 'nit', path = 'a.ts', line = 12) => ({ severity, title, path, line_start: line, line_end: line, category: 'correctness' });

describe('findings for a week', () => {
  it('takes findings from both groups in the week and maps the outcome of posted ones', () => {
    const found = weekFindings(
      [
        record(430, 'treated', '2026-11-24T09:00:00Z', [f('Tenant check missing', 'important')]),
        record(431, 'shadow', '2026-11-25T09:00:00Z', [f('Name is unclear')]),
        record(432, 'treated', '2026-11-17T09:00:00Z', [f('Last week')]),
      ],
      data,
      3,
    );
    expect(found.map((x) => [x.pr, x.arm, x.severity, x.outcome])).toEqual([
      [430, 'treated', 'Important', 'fixed'],
      [431, 'shadow', 'Nit', 'silent'],
    ]);
  });

  it('takes the outcome of several matching posted findings when they all agree, and says unknown when they do not', () => {
    const many = (outcomes) => ({ ...data, prs: [{ n: 430, findings: outcomes.map((outcome) => ({ path: 'a.ts', line: null, severity: 'Nit', outcome })) }] });
    const rs = [record(430, 'treated', '2026-11-24T09:00:00Z', [f('One')])];
    expect(weekFindings(rs, many(['fixed', 'fixed']), 3)[0].outcome).toBe('fixed');
    expect(weekFindings(rs, many(['fixed', 'open']), 3)[0].outcome).toBe('unknown');
  });

  it('a cross-model thread does not decide the outcome of a graded finding', () => {
    const rs = [record(430, 'treated', '2026-11-24T09:00:00Z', [f('One')])];
    const both = { ...data, prs: [{ n: 430, findings: [{ path: 'a.ts', line: null, severity: 'Nit', outcome: 'fixed' }, { path: 'a.ts', line: null, severity: 'Nit', outcome: 'open', reviewer: 'cross-model' }] }] };
    expect(weekFindings(rs, both, 3)[0].outcome).toBe('fixed');
  });

  it('counts a finding repeated by a second review of the same pull request once', () => {
    const rs = [record(430, 'treated', '2026-11-24T09:00:00Z', [f('Same')], 'r1'), record(430, 'treated', '2026-11-25T09:00:00Z', [f('Same')], 'r2')];
    expect(weekFindings(rs, data, 3).map((x) => x.run)).toEqual(['r1']);
  });
});

describe('the sample', () => {
  const findings = Array.from({ length: 30 }, (_, i) => ({ pr: 400 + i, severity: i < 4 ? 'Important' : 'Nit', title: `t${i}`, path: 'a.ts', arm: 'treated' }));

  it('keeps every Important finding and fills up to the maximum with others', () => {
    const s = drawSample(findings, { week: 3, seed: 7, max: 15 });
    expect(s).toHaveLength(15);
    expect(s.filter((x) => x.severity === 'Important')).toHaveLength(4);
  });

  it('draws the same sample for the same seed and numbers the ids by week', () => {
    const a = drawSample(findings, { week: 3, seed: 7 });
    expect(drawSample(findings, { week: 3, seed: 7 })).toEqual(a);
    expect(a[0].id).toBe('G-3-01');
    expect(drawSample(findings, { week: 3, seed: 8 }).map((x) => x.pr)).not.toEqual(a.map((x) => x.pr));
  });
});

describe('the sheet', () => {
  const [one] = drawSample(
    [{ pr: 431, arm: 'shadow', outcome: 'silent', severity: 'Nit', category: 'docs', title: 'Name is unclear', path: 'a.ts', lineStart: 3, lineEnd: 5, head: 'h1', base: 'b1', run: 'r1' }],
    { week: 3, seed: 1 },
  );

  it('shows the claim, the change at the time and the file, never the group, outcome or pull request', () => {
    const text = sheet([one], { repo: 'digdir/genki', week: 3 });
    expect(text).toContain('**Nit**, docs: Name is unclear');
    expect(text).toContain('https://github.com/digdir/genki/compare/b1...h1');
    expect(text).toContain('https://github.com/digdir/genki/blob/h1/a.ts#L3-L5');
    expect(text).not.toMatch(/shadow|silent|\/pull\/|431/);
  });

  it('keeps the group and outcome in the key and leaves the template blank', () => {
    expect(key([one])).toEqual({ 'G-3-01': { pr: 431, arm: 'shadow', outcome: 'silent', severity: 'Nit', category: 'docs', run: 'r1' } });
    expect(template([one])).toEqual([{ id: 'G-3-01', grade: '' }]);
  });
});

describe('merging grades', () => {
  const k = { 'G-3-01': { severity: 'Important', arm: 'treated' }, 'G-3-02': { severity: 'Nit', arm: 'shadow' } };
  const a = [{ id: 'G-3-01', grade: 'right_worth' }, { id: 'G-3-02', grade: 'wrong' }];
  const b = [{ id: 'G-3-01', grade: 'right_worth' }, { id: 'G-3-02', grade: 'unclear' }];

  it('gives kappa 1 for full agreement and 0 for agreement no better than chance', () => {
    expect(kappa([['wrong', 'wrong'], ['right_worth', 'right_worth']])).toBe(1);
    expect(kappa([['wrong', 'wrong'], ['wrong', 'right_worth'], ['right_worth', 'wrong'], ['right_worth', 'right_worth']])).toBe(0);
  });

  it('refuses to merge while the graders differ without an agreed grade, naming the findings', () => {
    expect(() => mergeWeek({ week: 3, key: k, graders: [a, b] })).toThrow('G-3-02');
  });

  it('refuses a grader sheet with a missing or unknown grade', () => {
    expect(() => mergeWeek({ week: 3, key: k, graders: [a, [{ id: 'G-3-01', grade: 'maybe' }]] })).toThrow('grader 2: no valid grade for G-3-01, G-3-02');
  });

  it('uses the agreed grade where the graders differ and keeps both raw grades', () => {
    const graded = mergeWeek({ week: 3, key: k, graders: [a, b], agreed: [{ id: 'G-3-02', grade: 'wrong' }] });
    expect(graded[1]).toEqual({ id: 'G-3-02', week: 3, severity: 'Nit', arm: 'shadow', grade: 'wrong', graders: ['wrong', 'unclear'] });
  });

  it('replaces a week that is merged again instead of adding it twice, and keeps the follow-up checks', () => {
    const graded = mergeWeek({ week: 3, key: k, graders: [a, a] });
    const once = intoGrading({ grades: [], followup: [{ correct: true }] }, 3, graded);
    const twice = intoGrading(once, 3, graded);
    expect(twice.grades).toHaveLength(2);
    expect(twice.followup).toEqual([{ correct: true }]);
    expect(twice.agreement).toBe(1);
  });
});
