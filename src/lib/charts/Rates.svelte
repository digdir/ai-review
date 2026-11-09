<script lang="ts">
  import { fmt, pct } from '../format';
  import type { Rate } from '../stats';

  let {
    rows,
    name,
    band,
    empty = 'No findings on merged pull requests yet.',
  }: { rows: (Rate & { key: string })[]; name: (key: string) => string; band: [number, number] | null; empty?: string } = $props();
</script>

{#if !rows.length}
  <p class="empty">{empty}</p>
{:else}
  {#each rows as r (r.key)}
    {@const shown = r.n > 0 && !r.few}
    <div class="rate">
      <span class="rate-name">{name(r.key)}<small>{fmt(r.k)} of {fmt(r.n)} findings</small></span>
      <span class="track" role="img" aria-label="{name(r.key)}: {shown ? pct(r.v) : 'too few findings'}">
        {#if band}
          <span
            class="band"
            style:left="{band[0] * 100}%"
            style:width="{(band[1] - band[0]) * 100}%"
            title="Human reviewers in published studies: {pct(band[0])} to {pct(band[1])}"
          ></span>
        {/if}
        {#if shown && r.ci}
          <span class="fill" style:width="{(r.v ?? 0) * 100}%"></span>
          <span
            class="ci"
            style:left="{r.ci[0] * 100}%"
            style:width="{(r.ci[1] - r.ci[0]) * 100}%"
            title="95% interval {pct(r.ci[0])} to {pct(r.ci[1])}"
          ></span>
        {/if}
      </span>
      <span class={['rate-value', { muted: !shown }]}>{shown ? pct(r.v) : r.n ? 'Too few' : '–'}</span>
    </div>
  {/each}
  <div class="scale"><span></span><div><span>0</span><span>50</span><span>100%</span></div><span></span></div>
{/if}
