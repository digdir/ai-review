import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRepos, problems } from './repos.mjs';

const good = {
  repo: 'digdir/example',
  start: '2026-11-09',
  baselineFrom: '2026-10-19',
  workflows: { review: 'review.yml', ci: 'ci.yml' },
};

describe('repository settings', () => {
  it('accepts a complete file at its own path', () => {
    expect(problems(good, 'digdir/example.json')).toEqual([]);
  });

  it('rejects a file stored under another repository’s name', () => {
    expect(problems(good, 'digdir/other.json')).toEqual(['file must be repos/digdir/example.json']);
  });

  it('rejects a repo that is not owner/name', () => {
    expect(problems({ ...good, repo: 'digdir/genki/../x' })).toContain('repo must be owner/name');
    expect(problems({ ...good, repo: 'genki' })).toContain('repo must be owner/name');
  });

  it('needs dates in order and both workflow names', () => {
    expect(problems({ ...good, baselineFrom: '2026-12-01', workflows: { review: 'review.yml' } })).toEqual([
      'baselineFrom must be before start',
      'workflows.ci must be a workflow file name',
    ]);
  });

  it('takes an optional security sweep workflow, which must be a workflow file name', () => {
    expect(problems({ ...good, workflows: { ...good.workflows, sweep: 'security-sweep.yml' } }, 'digdir/example.json')).toEqual([]);
    expect(problems({ ...good, workflows: { ...good.workflows, sweep: '../x.sh' } }, 'digdir/example.json')).toEqual(['workflows.sweep must be a workflow file name']);
  });

  it('loads every settings file in the repository, genki included', () => {
    const repos = loadRepos(join(import.meta.dirname, '..', 'repos'));
    expect(repos.map((r) => r.repo)).toContain('digdir/genki');
  });

  it('accepts its own paths for changes in the review setup', () => {
    expect(problems({ ...good, changePaths: { rule: ['docs/review-rules.md'] } }, 'digdir/example.json')).toEqual([]);
  });

  it('rejects change paths for an unknown kind or without paths', () => {
    expect(problems({ ...good, changePaths: { rules: ['REVIEW.md'], workflow: [] } }, 'digdir/example.json')).toEqual([
      'changePaths.rules must be rule, workflow or procedure with a list of paths',
      'changePaths.workflow must be rule, workflow or procedure with a list of paths',
    ]);
  });
});
