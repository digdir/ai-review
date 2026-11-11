<script lang="ts" module>
  export interface Series {
    name: string;
    tone: 'a' | 'b';
    values: (number | null)[];
  }
</script>

<script lang="ts">
  let {
    labels,
    shaded = [],
    series,
    reference,
    aria,
    format = (v: number) => `${Math.round(v * 100)}%`,
    height = 200,
  }: {
    labels: string[];
    shaded?: boolean[];
    series: Series[];
    reference?: { value: number; label: string };
    aria: string;
    format?: (v: number) => string;
    height?: number;
  } = $props();

  let width = $state(0);
  const W = $derived(width || 640);
  const L = 40;
  const R = 16;
  const T = 12;
  const B = 26;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = $derived((W - L - R) / Math.max(1, labels.length));
  const x = (i: number) => L + step * i + step / 2;
  const y = (v: number) => T + (height - T - B) * (1 - v);
  const path = (vs: (number | null)[]) => {
    let d = '';
    let pen = false;
    vs.forEach((v, i) => {
      if (v == null) return void (pen = false);
      d += `${pen ? 'L' : 'M'}${x(i)},${y(v)} `;
      pen = true;
    });
    return d.trim();
  };
</script>

<div class="chart" bind:clientWidth={width}>
  <svg viewBox="0 0 {W} {height}" width={W} {height} role="img" aria-label={aria}>
    {#each labels as _, i (i)}
      {#if shaded[i]}<rect class="shade" x={L + step * i} y={T} width={step} height={height - T - B} />{/if}
    {/each}
    {#each ticks as t (t)}
      <line class="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
      <text x={L - 8} y={y(t) + 4} text-anchor="end">{format(t)}</text>
    {/each}
    {#if reference}
      <line class="ref" x1={L} x2={W - R} y1={y(reference.value)} y2={y(reference.value)} />
    {/if}
    {#each series as s (s.name)}
      <path class="line {s.tone}" d={path(s.values)} />
      {#each s.values as v, i (i)}
        {#if v != null}<circle class="dot {s.tone}" cx={x(i)} cy={y(v)} r="3.5"><title>{s.name}, {labels[i]}: {format(v)}</title></circle>{/if}
      {/each}
    {/each}
    {#each labels as l, i (i)}
      <text x={x(i)} y={height - 8} text-anchor="middle">{l}</text>
    {/each}
    <line class="axis" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
  </svg>
  <div class="legend">
    {#each series as s (s.name)}<span><i class="line-{s.tone}"></i>{s.name}</span>{/each}
    {#if reference}<span><i class="ref"></i>{reference.label}</span>{/if}
    {#if shaded.some(Boolean)}<span><i class="shade"></i>Setup weeks, not counted</span>{/if}
  </div>
</div>
