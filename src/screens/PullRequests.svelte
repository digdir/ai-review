<script lang="ts">
  import type { Metrics } from '../lib/compute';
  import { docHref } from '../lib/docs';
  import { fmt, hours, pct, weekday } from '../lib/format';
  import type { Data } from '../lib/types';
  import Definitions, { type Definition } from '../lib/ui/Definitions.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Section from '../lib/ui/Section.svelte';
  import Severity from '../lib/ui/Severity.svelte';
  import Stats from '../lib/ui/Stats.svelte';
  import TableRegion from '../lib/ui/TableRegion.svelte';

  let {
    data,
    m,
    author,
    username,
    onusername,
  }: { data: Data; m: Metrics; author: string | null; username: string; onusername: (v: string) => void } = $props();

  let number = $state('');
  let all = $state(false);
  const repo = $derived(data.config.repo);
  const r = $derived(m.repo);
  const b = $derived(m.board);
  const since = $derived(weekday(m.T.startMs));
  const wanted = $derived(number.replace('#', '').trim());
  const prs = $derived(r.prs.filter((p) => (!author || p.author === author) && (!wanted || String(p.n).includes(wanted))));
  const limit = $derived(all || author || wanted ? prs.length : 15);
  const two = (v: readonly [number | null, number | null], f: (x: number | null) => string) => [f(v[0]), f(v[1])];
  const side = $derived([
    ['Time to merge, median', two(r.side.ttm, hours), 'At most 20% higher than silent'],
    ['Rework within 14 days', two(r.side.rework, pct), `Baseline ${pct(m.reworkBase.v)}; at most 5 points above`],
    ['Review rounds until merge', two(r.side.rounds, (v) => fmt(v, 1)), 'Explains a change in time to merge'],
    ['Merged without human review', two(r.side.noHuman, pct), 'Whether the review replaces or adds to people'],
  ] as const);
  const definitions: Definition[] = [
    {
      term: 'Reviewed and silent group',
      means: 'Each pull request by a person is assigned to a group when the review runs. The reviewed group gets the findings posted; the silent group is reviewed and recorded, nothing is posted, and serves as the control.',
      source: 'The run record of each pull request.',
      doc: ['working-with-the-review', 'what-happens-to-your-pull-request'],
    },
    {
      term: 'Waiting on authors',
      means: 'Review threads on open pull requests with no reply from the author yet. Every thread needs an answer before merge.',
      source: 'Review threads in GitHub.',
      doc: ['working-with-the-review', 'answering-findings'],
    },
    {
      term: 'Merged with open threads',
      means: 'Reviewed pull requests merged with a review thread still unanswered. A reply is enough; it is how fixed and dismissed are counted.',
      source: 'Threads and merge timestamps in GitHub.',
      doc: ['working-with-the-review', 'answering-findings'],
    },
    {
      term: 'Reviewed against silent',
      means: 'The same measures for both groups over the same weeks. Shown once the silent group has 10 merged pull requests.',
      source: 'Pull request timestamps and file lists from GitHub; the group from the run record.',
      doc: ['experiment', 'design'],
    },
    {
      term: 'Your GitHub username',
      means: 'Shows only your pull requests. The username is hashed in the browser and compared with the hash the collector stored; it never leaves the browser.',
      source: 'The author hash on each pull request.',
      doc: ['experiment', 'privacy'],
    },
  ];
</script>

