<script lang="ts">
  import Columns from '../lib/charts/Columns.svelte';
  import HBars from '../lib/charts/HBars.svelte';
  import { filterFindings, type Metrics } from '../lib/compute';
  import { fmt, hours, pct, stamp, weekday } from '../lib/format';
  import { CAT, OUT, SEVS } from '../lib/labels';
  import type { Rate } from '../lib/stats';
  import type { Data } from '../lib/types';
  import Definitions, { type Definition } from '../lib/ui/Definitions.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Section from '../lib/ui/Section.svelte';
  import Severity from '../lib/ui/Severity.svelte';
  import Stats from '../lib/ui/Stats.svelte';
  import StatusTag from '../lib/ui/StatusTag.svelte';
  import TableRegion from '../lib/ui/TableRegion.svelte';

  let {
    data,
    m,
    author,
    username,
    onusername,
  }: { data: Data; m: Metrics; author: string | null; username: string; onusername: (v: string) => void } = $props();

  let severity = $state('All');
  let outcome = $state('All');
  let group = $state('All');
  const repo = $derived(data.config.repo);
  const r = $derived(m.repo);
  const since = $derived(weekday(m.T.startMs));
  const rows = $derived(filterFindings(m.rows, { severity, outcome, group, author }));
  const recorded = $derived(m.rows.filter((f) => f.outcome === 'recorded').length);
  const outcomes = ['fixed', 'dismissed', 'open', 'discussed', 'resolved', 'outdated', 'recorded'];
  const share = (x: Rate, min = 1) => (x.n >= min ? pct(x.v) : 'Too few');
  const definitions: Definition[] = [
    {
      term: 'Findings acted on',
      means: 'Posted findings the author answered as fixed and the follow-up run confirmed. All severities, so it matches the published rates.',
      source: 'Review threads and follow-up run records.',
      doc: ['experiment', 'measures-and-thresholds'],
    },
    {
      term: 'Important fix rate',
      means: 'Important findings on merged pull requests answered as fixed. All weeks here; the criterion on the overview reads the measured weeks only.',
      source: 'Review threads and follow-up run records.',
      doc: ['experiment', 'measures-and-thresholds'],
    },
    {
      term: 'Dismissed',
      means: 'Posted findings the author answered as not fixed. The main sign of noise.',
      source: 'Review threads in GitHub.',
      doc: ['experiment', 'measures-and-thresholds'],
    },
    {
      term: 'Pull requests with a finding',
      means: 'Reviewed pull requests with at least one posted finding. A healthy reviewer says nothing on a clean pull request; Anthropic reports 54% on its own code.',
      source: 'Run records and review threads.',
      doc: ['experiment', 'question'],
    },
    {
      term: 'Author response',
      means: 'Hours from a finding being posted to the first reply or the confirmed fix, median. Short means the findings are actionable.',
      source: 'Thread timestamps in GitHub.',
      doc: ['working-with-the-review', 'answering-findings'],
    },
    {
      term: 'Outcomes',
      means: 'Fixed: answered fixed and confirmed by the follow-up. Dismissed: answered not fixing. Discussed: replies, not settled. Resolved: resolved without a confirmed fix. Outdated: the lines changed, fix not confirmed. Open: no reply yet. Recorded: a silent-group finding that was never posted.',
      source: 'Thread state and replies in GitHub, joined with the follow-up run records. The title is the first line of the finding.',
      doc: ['working-with-the-review', 'answering-findings'],
    },
    {
      term: 'Finder',
      means: 'Each review runs five focused finders. A finder with many dismissals is where a rule change pays off first.',
      source: 'The finding category in the run record.',
      doc: ['grading', 'how-to-grade'],
    },
    {
      term: 'Problems the review missed',
      means: 'Pull requests labelled escaped: the fix for a bug the review had a chance to see and did not report.',
      source: 'The escaped label in GitHub.',
      doc: ['experiment', 'problems-the-review-missed'],
    },
  ];
</script>

