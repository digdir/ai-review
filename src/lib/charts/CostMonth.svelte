<script lang="ts">
  import { fmt } from '../format';

  let {
    points,
    days,
    projected,
    budget,
  }: { points: [number, number][]; days: number; projected: number; budget: number } = $props();

  let boxWidth = $state(0);
  const m = { t: 16, r: 12, b: 26, l: 52 };
  const H = 220;
  const W = $derived(Math.max(280, boxWidth || 600));
  const top = $derived(Math.max(budget, projected) * 1.1);
  const x = (d: number) => m.l + ((W - m.l - m.r) * (d - 1)) / (days - 1);
  const y = (v: number) => H - m.b - ((H - m.t - m.b) * v) / top;
  const last = $derived(points.at(-1));
</script>

<div class="chart" bind:clientWidth={boxWidth}>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Cost so far this month against budget">
    {#each [0, top / 2, top] as t, i (i)}
      <line class="grid-line" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
      <text x={m.l - 6} y={y(t) + 4} text-anchor="end">{fmt(Math.round(t / 100) * 100)}</text>
    {/each}
    {#each [1, 8, 15, 22, days] as d (d)}
      <text x={x(d)} y={H - 8} text-anchor="middle">{d}</text>
    {/each}
    <line class="limit" x1={m.l} x2={W - m.r} y1={y(budget)} y2={y(budget)} />
    <text x={W - m.r} y={y(budget) - 6} text-anchor="end">Budget NOK {fmt(budget)}</text>
    {#if last}
      <polyline class="line" points={points.map(([d, v]) => `${x(d)},${y(v)}`).join(' ')} />
      <line class="proj" x1={x(last[0])} y1={y(last[1])} x2={x(days)} y2={y(projected)} />
      <circle cx={x(last[0])} cy={y(last[1])} r="4" style="fill:var(--ds-color-accent-base-default)" />
      <text x={x(days)} y={y(projected) + (projected > budget ? -8 : 16)} text-anchor="end">Projected NOK {fmt(projected)}</text>
    {/if}
    <line class="axis" x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} />
  </svg>
</div>
