<script lang="ts">
  import Rates from '../lib/charts/Rates.svelte';
  import type { Metrics } from '../lib/compute';
  import { day, fmt, nok, pct } from '../lib/format';
  import { CAT, KINDS } from '../lib/labels';
  import type { Rate } from '../lib/stats';
  import type { Data, ExperimentConfig } from '../lib/types';

  let { data, m, config }: { data: Data; m: Metrics; config: ExperimentConfig } = $props();

  const repo = $derived(data.config.repo);
  const shown = (r: Rate) => r.n > 0 && !r.few;
</script>

{#snippet gradeCard(title: string, r: Rate, waiting: string, extra = '')}
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">{title}</h2>
    <div class="kpi" style="margin-top:var(--ds-size-3);height:auto">
      <span class="kpi-value">{r.n ? pct(r.v) : '–'}</span>
      <span class="kpi-foot">{r.n && r.ci ? `${fmt(r.k)} of ${fmt(r.n)}, 95% interval ${pct(r.ci[0])} to ${pct(r.ci[1])}${extra}` : waiting}</span>
    </div>
  </div>
{/snippet}

<p class="hint">
  Do findings get fixed, and are they right? Fix rate counts only findings on merged pull requests that the follow-up confirmed fixed. The grey band is how
  often human review comments get fixed in published studies.
</p>
<div class="grid grid-2">
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Fix rate by severity</h2>
    <div class="rates" style="margin-top:var(--ds-size-4)"><Rates rows={m.bySev} name={(k) => k} band={config.humanBand} /></div>
  </div>
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Fix rate by finder</h2>
    <div class="rates" style="margin-top:var(--ds-size-4)">
      <Rates rows={m.byCat.filter((c) => c.n)} name={(k) => CAT[k]} band={config.humanBand} empty="No findings with a finder on merged pull requests yet." />
    </div>
  </div>
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Fix rate by author</h2>
    <p class="hint">Agent, human with AI, or unknown. Never per person.</p>
    <div class="rates" style="margin-top:var(--ds-size-3)"><Rates rows={m.kinds} name={(k) => KINDS[k]} band={config.humanBand} /></div>
  </div>
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">One-click suggestions</h2>
    <p class="hint">Does a ready-made suggestion get applied more often than a finding without one?</p>
    <div class="rates" style="margin-top:var(--ds-size-3)">
      <Rates
        rows={[
          { key: 'With suggestion', ...m.withSuggestion },
          { key: 'Without', ...m.withoutSuggestion },
        ]}
        name={(k) => k}
        band={config.humanBand}
      />
    </div>
  </div>
</div>
<div class="grid grid-3">
  {@render gradeCard(
    'Precision',
    m.precision,
    'Waiting for hand grading: about 35 findings a week, graded right and worth it, right but not worth it, wrong, or unclear.',
    data.grading?.agreement != null ? `. Agreement between graders ${pct(data.grading.agreement)}` : '',
  )}
  {@render gradeCard('Follow-up accuracy', m.followAcc, 'Waiting for a hand check of 40 threads the follow-up resolved: were they really fixed?')}
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Novelty effect</h2>
    <ul class="list" style="margin-top:var(--ds-size-3)">
      <li><span>Weeks 1 and 2</span><span class="num">{shown(m.early) ? pct(m.early.v) : '–'} <span class="muted">of {fmt(m.early.n)}</span></span></li>
      <li><span>Weeks 5 and 6</span><span class="num">{shown(m.late) ? pct(m.late.v) : '–'} <span class="muted">of {fmt(m.late.n)}</span></span></li>
    </ul>
    <p class="hint" style="margin-top:var(--ds-size-3)">Fix rate early against late. At Google, the benefit levelled off once the novelty wore off.</p>
  </div>
</div>
<div class="ds-alert" data-color="info" data-size="sm">
  <p class="ds-paragraph" data-size="sm">
    {#if m.humanThreads.length >= 20}
      Human review comments in {repo} over the same period: {pct(m.humanRate.v)} resolved or outdated, of {fmt(m.humanRate.n)} threads. That is a looser
      definition than fixed above.
    {:else}
      {repo} has only {fmt(m.humanThreads.length)} human review threads in the period, too few for its own baseline. The comparison is with published studies
      instead: 44.5% at Atlassian, 51% at Uber, and about 60% in a study of 178 repositories.
    {/if}
  </p>
</div>
<div class="ds-card" data-color="neutral">
  <h2 class="ds-heading" data-size="2xs">Prompt versions</h2>
  <p class="hint">Each change to the review instructions gets a new version. A pull request counts toward the version that reviewed it first.</p>
  <div class="table-wrap" style="margin-top:var(--ds-size-3)">
    <table class="ds-table" data-size="sm">
      <thead>
        <tr><th>Version</th><th>Since</th><th class="num">Reviews</th><th class="num">PRs</th><th class="num">Findings</th><th class="num">Fix rate</th><th class="num"
            >Cost per review</th
          ></tr>
      </thead>
      <tbody>
        {#each m.promptVersions as v (v.version)}
          <tr>
            <td class="path-cell">{v.version}</td>
            <td>{day(v.since)}</td>
            <td class="num">{fmt(v.reviews)}</td>
            <td class="num">{fmt(v.prs)}</td>
            <td class="num">{fmt(v.findings)}</td>
            <td class="num">{shown(v.fixed) ? pct(v.fixed.v) : v.fixed.n ? 'Too few' : '–'}</td>
            <td class="num">{nok(v.cost, 1)}</td>
          </tr>
        {:else}
          <tr><td colspan="7" class="empty">No runs record a prompt version yet.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