<div class="page">
  <PageHeader context={repo} title="Findings">
    Are the findings right, and do they get fixed? Every finding since {since}: {fmt(m.posted.length)} posted and {fmt(recorded)} recorded in the silent group. The
    text of each finding stays in GitHub.
  </PageHeader>

  <Stats
    label="Findings since the start"
    items={[
      { label: 'Findings acted on', value: share(r.allFix), context: `${fmt(r.allFix.k)} of ${fmt(r.allFix.n)} posted, all severities` },
      { label: 'Important fix rate', value: share(r.important, 10), context: `${fmt(r.important.k)} of ${fmt(r.important.n)} on merged. Target 50%` },
      { label: 'Dismissed', value: share(r.dismissed, 20), context: `${fmt(r.dismissed.k)} of ${fmt(r.dismissed.n)} posted. Limit 50%` },
      { label: 'Pull requests with a finding', value: share(r.withFinding), context: `${fmt(r.withFinding.k)} of ${fmt(r.withFinding.n)} reviewed. Anthropic: 54%` },
      { label: 'Author response', value: hours(r.response.med), context: `Median of ${fmt(r.response.n)} threads, slowest tenth ${hours(r.response.p90)}` },
    ]}
  />

  <div class="columns">
    <Section id="per-week" title="Findings per pull request, by week" description="Mean posted findings per reviewed pull request. A falling line means the rules are making the review quieter.">
      <Columns
        aria="Findings per reviewed pull request by week"
        slots={6}
        floor={4}
        format={(v) => fmt(v, v % 1 ? 1 : 0)}
        rows={r.perWeek.map((w, i) => ({
          label: `W${w.week}`,
          value: w.perPr ?? 0,
          tone: w.setup ? 'setup' : undefined,
          tip: `Week ${w.week}: ${fmt(w.perPr, 1)} per pull request, ${fmt(w.prs)} pull requests`,
          top: i === r.perWeek.length - 1 ? fmt(w.perPr, 1) : undefined,
        }))}
      >
        {#snippet legend()}<span><i class="setup"></i>Setup weeks, not counted</span><span><i></i>Measured weeks</span>{/snippet}
      </Columns>
    </Section>
    <Section id="by-size" title="Findings per pull request, by size" description="Mean posted findings. Anthropic reports 0.5 under 50 lines and 7.5 over 1,000.">
      <HBars
        aria="Mean posted findings per pull request, by size"
        max={Math.max(8, ...r.bySize.map((s) => s.mean ?? 0))}
        rows={r.bySize.map((s) => ({ label: `${s.label.replace(' lines', '')} (${fmt(s.n)})`, value: s.mean, text: fmt(s.mean, 1) }))}
      />
    </Section>
  </div>

  <Section id="finders" title="By finder" description="Fixed and dismissed as shares of each finder's posted findings.">
    <TableRegion label="Findings by finder">
      <table class="ds-table" data-size="sm">
        <thead><tr><th scope="col">Finder</th><th scope="col" class="n">Findings</th><th scope="col" class="n">Fixed</th><th scope="col" class="n">Dismissed</th></tr></thead>
        <tbody>
          {#each r.byFinder as f (f.key)}
            <tr><td>{f.label}</td><td class="n">{fmt(f.n)}</td><td class="n">{share(f.fixed)}</td><td class="n">{share(f.dismissed)}</td></tr>
          {/each}
        </tbody>
      </table>
    </TableRegion>
  </Section>

  <Section id="all-findings" title="Every finding" description="Newest first. The author filter uses the username from Pull requests and compares a hash, never the name.">
    <div class="toolbar">
      <div class="ds-field">
        <label class="ds-label" for="f-severity">Severity</label>
        <select class="ds-input" id="f-severity" bind:value={severity}>
          <option value="All">All</option>
          {#each SEVS as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </div>
      <div class="ds-field">
        <label class="ds-label" for="f-outcome">Outcome</label>
        <select class="ds-input" id="f-outcome" bind:value={outcome}>
          <option value="All">All</option>
          {#each outcomes as o (o)}<option value={o}>{OUT[o][0]}</option>{/each}
        </select>
      </div>
      <div class="ds-field">
        <label class="ds-label" for="f-group">Group</label>
        <select class="ds-input" id="f-group" bind:value={group}>
          <option value="All">All</option>
          <option value="reviewed">Reviewed</option>
          <option value="silent">Silent</option>
        </select>
      </div>
      <div class="ds-field wide">
        <label class="ds-label" for="author">Author's GitHub username</label>
        <input class="ds-input" id="author" type="search" autocomplete="off" spellcheck="false" value={username} oninput={(e) => onusername(e.currentTarget.value)} />
      </div>
      <span class="count" aria-live="polite">{fmt(rows.length)} shown</span>
    </div>
    {#if rows.length}
      <TableRegion label="Findings">
        <table class="ds-table stacked" data-size="sm">
          <thead><tr><th scope="col">Finding</th><th scope="col">Severity</th><th scope="col">Finder</th><th scope="col">Group</th><th scope="col">Outcome</th><th scope="col">Posted</th></tr></thead>
          <tbody>
            {#each rows.slice(0, 300) as f, i (i)}
              <tr>
                <td class="lead">
                  {#if f.url}<a class="ds-link" href={f.url}>{f.title}</a>{:else}{f.title}{/if}
                  <span class="sub"><a class="ds-link" href="https://github.com/{repo}/pull/{f.pr}">#{f.pr}</a> {f.path}</span>
                </td>
                <td data-l="Severity"><Severity severity={f.severity} /></td>
                <td data-l="Finder">{f.category ? (CAT[f.category] ?? f.category) : '–'}</td>
                <td data-l="Group">{f.group === 'silent' ? 'Silent' : 'Reviewed'}</td>
                <td data-l="Outcome"><StatusTag status={f.outcome} /></td>
                <td data-l="Posted" class="nowrap">{stamp(f.posted)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </TableRegion>
      {#if rows.length > 300}<p class="more">Showing the newest 300 of {fmt(rows.length)}.</p>{/if}
    {:else}
      <EmptyState>No findings match.</EmptyState>
    {/if}
  </Section>

  <Section id="escaped" title="Problems the review missed" doc={['experiment', 'problems-the-review-missed']}>
    {#if r.escaped.length}
      <ul class="row-list">
        {#each r.escaped as e (e.n)}
          <li><span class="what"><a class="ds-link" href="https://github.com/{repo}/pull/{e.n}">#{e.n} {e.title}</a></span><span class="subtle">{e.merged ? 'Merged' : 'Open'}</span></li>
        {/each}
      </ul>
    {:else}
      <EmptyState>No pull request labelled escaped yet.</EmptyState>
    {/if}
  </Section>

  <Definitions items={definitions} />
</div>
