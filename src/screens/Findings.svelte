<script lang="ts">
  import { filterFindings, type Metrics } from '../lib/compute';
  import { docHref } from '../lib/docs';
  import { fmt, stamp, weekday } from '../lib/format';
  import { CAT, OUT, SEVS } from '../lib/labels';
  import type { Data } from '../lib/types';
  import Explain from '../lib/ui/Explain.svelte';
  import Outcome from '../lib/ui/Outcome.svelte';

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
  const rows = $derived(filterFindings(m.rows, { severity, outcome, group, author }));
  const recorded = $derived(m.rows.filter((f) => f.outcome === 'recorded').length);
  const outcomes = ['All', 'fixed', 'dismissed', 'open', 'discussed', 'resolved'];
</script>

{#snippet chips(label: string, options: string[], current: string, set: (v: string) => void, names?: Record<string, [string, string]>)}
  <div class="chips" role="group" aria-label={label}>
    {#each options as o (o)}
      <button type="button" aria-pressed={current === o} onclick={() => set(o)}>{names?.[o]?.[0] ?? o}</button>
    {/each}
  </div>
{/snippet}

<div class="head">
  <h1>Findings</h1>
  <p>
    Every finding the review recorded since {weekday(m.T.startMs)}, newest first, by title. {fmt(m.posted.length)} posted and {fmt(recorded)} recorded in the
    silent group. The text of each finding stays in GitHub.
  </p>
</div>

<section class="panel">
  <header>
    <div class="filters">
      {@render chips('Severity', ['All', ...SEVS], severity, (v) => (severity = v))}
      {@render chips('Outcome', outcomes, outcome, (v) => (outcome = v), OUT)}
      {@render chips('Group', ['All', 'reviewed', 'silent'], group, (v) => (group = v))}
      <label class="small muted" for="author">Author</label>
      <input id="author" class="author" type="search" placeholder="username" autocomplete="off" spellcheck="false" value={username}
        oninput={(e) => onusername(e.currentTarget.value)} />
    </div>
    <span class="meta inline">{fmt(rows.length)} shown</span>
    <Explain
      name="outcomes"
      means="Fixed: the author answered fixed and the follow-up confirmed the problem is gone. Dismissed: the author replied it will not be fixed. Discussed: replies, not settled. Resolved: a person resolved the thread without a confirmed fix. Outdated: the lines changed, fix not confirmed. Open: no reply yet. Recorded: a silent-group finding that was never posted."
      source="Thread state and replies in GitHub, joined with the follow-up run records. The title is the first line of the finding; the rest stays in GitHub. The author filter compares a hash of the username, never the username."
      doc={['working-with-the-review', 'answering-findings']}
      docLabel="How to answer a finding"
    />
  </header>
  <div class="twrap">
    <table class="stack">
      <thead><tr><th>Posted</th><th>Severity</th><th>Finding</th><th>Finder</th><th>Group</th><th>Outcome</th></tr></thead>
      <tbody>
        {#each rows.slice(0, 300) as f, i (i)}
          <tr>
            <td data-l="Posted" class="mono small">{stamp(f.posted)}</td>
            <td data-l="Severity"><span class="sev {f.severity}">{f.severity}</span></td>
            <td data-l="Finding" class="full">
              {#if f.url}<a href={f.url}>{f.title}</a>{:else}{f.title}{/if}
              <div class="xs muted"><a href="https://github.com/{repo}/pull/{f.pr}">#{f.pr}</a> <span class="mono">{f.path}</span></div>
            </td>
            <td data-l="Finder">{f.category ? (CAT[f.category] ?? f.category) : '–'}</td>
            <td data-l="Group">{#if f.group === 'silent'}<span class="tag silent">silent</span>{:else}<span class="tag">reviewed</span>{/if}</td>
            <td data-l="Outcome"><Outcome outcome={f.outcome} /></td>
          </tr>
        {:else}
          <tr><td colspan="6" class="muted">No findings match.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if rows.length > 300}<p class="empty small">Showing the newest 300 of {fmt(rows.length)}.</p>{/if}
</section>

<section class="panel" id="escaped">
  <header><h2>Problems the review missed</h2><a class="meta" href={docHref('experiment', 'problems-the-review-missed')}>What counts as escaped</a></header>
  {#if m.repo.escaped.length}
    <ul class="rows">
      {#each m.repo.escaped as e (e.n)}
        <li><span class="t"><span class="pr">#{e.n}</span><a href="https://github.com/{repo}/pull/{e.n}">{e.title}</a></span><span class="r">{e.merged ? 'merged' : 'open'}</span></li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No pull request labelled escaped yet.</p>
  {/if}
</section>
