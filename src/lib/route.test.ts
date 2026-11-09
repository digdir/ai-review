import { describe, expect, it } from 'vitest';
import { parseRoute } from './route';

const repos = ['digdir/genki', 'digdir/other'];

describe('routes', () => {
  it('opens the overview of all repositories by default', () => {
    expect(parseRoute('', repos)).toEqual({ repo: null, view: null, canonical: '/' });
    expect(parseRoute('#/', repos).repo).toBeNull();
  });

  it('opens a repository on its first tab, or the tab named', () => {
    expect(parseRoute('#/digdir/other', repos)).toMatchObject({ repo: 'digdir/other', view: 'overview' });
    expect(parseRoute('#/digdir/genki/cost', repos)).toMatchObject({ repo: 'digdir/genki', view: 'cost' });
  });

  it('keeps links from before the overview working', () => {
    expect(parseRoute('#/kvalitet', repos).canonical).toBe('/digdir/genki/quality');
    expect(parseRoute('#/digdir/genki/kostnad', repos).canonical).toBe('/digdir/genki/cost');
  });

  it('falls back to the overview for a repository that is not on the dashboard', () => {
    expect(parseRoute('#/digdir/secret/cost', repos).repo).toBeNull();
  });
});
