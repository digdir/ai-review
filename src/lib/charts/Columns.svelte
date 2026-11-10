<script lang="ts" module>
  export interface Column {
    label: string;
    value: number;
    part?: number;
    tone?: 'setup' | 'base';
    tip: string;
    top?: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { niceMax } from './scale';

  let {
    rows,
    aria,
    floor = 1,
    height = 140,
    slots = 1,
    format = (v: number) => String(v),
    legend,
  }: { rows: Column[]; aria: string; floor?: number; height?: number; slots?: number; format?: (v: number) => string; legend?: Snippet } = $props();

  let width = $state(0);
  const W = $derived(width || 480);
  const L = 34;
  const R = 8;
  const T = 16;
  const B = 24;
  const scale = $derived(niceMax(Math.max(0, ...rows.map((r) => r.value)), floor));
  const slot = $derived((W - L - R) / Math.max(rows.length, slots));
  const bw = $derived(Math.max(4, Math.min(24, slot * 0.6)));
  const y = (v: number) => T + (height - T - B) * (1 - v / scale.top);
  const every = $derived(Math.max(1, Math.ceil(30 / slot)));
</script>

<div class="chart" bind:clientWidth={width}>
  <svg viewBox="0 0 {W} {height}" width={W} {height} role="img" aria-label={aria}>
    {#each scale.ticks as t (t)}
      <line class="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
      <text x={L - 6} y={y(t) + 4} text-anchor="end">{format(t)}</text>
    {/each}
    {#each rows as r, i (r.label)}
      {@const x = L + slot * i + slot / 2 - bw / 2}
      {@const r0 = Math.min(3, y(0) - y(r.value), bw / 2)}
      <g>
        <title>{r.tip}</title>
        <rect class="hit" x={L + slot * i} y={T} width={slot} height={height - T - B} />
        {#if r.value > 0}
          <path class={['bar', r.tone]} d="M{x},{y(0)} V{y(r.value) + r0} q0,{-r0} {r0},{-r0} h{bw - 2 * r0} q{r0},0 {r0},{r0} V{y(0)} Z" />
        {/if}
        {#if r.part}
          <rect class="bar bad" {x} y={y(r.part)} width={bw} height={y(0) - y(r.part)} />
        {/if}
        {#if i % every === 0 || i === rows.length - 1}
          <text x={x + bw / 2} y={height - 7} text-anchor="middle">{r.label}</text>
        {/if}
        {#if r.top}
          <text class="lbl" x={x + bw / 2} y={y(r.value) - 5} text-anchor="middle">{r.top}</text>
        {/if}
      </g>
    {/each}
    <line class="axis" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
  </svg>
  {#if legend}<div class="legend">{@render legend()}</div>{/if}
</div>
