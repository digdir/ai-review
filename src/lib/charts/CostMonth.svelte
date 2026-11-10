<script lang="ts">
  import { fmt, nok } from '../format';

  let { spent, projected, budget }: { spent: number; projected: number | null; budget: number } = $props();

  const scale = $derived(Math.max(budget * 1.2, (projected ?? spent) * 1.05));
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
  const over = $derived((projected ?? spent) > budget);
  const label = $derived(`${nok(spent)} spent, ${projected == null ? 'no projection yet' : nok(projected) + ' projected'}, budget ${nok(budget)}`);
</script>

<div class="meter tall" role="img" aria-label={label}>
  <span class={['fill', over && 'bad']} style:width={pct(spent)}></span>
  {#if projected != null}
    <span class="tick up projected" style:left={pct(projected)} data-l="projected {fmt(Math.round(projected))}"></span>
  {/if}
  <span class="tick" style:left={pct(budget)} data-l="budget {fmt(budget)}"></span>
</div>
