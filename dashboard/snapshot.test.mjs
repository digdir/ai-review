import { describe, expect, it } from 'vitest';
import { fromSnapshot } from './snapshot.mjs';

const alert = { created: '2026-11-02T10:00:00Z', fixed: null, dismissed: null, state: 'open', severity: 'high' };
const snapshot = (over = {}) => ({ schema: 'digdir.ai-review.snapshot/v1', generated_at: '2026-11-09T05:07:00Z', shadow_percent: 20, codeql: [alert], ...over });

describe('review snapshot', () => {
  it('reads the CodeQL alerts and the shadow percentage', () => {
    expect(fromSnapshot(snapshot())).toEqual({ codeql: [alert], shadowPercent: 20, at: '2026-11-09T05:07:00Z' });
  });

  it('ignores a file that is not a snapshot, so the dashboard shows code scanning as unknown', () => {
    expect(fromSnapshot({ schema: 'something/v1', codeql: [] })).toBeUndefined();
    expect(fromSnapshot(null)).toBeUndefined();
  });

  it('drops alerts with an unknown state or a date that is not a date', () => {
    const bad = [{ ...alert, state: 'gone' }, { ...alert, created: 'yesterday' }];
    expect(fromSnapshot(snapshot({ codeql: [alert, ...bad] })).codeql).toEqual([alert]);
  });

  it('treats a shadow percentage outside 0 to 100 as none', () => {
    expect(fromSnapshot(snapshot({ shadow_percent: 250 })).shadowPercent).toBe(0);
  });
});
