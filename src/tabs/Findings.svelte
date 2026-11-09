<script lang="ts">
  import { filterFindings, type Metrics } from '../lib/compute';
  import { fmt, stamp } from '../lib/format';
  import { CAT, SEVS } from '../lib/labels';
  import Outcome from '../lib/ui/Outcome.svelte';

  let { m, severity = $bindable(), outcome = $bindable() }: { m: Metrics; severity: string; outcome: string } = $props();

  const severities: [string, string][] = [['All', 'All'], ...SEVS.map((s): [string, string] => [s, s])];
  const outcomes: [string, string][] = [
    ['All', 'All'],
    ['fixed', 'Fixed'],
    ['dismissed', 'Dismissed'],
    ['open', 'Open'],
    ['discussed', 'Discussed'],
    ['shadow', 'Shadow'],
  ];
  const rows = $derived(filterFindings(m.F, severity, outcome).slice(0, 300));
  const isThread = (url: string) => url.startsWith('https://github.com/');
</script>

{#snippet toggle(label: string, options: [string, string][], current: string, set: (v: string) => void)}
  <div class="ds-toggle-group" data-variant="secondary" data-size="sm" role="radiogroup" aria-label={label}>
    {#each options as [v, t] (v)}
      <button type="button" class="ds-button" role="radio" aria-checked={v === current} onclick={() => set(v)}>{t}</button>
    {/each}
  </div>
{/snippet}

<p class="hint">
  Every finding the review posted, newest first. The text stays in GitHub; open the thread to read it. Fixed means the follow-up job confirmed the problem
  is gone, not just that the thread was closed.
</p>

{#if m.unresolvedImportant.length}
  <div class="callout" role="note">
    <h2>Merged with an Important finding still open ({fmt(m.unresolvedImportant.length)})</h2>
    <ul>
      {#each m.unresolvedImportant as u (u.pr)}<li>{#if isThread(u.url)}<a href={u.url}>#{u.pr} {u.title}</a>{:else}#{u.pr} {u.title}{/if}</li>{/each}
    </ul>
  </div>
{/if}

<div class="section-head">
  <h2 class="ds-heading" data-size="xs">{fmt(rows.length)} findings</h2>
  <div class="filters">
    {@render toggle('Severity', severities, severity, (v) => (severity = v))}
    {@render toggle('Outcome', outcomes, outcome, (v) => (outcome = v))}
  </div>
</div>
<div class="table-wrap">
  <table class="ds-table" data-border data-zebra data-size="sm">
    <thead>
      <tr><th>Posted</th><th>Severity</th><th>Pull request</th><th>File</th><th>Finder</th><th>Outcome</th><th class="num">Replies</th><th>Suggestion</th></tr>
    </thead>
    <tbody>
      {#each rows as f, i (i)}
        <tr>
          <td>{stamp(f.posted)}</td>
          <td><span class="sev sev-{f.severity}">{f.severity}</span></td>
          <td class="wrap-cell">
            {#if isThread(f.url)}<a class="ds-link" href={f.url}>#{f.pr} {f.prTitle}</a>{:else}#{f.pr} {f.prTitle}{/if}
          </td>
          <td class="path-cell">{f.path}</td>
          <td>{f.category ? CAT[f.category] : '–'}</td>
          <td><Outcome outcome={f.outcome} shadow={f.arm === 'shadow'} /></td>
          <td class="num">{fmt(f.replies)}</td>
          <td>{f.suggestion ? 'Yes' : ''}</td>
        </tr>
      {:else}
        <tr><td colspan="8" class="empty">No findings match this filter.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
