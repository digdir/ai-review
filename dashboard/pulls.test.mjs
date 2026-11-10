import { describe, expect, it } from 'vitest';
import { authorHash, finding, fromRecord, recordedFindings, touchesSensitive } from './pulls.mjs';

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
