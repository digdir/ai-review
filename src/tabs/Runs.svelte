<script lang="ts">
  import Bars from '../lib/charts/Bars.svelte';
  import type { Metrics } from '../lib/compute';
  import { day, fmt, minutes, nok, pct, stamp } from '../lib/format';
  import { JOB } from '../lib/labels';
  import type { ExperimentConfig } from '../lib/types';
  import Stat from '../lib/ui/Stat.svelte';

  let { m, config }: { m: Metrics; config: ExperimentConfig } = $props();

  const mins = (s: number | null | undefined) => (s == null ? null : s / 60);
  const chron = $derived([...m.reviews].sort((a, b) => a.started_at.localeCompare(b.started_at)).slice(-40));
  const noFinders = $derived(m.records.length > 0 && !(m.subagentsMedian != null && m.subagentsMedian > 0));
</script>

{#if noFinders}
  <div class="ds-alert" data-color="warning" data-size="sm">
    <p class="ds-paragraph" data-size="sm">
      None of the recorded reviews started any finders. The review reads its instructions from main, so until they are merged each review is a single pass.
    </p>
  </div>
{/if}
<div class="stats">
  <Stat label="Reviews" value={fmt(m.reviews.length)} help="Full reviews, including review again.">
    {fmt(m.reviewAgain)} review again · {fmt(m.followUps)} follow-ups
  </Stat>
  <Stat label="Failed runs" value={pct(m.failRate.v)} status={m.failRate.k ? 'wait' : 'ok'} help="Runs that did not complete, of all runs.">
    {fmt(m.failRate.k)} of {fmt(m.failRate.n)}
  </Stat>
  <Stat label="Review time" value={minutes(m.reviewTime.med)} help="How long a review run takes, median.">p90 {minutes(m.reviewTime.p90)}</Stat>
  <Stat
    label="Finders per review"
    value={fmt(m.subagentsMedian)}
    status={m.subagentsMedian == null ? null : m.subagentsMedian >= 5 ? 'ok' : 'bad'}
    help="Each review should start five finders. Median of recorded runs."
  >
    should be 5
  </Stat>
  <Stat label="Coverage" value={pct(m.coverage)} help="Pull requests merged since the start that got a review. A health check, not a goal.">
    merged and reviewed
  </Stat>
</div>
<div class="ds-card" data-color="neutral">
  <h2 class="ds-heading" data-size="2xs">Minutes per review, last 40</h2>
  <Bars
    rows={chron}
    value={(r) => mins(r.duration_s)}
    label={(r) => day(r.started_at)}
    cls={() => 'bar-review'}
    title="Minutes per review"
    decimals={1}
    height={180}
    tip={(r) => `#${r.pr_number}, ${stamp(r.started_at)}: ${fmt(mins(r.duration_s), 1)} min`}
  />
</div>
<div class="table-wrap">
  <table class="ds-table" data-border data-zebra data-size="sm">
    <thead>
      <tr>
        <th>Started</th><th>PR</th><th>Job</th><th>Group</th><th>Model</th><th>Prompt</th><th class="num">Finders</th><th class="num">Findings</th><th class="num"
          >Duration</th
        ><th class="num">Cost</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      {#each m.runsNewest as r (r.run_id)}
        <tr>
          <td>{stamp(r.started_at)}</td>
          <td>{r.pr_number ? `#${r.pr_number}` : '–'}</td>
          <td>{JOB[r.job ?? 'review']}{r.review_again ? ' again' : ''}</td>
          <td>{r.arm === 'shadow' ? 'Shadow' : 'Posted'}</td>
          <td class="path-cell">{r.model ?? ''}</td>
          <td class="path-cell">{r.prompt_version ?? ''}</td>
          <td class="num">{r.subagents ?? '–'}</td>
          <td class="num">{r.findings ?? '–'}</td>
          <td class="num">{r.duration_s ? minutes(r.duration_s / 60) : '–'}</td>
          <td class="num">{r.cost_usd != null ? nok(r.cost_usd * config.usdNok, 1) : '–'}</td>
          <td>
            {#if r.completed === false}<span class="sev sev-Important">Failed</span>{:else}<span class="sev sev-Nit">Done</span>{/if}
            {#if r.source === 'log'}<span class="muted"> from log</span>{/if}
          </td>
        </tr>
      {:else}
        <tr><td colspan="11" class="empty">No runs yet.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
