<script lang="ts">
  import Bars from '../lib/charts/Bars.svelte';
  import type { MergeTimes, Metrics, Week } from '../lib/compute';
  import { day, fmt, minutes, pct } from '../lib/format';
  import { median, quant } from '../lib/stats';
  import type { Data, ExperimentConfig } from '../lib/types';

  let { data, m, config }: { data: Data; m: Metrics; config: ExperimentConfig } = $props();

  type Key = 'med' | 'noHuman' | 'rework' | 'red';
  const charts: [Key, string, string, number][] = [
    ['med', 'Hours to merge, median', ' h', 1],
    ['noHuman', 'Merged without human review', '%', 0],
    ['rework', 'Rework within 14 days', '%', 0],
    ['red', 'Failed CI runs on main', '%', 0],
  ];
  const enough = (n: number) => n >= config.minCell;
  const rowsFor = (k: Key): Week[] => m.weeks.map((w) => ({ ...w, hidden: k === 'red' ? false : w.hidden }));
  const weekTip = (w: Week, k: Key, unit: string, dec: number) =>
    w.hidden
      ? `Week of ${day(w.w)}: fewer than ${config.minCell} PRs`
      : `Week of ${day(w.w)}: ${unit === '%' ? pct(w[k]) : fmt(w[k], dec) + unit}${k === 'rework' && w.reworkPending ? ' (not all 14 days old yet)' : ''}${k !== 'red' ? `, ${w.n} PRs` : ''}`;
</script>

{#snippet timeRow(name: string, t: MergeTimes, note = '')}
  <tr>
    <td>{name}{#if note}<br /><span class="muted">{note}</span>{/if}</td>
    <td class="num">{fmt(t.n)}</td>
    <td class="num">{enough(t.n) ? fmt(t.med, 1) + ' h' : '–'}</td>
    <td class="num">{enough(t.n) ? fmt(t.p90, 1) + ' h' : '–'}</td>
  </tr>
{/snippet}

<p class="hint">
  Guardrail metrics: these should not get better, only not worse. Weeks with fewer than {config.minCell} pull requests are hidden. Six weeks is too short to
  prove anything got faster.
</p>
<div class="ds-card" data-color="neutral">
  <h2 class="ds-heading" data-size="2xs">Waiting times</h2>
  <div class="table-wrap" style="margin-top:var(--ds-size-3)">
    <table class="ds-table" data-size="sm">
      <thead><tr><th>Measure</th><th class="num">PRs</th><th class="num">Median</th><th class="num">p90</th></tr></thead>
      <tbody>
        <tr>
          <td>Time to first review<br /><span class="muted">From opened to the first review posted</span></td>
          <td class="num">{fmt(m.firstReview.n)}</td>
          <td class="num">{minutes(m.firstReview.med)}</td>
          <td class="num">{minutes(m.firstReview.p90)}</td>
        </tr>
        {@render timeRow('Time to merge, baseline', m.baseT, `${day(data.config.baselineFrom + 'T12:00:00Z')} until the start`)}
        {@render timeRow('Time to merge, with review', m.treatedT)}
        {@render timeRow('Time to merge, shadow group', m.shadowT, data.setup?.shadowPercent ? 'Reviewed without posting anything' : 'The shadow group is off')}
        <tr>
          <td>Time in the merge queue<br /><span class="muted">From queued to merged</span></td>
          <td class="num">{fmt(m.queued.length)}</td>
          <td class="num">{enough(m.queued.length) ? minutes(median(m.queued)) : '–'}</td>
          <td class="num">{enough(m.queued.length) ? minutes(quant(m.queued, 0.9)) : '–'}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
<div class="section-head">
  <h2 class="ds-heading" data-size="xs">Week by week</h2>
  <div class="legend">
    <span><i style="background:var(--ds-color-neutral-border-default)"></i>Baseline</span><span
      ><i style="background:var(--ds-color-accent-base-default)"></i>With review</span
    ><span><i style="border-top:2px dashed var(--ds-color-neutral-text-subtle);height:0;border-radius:0"></i>Baseline average</span>
  </div>
</div>
<div class="grid grid-2">
  {#each charts as [k, title, unit, dec] (k)}
    <div class="ds-card" data-color="neutral">
      <h3 class="ds-heading" data-size="2xs">{title}</h3>
      <Bars
        rows={rowsFor(k)}
        value={(w) => w[k]}
        label={(w) => day(w.w)}
        cls={(w) => (w.phase === 'review' ? 'bar-review' : 'bar-base')}
        title="{title} per week"
        ref={m.baseAvg(k)}
        decimals={dec}
        {unit}
        max={unit === '%' ? 1 : undefined}
        tip={(w) => weekTip(w, k, unit, dec)}
      />
    </div>
  {/each}
</div>
