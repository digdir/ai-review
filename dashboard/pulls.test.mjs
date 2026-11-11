import { describe, expect, it } from 'vitest';
import { artifactKind, authorHash, CROSS_MARKER, finding, fromCrossRecord, fromRecord, recordedFindings, reviewerOf, touchesSensitive } from './pulls.mjs';

const bot = { login: 'github-actions[bot]', __typename: 'Bot' };
const person = { login: 'Kari-H', __typename: 'User' };
const thread = (replies, extra = {}) => ({
  isResolved: false,
  isOutdated: false,
  path: 'a.ts',
  line: 3,
  comments: { nodes: [{ author: bot, body: '**Important**: The route skips the tenant check\n\nLong text that stays in GitHub.', createdAt: '2026-11-24T10:00:00Z', url: 'u' }, ...replies] },
  ...extra,
});

describe('collected pull requests', () => {
  it('stores a hash of the lowercased login, never the login', () => {
    expect(authorHash('Kari-H')).toBe(authorHash('kari-h'));
    expect(authorHash('kari-h')).toBe('e4a36f6e82a6053005f8ada8f317d194296f37bde98eac3f0e40f2c239fa6fc0');
    expect(authorHash(undefined)).toBeNull();
  });

  it('keeps only the first line of a finding as its title', () => {
    expect(finding(thread([])).title).toBe('The route skips the tenant check');
    expect(JSON.stringify(finding(thread([])))).not.toMatch(/Long text/);
  });

  it('records when the author first answered a finding', () => {
    const f = finding(thread([{ author: person, body: 'not fixing, because it is a test', createdAt: '2026-11-24T12:00:00Z' }]));
    expect(f).toMatchObject({ outcome: 'dismissed', answered: '2026-11-24T12:00:00Z' });
    expect(finding(thread([])).answered).toBeNull();
  });

  it('counts a fix reply from the follow-up as the answer', () => {
    const f = finding(thread([{ author: bot, body: 'Fixed in `abc1234`', createdAt: '2026-11-24T11:00:00Z' }]));
    expect(f).toMatchObject({ outcome: 'fixed', answered: '2026-11-24T11:00:00Z' });
  });
});

describe('run records', () => {
  const record = { schema: 'digdir.ai-review.run/v1', pr_number: 7, head_sha: 'abc', arm: 'treated', started_at: '2026-11-24T09:00:00Z', findings: [{ title: 'x' }] };

  it('keeps the head commit and counts the findings', () => {
    expect(fromRecord(record)).toMatchObject({ head_sha: 'abc', findings: 1, source: 'record', permission_denials: null });
  });

  it('reads permission denials as a count or a list when the record has them', () => {
    expect(fromRecord({ ...record, permission_denials: 3 }).permission_denials).toBe(3);
    expect(fromRecord({ ...record, permission_denials: [{}, {}] }).permission_denials).toBe(2);
  });

  it('keeps silent-group findings from the records once per path and title', () => {
    const shadow = (at, findings) => ({ ...record, arm: 'shadow', started_at: at, findings });
    const f = { severity: 'preexisting', category: 'security', title: 'Old leak', path: 'a.ts', line_start: 1, line_end: 2, posted: false };
    const out = recordedFindings([shadow('2026-11-24T10:00:00Z', [f]), shadow('2026-11-24T09:00:00Z', [f]), record]);
    expect(out.get(7)).toEqual([{ posted: '2026-11-24T09:00:00Z', severity: 'Pre-existing', category: 'security', title: 'Old leak', path: 'a.ts' }]);
  });

  it('marks a pull request sensitive when it touches auth, tenancy, the gate, migrations, infra or workflows', () => {
    expect(touchesSensitive(['apps/api/src/auth/login.ts'])).toBe(true);
    expect(touchesSensitive(['packages/identity/src/api-keys.ts'])).toBe(true);
    expect(touchesSensitive(['.github/workflows/review.yml'])).toBe(true);
    expect(touchesSensitive(['apps/api/migrations/0042.sql'])).toBe(true);
    expect(touchesSensitive(['apps/portal/src/screens/Overview.tsx', 'docs/README.md'])).toBe(false);
    expect(touchesSensitive([])).toBe(false);
  });
});

describe('the cross-model reviewer', () => {
  const crossBody = `**Important**: The key is read from the payload\n\nText.\n\n<sub>Cross-model review by \`gpt-6.1-sol\`: a second reviewer.</sub>\n${CROSS_MARKER}`;
  const crossThread = (replies = []) => thread(replies, { comments: { nodes: [{ author: bot, body: crossBody, createdAt: '2026-11-24T10:05:00Z', url: 'c' }, ...replies] } });
  const crossRecord = {
    schema: 'digdir.ai-review.cross-run/v1', repo: 'digdir/genki', pr_number: 460, head_sha: 'h', base_sha: 'b', run_id: 99, arm: 'treated', started_at: '2026-11-24T10:00:00Z',
    completed: true, stopped_at_budget: false, model: 'gpt-6.1-sol', prompt_version: 'p', sensitive_paths: 2, turns: 6, tokens: { input: 1000, output: 200, cache_read: 300 }, returned: 3,
    findings: [
      { severity: 'important', category: 'security', title: 'Secret leak', path: 'a.ts', line_start: 1, line_end: 2, duplicate: false, posted: true },
      { severity: 'nit', category: 'security', title: 'Same as before', path: 'a.ts', line_start: 4, line_end: 4, duplicate: true, posted: false },
      { severity: 'nit', category: 'security', title: 'Also before', path: 'b.ts', line_start: 9, line_end: 9, duplicate: true, posted: false },
    ],
  };

  it('tags a thread whose first comment has the marker as cross-model and every other thread as main', () => {
    expect(finding(crossThread())).toMatchObject({ reviewer: 'cross-model', severity: 'Important', title: 'The key is read from the payload' });
    expect(finding(thread([])).reviewer).toBe('main');
    expect(finding(thread([{ author: person, body: `quoting ${CROSS_MARKER}`, createdAt: '2026-11-24T12:00:00Z' }])).reviewer).toBe('main');
  });

  it('a cross-model review body is never the last main review', () => {
    expect(reviewerOf(`Cross-model review by \`gpt-6.1-sol\`: 2 findings, 1 Important, on the security-sensitive parts of this change. ${CROSS_MARKER}`)).toBe('cross-model');
    expect(artifactKind('cross-review-run-460-123-1')).toBe('cross-model');
    expect(artifactKind('review-run-460-123-1')).toBe('main');
    expect(artifactKind('security-sweep-123')).toBeNull();
  });

  it('never reads a cross-model run record as a main review run, or a main record as a cross-model run', () => {
    expect(fromCrossRecord({ ...crossRecord, schema: 'digdir.ai-review.run/v1' })).toBeNull();
    expect(fromCrossRecord(null)).toBeNull();
  });

  it('keeps counts, tokens and cost from a cross-model run record, never titles or paths', () => {
    const run = fromCrossRecord({ ...crossRecord, cost_usd: 0.42 });
    expect(run).toEqual({
      run_id: '99', pr_number: 460, arm: 'treated', started_at: '2026-11-24T10:00:00Z', completed: true, stopped_at_budget: false, model: 'gpt-6.1-sol',
      cost_usd: 0.42, tokens: { input: 1000, output: 200, cache_read: 300 }, returned: 3, duplicates: 2, posted: 1,
    });
    expect(JSON.stringify(run)).not.toMatch(/Secret leak|a\.ts/);
    expect(fromCrossRecord(crossRecord).cost_usd).toBeNull();
  });
});
