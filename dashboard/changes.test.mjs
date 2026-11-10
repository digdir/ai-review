import { describe, expect, it } from 'vitest';
import { autoChanges, changeProblems, mergeChanges, pattern } from './changes.mjs';

const pr = (n, files, merged = '2026-11-12T10:00:00Z', title = `Change ${n}`) => ({ n, title, merged, files });
const opts = { repo: 'digdir/genki', start: '2026-11-09' };

describe('path patterns', () => {
  it('lets a double star span folders and a single star stay within one', () => {
    expect(pattern('.claude/skills/review-change/**').test('.claude/skills/review-change/refs/a.md')).toBe(true);
    expect(pattern('scripts/review-*').test('scripts/review-run.ts')).toBe(true);
    expect(pattern('scripts/review-*').test('scripts/review/x.ts')).toBe(false);
  });

  it('matches a file named with a leading double star both at the root and in a folder', () => {
    expect(pattern('**/AGENTS.md').test('AGENTS.md')).toBe(true);
    expect(pattern('**/AGENTS.md').test('packages/kernel/AGENTS.md')).toBe(true);
    expect(pattern('**/AGENTS.md').test('docs/AGENTS.md.bak')).toBe(false);
  });
});

describe('changes found in pull requests', () => {
  it('logs a merged pull request that touches the review rules as a rule change', () => {
    expect(autoChanges([pr(430, ['REVIEW.md', 'src/a.ts'], '2026-11-12T10:00:00Z', 'Tighter tenant rule')], opts)).toEqual([
      { date: '2026-11-12', kind: 'rule', ref: 'digdir/genki#430', note: 'Tighter tenant rule', source: 'auto' },
    ]);
  });

  it('gives one entry per kind when a pull request changes both rules and the workflow', () => {
    const found = autoChanges([pr(431, ['AGENTS.md', 'CLAUDE.md', '.github/workflows/review.yml', 'scripts/review-run.ts'])], opts);
    expect(found.map((c) => c.kind)).toEqual(['rule', 'workflow']);
  });

  it('counts the review skill as a procedure change', () => {
    expect(autoChanges([pr(432, ['.claude/skills/review-change/SKILL.md'])], opts).map((c) => c.kind)).toEqual(['procedure']);
  });

  it('skips pull requests that are open, merged before the start or touch nothing in the review setup', () => {
    expect(autoChanges([pr(1, ['REVIEW.md'], null), pr(2, ['REVIEW.md'], '2026-11-08T23:00:00Z'), pr(3, ['src/a.ts'])], opts)).toEqual([]);
  });

  it('uses the paths a repository sets instead of the defaults for that kind', () => {
    const paths = { rule: ['docs/review-rules.md'] };
    expect(autoChanges([pr(5, ['REVIEW.md']), pr(6, ['docs/review-rules.md'])], { ...opts, paths }).map((c) => c.ref)).toEqual(['digdir/genki#6']);
  });
});

describe('merging the change log', () => {
  const auto = [
    { date: '2026-11-12', kind: 'rule', ref: 'digdir/genki#430', note: 'Tighter tenant rule', source: 'auto' },
    { date: '2026-11-13', kind: 'workflow', ref: 'digdir/genki#431', note: 'Retry once', source: 'auto' },
  ];

  it('lets a hand-written entry for the same pull request and kind replace the found one', () => {
    const manual = [{ date: '2026-11-12', kind: 'rule', ref: 'digdir/genki#430', note: 'Rule for tenant checks, after #428 slipped through' }];
    const merged = mergeChanges(auto, manual);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ source: 'manual', note: 'Rule for tenant checks, after #428 slipped through' });
  });

  it('keeps hand-written changes made outside the repository and sorts by date', () => {
    const merged = mergeChanges(auto, [{ date: '2026-11-09', kind: 'setup', note: 'Silent share 25 percent' }]);
    expect(merged.map((c) => c.kind)).toEqual(['setup', 'rule', 'workflow']);
  });
});

describe('hand-written change log', () => {
  it('accepts a complete entry', () => {
    expect(changeProblems([{ date: '2026-11-09', kind: 'setup', note: 'Start' }])).toEqual([]);
  });

  it('names each entry with a bad date, kind, note or reference', () => {
    expect(changeProblems([{ date: '9 Nov', kind: 'tweak', ref: '#430' }])).toEqual([
      'entry 1: date must be YYYY-MM-DD',
      'entry 1: kind must be one of rule, model, procedure, workflow, setup, protocol',
      'entry 1: note is missing',
      'entry 1: ref must be owner/name#number',
    ]);
  });
});