<div class="page">
  <PageHeader context={repo} title="Pull requests">
    What the review said on each pull request since {since}, and what is waiting on an answer.
    <a class="ds-link" href={docHref('working-with-the-review', 'answering-findings')}>How to answer a finding</a>.
  </PageHeader>

  {#if r.openImportant.length}
    <div class="ds-alert" data-color="warning">
      <h2 class="ds-heading" data-size="2xs">Merged with an Important thread still open</h2>
      <p class="ds-paragraph">
        {#each r.openImportant as p, i (p.pr)}{i ? ', ' : ''}<a class="ds-link" href={p.url || `https://github.com/${repo}/pull/${p.pr}`}>#{p.pr} {p.title}</a>{/each}.
        A reply is enough; it is how fixed and dismissed are counted.
      </p>
    </div>
  {/if}

  <Stats
    label="Pull requests since the start"
    items={[
      { label: 'Opened by people', value: fmt(r.opened), context: `${fmt(r.bots)} from bots left out` },
      { label: 'Reviewed group', value: fmt(r.reviewed), context: 'Findings posted' },
      { label: 'Silent group', value: fmt(r.silent), context: 'Recorded, nothing posted' },
      {
        label: 'Waiting on authors',
        value: `${fmt(b.waiting.threads)} ${b.waiting.threads === 1 ? 'thread' : 'threads'}`,
        context: b.waiting.threads ? `On ${fmt(b.waiting.prs)} pull ${b.waiting.prs === 1 ? 'request' : 'requests'}, oldest ${hours(b.waiting.oldestHours)}` : 'Every thread answered',
      },
      { label: 'Merged with open threads', value: r.mergedOpen.n ? pct(r.mergedOpen.v) : '–', context: `${fmt(r.mergedOpen.k)} of ${fmt(r.mergedOpen.n)} merged` },
    ]}
  />

  <Section id="pull-requests" title="Every pull request">
    <div class="toolbar">
      <div class="ds-field wide">
        <label class="ds-label" for="username">Your GitHub username</label>
        <input class="ds-input" id="username" type="search" autocomplete="off" spellcheck="false" value={username} oninput={(e) => onusername(e.currentTarget.value)} />
      </div>
      <div class="ds-field">
        <label class="ds-label" for="pr-number">Number</label>
        <input class="ds-input" id="pr-number" type="search" inputmode="numeric" bind:value={number} />
      </div>
      <span class="count" aria-live="polite">{fmt(prs.length)} {prs.length === 1 ? 'pull request' : 'pull requests'}</span>
    </div>
    {#if prs.length}
      <TableRegion label="Pull requests">
        <table class="ds-table stacked" data-size="sm">
          <thead><tr><th scope="col">Pull request</th><th scope="col">Group</th><th scope="col">Findings</th><th scope="col">State</th><th scope="col" class="n">Lines</th></tr></thead>
          <tbody>
            {#each prs.slice(0, limit) as p (p.n)}
              <tr>
                <td class="lead">
                  <a class="ds-link" href="https://github.com/{repo}/pull/{p.n}">#{p.n} {p.title}</a>
                  {#if p.draft || p.escaped}<span class="sub">{[p.draft && 'Draft', p.escaped && 'Labelled escaped'].filter(Boolean).join(', ')}</span>{/if}
                </td>
                <td data-l="Group">{p.group === 'silent' ? 'Silent' : p.group === 'none' ? 'No review run' : 'Reviewed'}</td>
                <td data-l="Findings">
                  {#if p.group === 'silent'}
                    <span class="subtle">{fmt(p.recorded)} recorded, not posted</span>
                  {:else if p.group === 'reviewed'}
                    {#if p.important || p.nit || p.pre}
                      <span class="cell-tags">
                        {#if p.important}<Severity severity="Important" count={p.important} />{/if}
                        {#if p.nit}<Severity severity="Nit" count={p.nit} />{/if}
                        {#if p.pre}<Severity severity="Pre-existing" count={p.pre} />{/if}
                      </span>
                    {:else}<span class="subtle">None</span>{/if}
                  {:else}–{/if}
                </td>
                <td data-l="State">
                  {#if p.open}<b>{p.open} {p.open === 1 ? 'thread' : 'threads'} to answer</b>{:else if p.mergedHours != null}Merged in {hours(p.mergedHours)}{:else}Open{/if}
                </td>
                <td data-l="Lines" class="n">{fmt(p.lines)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </TableRegion>
      {#if prs.length > limit}
        <p class="more">Showing the newest {fmt(limit)} of {fmt(prs.length)}. <button type="button" class="ds-button" data-variant="tertiary" data-size="sm" onclick={() => (all = true)}>Show all</button></p>
      {/if}
    {:else}
      <EmptyState>No pull requests match.</EmptyState>
    {/if}
  </Section>

  <Section id="slowing" title="Is it slowing us down?" description="The reviewed group against the silent group, same repository and the same weeks since {since}." doc={['experiment', 'design']}>
    {#if r.side.ready}
      <TableRegion label="Reviewed against silent">
        <table class="ds-table stacked" data-size="sm">
          <thead><tr><th scope="col">Measure</th><th scope="col" class="n">Reviewed</th><th scope="col" class="n">Silent</th><th scope="col">Threshold or meaning</th></tr></thead>
          <tbody>
            {#each side as [label, [a, s], note] (label)}
              <tr><td class="lead">{label}</td><td data-l="Reviewed" class="n">{a}</td><td data-l="Silent" class="n">{s}</td><td data-l="Threshold or meaning" class="subtle">{note}</td></tr>
            {/each}
          </tbody>
        </table>
      </TableRegion>
    {:else}
      <EmptyState>This comparison appears when the silent group has 10 merged pull requests. {fmt(r.side.silentMerged)} so far.</EmptyState>
    {/if}
  </Section>

  <Definitions items={definitions} />
</div>
