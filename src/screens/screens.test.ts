import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { DEFAULTS, compute } from '../lib/compute';
import { fleet } from '../lib/fleet';
import { parseRoute } from '../lib/route';
import { sample, type SampleState } from '../lib/sample';
import Shell from '../lib/ui/Shell.svelte';
import Docs from '../views/Docs.svelte';
import Fleet from '../views/Fleet.svelte';
import Start from '../views/Start.svelte';
import Findings from './Findings.svelte';
import Operations from './Operations.svelte';
import Overview from './Overview.svelte';
import PullRequests from './PullRequests.svelte';

const states: SampleState[] = ['setup', 'measuring', 'after'];
const dates = { start: 'Mon 9 Nov', measure: 'Mon 23 Nov', decision: 'Mon 21 Dec' };
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ').replace(/\s+/g, ' ');

const pages = (state: SampleState) => {
  const data = sample(state);
  const m = compute(data, DEFAULTS);
  const user = { author: null, username: '', onusername: () => {} };
  return {
    data,
    m,
    Overview: () => render(Overview, { props: { data, m, config: DEFAULTS } }).body,
    'Pull requests': () => render(PullRequests, { props: { data, m, ...user } }).body,
    Findings: () => render(Findings, { props: { data, m, ...user } }).body,
    Operations: () => render(Operations, { props: { data, m, config: DEFAULTS, collected: data.generatedAt, ok: true } }).body,
    Repositories: () => render(Fleet, { props: { rows: fleet([data], null) } }).body,
    'Start here': () => render(Start, { props: { dates } }).body,
  };
};

describe.each(states)('pages with the %s sample', (state) => {
  const p = pages(state);
  const names = ['Overview', 'Pull requests', 'Findings', 'Operations', 'Repositories', 'Start here'] as const;

  it.each(names)('%s has one h1, no em-dashes and none of the old words or explain buttons', (name) => {
    const body = p[name]();
    expect(body.match(/<h1\b/g)).toHaveLength(1);
    expect(body).not.toMatch(/—/);
    expect(text(body)).not.toMatch(/\b(GO|NO-GO|HOLD|FAULT|STANDBY)\b/);
    expect(body).not.toMatch(/class="why"|aria-label="Explain /);
  });

  it.each(['Overview', 'Pull requests', 'Findings', 'Operations'] as const)('%s ends with the definitions of its figures', (name) => {
    const body = p[name]();
    expect(body).toContain('How these figures are measured');
    expect(body.indexOf('id="definitions"')).toBeGreaterThan(body.indexOf('class="stats"'));
  });
});

describe('the primary question of each page', () => {
  const p = pages('measuring');

  it('overview asks whether the review can be trusted and answers in a sentence', () => {
    const body = p.Overview();
    expect(text(body)).toMatch(/Can we trust the AI review yet\?/);
    expect(text(body)).toMatch(/(Not yet|So far, yes)\. \d of 7 criteria met, \d not met, \d too early\. If week 6 ended today: (Keep|Adjust|Stop)\./);
  });

  it('overview shows the weekly trend of fixed and dismissed findings with the 50% limit', () => {
    const body = p.Overview();
    expect(body).toMatch(/aria-label="Fixed and dismissed share of posted findings by week\. Week 1: \d+% fixed/);
    expect(body).toContain('Dismissed limit, 50%');
  });

  it('overview lists the seven criteria in one table with a status tag each', () => {
    const body = p.Overview();
    const table = body.slice(body.indexOf('id="criteria"'), body.indexOf('id="rule"'));
    expect(table.match(/class="ds-tag"/g)).toHaveLength(7);
  });

  it('pull requests lists the pull requests and what waits on an answer', () => {
    const body = text(p['Pull requests']());
    expect(body).toMatch(/Waiting on authors \d+ threads?/);
    expect(body).toMatch(/#\d+ /);
    expect(body).toMatch(/Is it slowing us down\?/);
  });

  it('findings asks whether findings are right and get fixed', () => {
    const body = text(p.Findings());
    expect(body).toMatch(/Are the findings right, and do they get fixed\?/);
    expect(body).toMatch(/Findings acted on \d+%/);
  });

  it('operations asks whether the review runs within budget', () => {
    const body = p.Operations();
    expect(text(body)).toMatch(/Is the review running, and within budget\?/);
    expect(body).toContain('aria-label="Runs per day over the last two weeks, failed runs marked"');
    expect(body).toMatch(/aria-label="NOK [\d,]+ spent, NOK [\d,]+ projected, budget NOK 7,500"/);
  });
});

describe('the overview answer by phase', () => {
  it('says nothing is decided in the setup weeks', () => {
    const body = text(pages('setup').Overview());
    expect(body).toMatch(/Too early to say\. Nothing is decided in the setup weeks/);
    expect(body).not.toMatch(/\bNot met\b/);
  });

  it('shows the decision and the criteria as health after the experiment', () => {
    const body = text(pages('after').Overview());
    expect(body).toMatch(/Decided 22 Dec: Keep\./);
    expect(body).toMatch(/The last four weeks, as ongoing health/);
  });
});

describe('the shell', () => {
  const route = parseRoute('#/digdir/genki/findings', ['digdir/genki'], ['runbook']);
  const body = render(Shell, {
    props: { route, names: ['digdir/genki'], repo: 'digdir/genki', stamp: '10 Nov, 06:53', dark: false, ontheme: () => {}, children: createRawSnippet(() => ({ render: () => '<p>Page</p>' })) },
  }).body;

  it('has a skip link, a banner, one main navigation and the main landmark', () => {
    expect(body).toMatch(/<a class="ds-skip-link" href="#main">/);
    expect(body).toMatch(/<header class="header"/);
    expect(body).toMatch(/<nav id="menu"[^>]*aria-label="Main"/);
    expect(body).toMatch(/<main id="main"/);
  });

  it('marks the current page and lists every page of the repository, all repositories and the docs', () => {
    expect(body).toMatch(/href="#\/digdir\/genki\/findings" aria-current="page"/);
    for (const href of ['#/digdir/genki/overview', '#/digdir/genki/pull-requests', '#/digdir/genki/operations', '#/', '#/start', '#/docs/runbook'])
      expect(body).toContain(`href="${href}"`);
  });

  it('has no sample-data switch', () => {
    expect(body).not.toMatch(/Sample/);
  });
});

describe('docs', () => {
  it('renders a docs page with its sections and links that stay in the app', () => {
    const body = render(Docs, { props: { page: 'runbook', anchor: 'when-a-review-fails' } }).body;
    expect(body).toMatch(/<h1[^>]*>Runbook<\/h1>/);
    expect(body).toContain('href="#/docs/runbook#when-the-budget-alerts"');
    expect(body).toContain('id="when-a-review-fails"');
    expect(body).toContain('href="#/docs/experiment#the-change-log"');
  });

  it('opens the first page when the page is unknown', () => {
    expect(render(Docs, { props: { page: 'nope', anchor: null } }).body).toMatch(/<h1[^>]*>The experiment<\/h1>/);
  });
});
