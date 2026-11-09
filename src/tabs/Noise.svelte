<script lang="ts">
  import Bars from '../lib/charts/Bars.svelte';
  import type { Metrics } from '../lib/compute';
  import { fmt, pct } from '../lib/format';
  import { median } from '../lib/stats';
  import Stat from '../lib/ui/Stat.svelte';

  let { m }: { m: Metrics } = $props();

  const areaMax = $derived(Math.max(1, ...m.areas.map((a) => a[1])));
  const zero = $derived(m.perPr.length ? m.perPr.filter((x) => x === 0).length / m.perPr.length : null);
</script>

<p class="hint">
  Noise is the most common complaint about AI review. Many findings is not good in itself: what counts is that the ones posted get fixed.
</p>
<div class="stats">
  <Stat label="Dismissed" value={pct(m.dismissed.v)} help="Findings the author replied will not be fixed.">{fmt(m.dismissed.k)} of {fmt(m.dismissed.n)} findings</Stat>
  <Stat label="Ignored" value={pct(m.ignored.v)} help="Findings on merged pull requests with no reply and no fix. Silence is a quieter form of noise.">
    {fmt(m.ignored.k)} of {fmt(m.ignored.n)} on merged PRs
  </Stat>
  <Stat label="Findings per PR" value={fmt(m.perPrMean, 1)} help="Mean findings per reviewed pull request.">
    median {fmt(median(m.perPr))}, max {fmt(m.perPr.length ? Math.max(...m.perPr) : null)}
  </Stat>
  <Stat label="Per 100 lines" value={fmt(m.per100Lines, 1)} help="Findings per 100 changed lines, so large and small pull requests compare fairly.">
    findings per 100 changed lines
  </Stat>
  <Stat label="Pre-existing" value={pct(m.preexisting.v)} help="Findings about code the pull request did not change.">of all findings</Stat>
  <Stat label="Clean reviews" value={pct(zero)} help="Reviewed pull requests where the review found nothing.">PRs with no findings</Stat>
</div>
<div class="grid grid-2">
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Findings per reviewed pull request</h2>
    <Bars
      rows={m.hist}
      value={(r) => r.v}
      label={(r) => (r.k === 5 ? '5+' : String(r.k))}
      cls={() => 'bar-review'}
      title="Pull requests by number of findings"
      height={180}
      tip={(r) => `${r.v} PRs with ${r.k === 5 ? '5 or more' : r.k} findings`}
    />
  </div>
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Findings by area</h2>
    <div style="margin-top:var(--ds-size-3)">
      {#if m.areas.length}
        <ul class="list">
          {#each m.areas as [k, v] (k)}
            <li style="display:grid;grid-template-columns:minmax(0,1fr) 40% 2rem;align-items:center">
              <span class="path-cell" style="overflow:hidden;text-overflow:ellipsis">{k}</span>
              <span class="stack" style="height:8px"><span style:width="{(100 * v) / areaMax}%" style="background:var(--ds-color-accent-base-default)"></span></span>
              <span class="num">{fmt(v)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No findings yet.</p>
      {/if}
    </div>
  </div>
</div>
