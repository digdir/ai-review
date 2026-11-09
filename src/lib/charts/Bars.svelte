<script lang="ts" generics="T">
  import { fmt, pct } from '../format';

  let {
    rows,
    value,
    label,
    cls,
    title,
    tip = undefined,
    ref = null,
    unit = '',
    decimals = 0,
    height = 200,
    max: fixedMax,
  }: {
    rows: T[];
    value: (row: T) => number | null;
    label: (row: T) => string;
    cls: (row: T) => string;
    title: string;
    tip?: (row: T) => string;
    ref?: number | null;
    unit?: string;
    decimals?: number;
    height?: number;
    max?: number;
  } = $props();

  let boxWidth = $state(0);
  let tipText = $state('');
  let tipAt = $state<{ x: number; y: number } | null>(null);
  let tipWidth = $state(0);
  let tipHeight = $state(0);

  const m = { t: 18, r: 8, b: 26, l: 40 };
  const W = $derived(Math.max(280, boxWidth || 480));
  const H = $derived(height);
  const top = $derived(fixedMax ?? Math.max(1e-9, ...rows.map((r) => value(r) || 0), ref || 0) * 1.15);
  const y = (v: number) => H - m.b - ((H - m.t - m.b) * v) / top;
  const bw = $derived((W - m.l - m.r) / rows.length);
  const every = $derived(Math.ceil(rows.length / Math.max(1, Math.floor((W - m.l) / 52))));
  const tickText = (t: number) => (unit === '%' ? `${fmt(t * 100)} %` : fmt(t, top > 10 ? 0 : 1));
  const barText = (v: number) => (unit === '%' ? fmt(v * 100) : fmt(v, decimals)) + (unit && unit !== '%' ? unit : '');
  const hidden = (r: T) => (r as { hidden?: boolean }).hidden === true;

  const tipFor = (r: T) => (tip ? tip(r) : `${label(r)}: ${unit === '%' ? pct(value(r)) : fmt(value(r), decimals) + unit}`);

  function show(ev: PointerEvent, text: string) {
    const box = (ev.currentTarget as Element).closest('.chart')!.getBoundingClientRect();
    tipText = text;
    tipAt = { x: ev.clientX - box.left, y: ev.clientY - box.top };
  }
</script>

<div class="chart" bind:clientWidth={boxWidth}>
  {#if !rows.length}
    <p class="empty">No data yet.</p>
  {:else}
    <svg viewBox="0 0 {W} {H}" role="img" aria-label={title}>
      {#each [0, top / 2, top] as t, i (i)}
        <line class="grid-line" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
        <text x={m.l - 6} y={y(t) + 4} text-anchor="end">{tickText(t)}</text>
      {/each}
      {#each rows as r, i (i)}
        {@const v = value(r)}
        {@const x = m.l + i * bw + bw * 0.18}
        {@const w = bw * 0.64}
        {#if v != null}
          <rect
            role="presentation"
            class={cls(r)}
            {x}
            y={y(v)}
            width={w}
            height={Math.max(0, y(0) - y(v))}
            rx="3"
            onpointermove={(ev) => show(ev, tipFor(r))}
            onpointerleave={() => (tipAt = null)}
          />
          {#if w > 22}<text x={x + w / 2} y={y(v) - 5} text-anchor="middle">{barText(v)}</text>{/if}
        {:else if hidden(r)}
          <rect
            role="presentation"
            class="bar-hidden"
            {x}
            y={y(top * 0.12)}
            width={w}
            height={y(0) - y(top * 0.12)}
            rx="3"
            onpointermove={(ev) => show(ev, tipFor(r))}
            onpointerleave={() => (tipAt = null)}
          />
        {/if}
        {#if i % every === 0}<text x={x + w / 2} y={H - 8} text-anchor="middle">{label(r)}</text>{/if}
      {/each}
      {#if ref != null}<line class="ref" x1={m.l} x2={W - m.r} y1={y(ref)} y2={y(ref)} />{/if}
      <line class="axis" x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} />
    </svg>
    <div
      class="tip"
      hidden={!tipAt}
      bind:offsetWidth={tipWidth}
      bind:offsetHeight={tipHeight}
      style:left="{tipAt ? Math.max(0, Math.min(tipAt.x - tipWidth / 2, boxWidth - tipWidth)) : 0}px"
      style:top="{tipAt ? Math.max(0, tipAt.y - tipHeight - 12) : 0}px"
    >
      {tipText}
    </div>
  {/if}
</div>

