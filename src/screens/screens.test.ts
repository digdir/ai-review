import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { DEFAULTS, compute } from '../lib/compute';
import { fleet } from '../lib/fleet';
import { sample, type SampleState } from '../lib/sample';
import Docs from '../views/Docs.svelte';
import Fleet from '../views/Fleet.svelte';
import Start from '../views/Start.svelte';
import Findings from './Findings.svelte';
import Operations from './Operations.svelte';
import Overview from './Overview.svelte';
import Repository from './Repository.svelte';

const states: SampleState[] = ['setup', 'measuring', 'after'];
const dates = { start: 'Mon 9 Nov', measure: 'Mon 23 Nov', decision: 'Mon 21 Dec' };

describe.each(states)('screens with the %s sample', (state) => {
  const data = sample(state);
  const config = DEFAULTS;
  const m = compute(data, config);
  const at = { collected: data.generatedAt, ok: true };

  it.each([
    ['Overview', () => render(Overview, { props: { data, m, config, ...at, showStart: true, ondismiss: () => {} } })],
    ['Repository', () => render(Repository, { props: { data, m, author: null, username: '', onusername: () => {} } })],
    ['Findings', () => render(Findings, { props: { data, m, author: null, username: '', onusername: () => {} } })],
    ['Operations', () => render(Operations, { props: { data, m, config, ...at } })],
    ['Repositories', () => render(Fleet, { props: { rows: fleet([data], null) } })],
    ['Start here', () => render(Start, { props: { dates } })],
  ])('%s renders without errors', (_, run) => {
    expect(run().body.length).toBeGreaterThan(500);
  });

  it('never shows the old go/no-go words', () => {
    const body = render(Overview, { props: { data, m, config, ...at, showStart: true, ondismiss: () => {} } }).body;
    expect(body).not.toMatch(/\b(GO|NO-GO|HOLD|FAULT|STANDBY)\b/);
    expect(body).not.toMatch(/—/);
  });
});

describe('phase on the overview', () => {
  const body = (state: SampleState) => {
    const data = sample(state);
    const m = compute(data, DEFAULTS);
    return render(Overview, { props: { data, m, config: DEFAULTS, collected: data.generatedAt, ok: true, showStart: false, ondismiss: () => {} } }).body;
  };

  it('says nothing is decided in the setup weeks', () => {
    expect(body('setup')).toMatch(/Nothing is decided in the setup weeks/);
    expect(body('setup')).not.toMatch(/status (met|notmet)"/);
  });

  it('says what the rule would give if week 6 ended today while measuring', () => {
    expect(body('measuring')).toMatch(/If week 6 ended today: (Keep|Adjust|Stop)/);
  });

  it('shows the decision and the criteria as health after the experiment', () => {
    expect(body('after')).toMatch(/Decided 22 Dec: Keep/);
    expect(body('after')).toMatch(/Last four weeks, as ongoing health/);
  });
});

describe('docs and charts', () => {
  it('renders a docs page with its headings in the nav and links that stay in the app', () => {
    const body = render(Docs, { props: { page: 'runbook', anchor: 'when-a-review-fails' } }).body;
    expect(body).toContain('<h1>Runbook</h1>');
    expect(body).toContain('href="#/docs/runbook#when-the-budget-alerts"');
    expect(body).toContain('id="when-a-review-fails"');
    expect(body).toContain('href="#/docs/experiment#the-change-log"');
  });

  it('opens the first page when the page is unknown', () => {
    expect(render(Docs, { props: { page: 'nope', anchor: null } }).body).toContain('<h1>The experiment</h1>');
  });

  it('draws runs per day, findings by week and the budget meter on the measuring sample', () => {
    const data = sample('measuring');
    const m = compute(data, DEFAULTS);
    const ops = render(Operations, { props: { data, m, config: DEFAULTS, collected: data.generatedAt, ok: true } }).body;
    expect(ops).toContain('aria-label="Runs per day over the last two weeks, failed runs marked"');
    expect(ops).toMatch(/aria-label="NOK [\d,]+ spent, NOK [\d,]+ projected, budget NOK 7,500"/);
    const repo = render(Repository, { props: { data, m, author: null, username: '', onusername: () => {} } }).body;
    expect(repo).toContain('aria-label="Findings per reviewed pull request by week"');
    expect(repo).toContain('aria-label="Mean posted findings per pull request, by size"');
  });
});
