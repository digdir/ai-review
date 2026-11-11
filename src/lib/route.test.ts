import { describe, expect, it } from 'vitest';
import { parseRoute } from './route';

const repos = ['digdir/genki', 'digdir/other'];
const docs = ['experiment', 'runbook'];

describe('routes', () => {
  it('opens the repositories screen by default', () => {
    expect(parseRoute('', repos)).toMatchObject({ page: 'repositories', repo: null, canonical: '/' });
    expect(parseRoute('#/', repos).repo).toBeNull();
  });

  it('opens a repository on its overview, or the screen named', () => {
    expect(parseRoute('#/digdir/other', repos)).toMatchObject({ repo: 'digdir/other', screen: 'overview' });
    expect(parseRoute('#/digdir/genki/operations', repos)).toMatchObject({ repo: 'digdir/genki', screen: 'operations' });
  });

  it('keeps an in-page anchor after the screen', () => {
    expect(parseRoute('#/digdir/genki/overview#criteria', repos)).toMatchObject({ screen: 'overview', anchor: 'criteria', canonical: '/digdir/genki/overview#criteria' });
  });

  it('opens the start here page', () => {
    expect(parseRoute('#/start', repos)).toMatchObject({ page: 'start', canonical: '/start' });
  });

  it('sends the old tab ids to the screen that took them over', () => {
    expect(parseRoute('#/digdir/genki/cost', repos).canonical).toBe('/digdir/genki/operations');
    expect(parseRoute('#/digdir/genki/runs', repos).canonical).toBe('/digdir/genki/operations');
    expect(parseRoute('#/digdir/genki/quality', repos).canonical).toBe('/digdir/genki/findings');
    expect(parseRoute('#/digdir/genki/repository', repos).canonical).toBe('/digdir/genki/pull-requests');
    expect(parseRoute('#/digdir/genki/security', repos).canonical).toBe('/digdir/genki/findings');
    expect(parseRoute('#/digdir/genki/experiment', repos).canonical).toBe('/digdir/genki/overview#criteria');
  });

  it('keeps links from before the overview of all repositories working', () => {
    expect(parseRoute('#/kvalitet', repos).canonical).toBe('/digdir/genki/findings');
    expect(parseRoute('#/digdir/genki/kostnad', repos).canonical).toBe('/digdir/genki/operations');
  });

  it('falls back to the repositories screen for a repository that is not on the dashboard', () => {
    expect(parseRoute('#/digdir/secret/operations', repos).page).toBe('repositories');
  });

  it('opens a docs page at a heading', () => {
    expect(parseRoute('#/docs/runbook#when-a-review-fails', repos, docs)).toMatchObject({ page: 'docs', doc: 'runbook', anchor: 'when-a-review-fails', canonical: '/docs/runbook#when-a-review-fails' });
  });

  it('opens the first docs page when none or an unknown one is named, without the anchor', () => {
    expect(parseRoute('#/docs', repos, docs).canonical).toBe('/docs/experiment');
    expect(parseRoute('#/docs/secrets#x', repos, docs).canonical).toBe('/docs/experiment');
  });

  it('drops an anchor that is not a plain heading id', () => {
    expect(parseRoute('#/docs/runbook#<img>', repos, docs)).toMatchObject({ anchor: null, canonical: '/docs/runbook' });
  });
});
