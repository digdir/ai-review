<script lang="ts">
  let {
    rows,
    max,
    aria,
  }: { rows: { label: string; value: number | null; text: string }[]; max?: number; aria: string } = $props();

  const top = $derived(max ?? Math.max(1, ...rows.map((r) => r.value ?? 0)));
  const pct = (v: number | null) => `${Math.max(0, Math.min(100, ((v ?? 0) / top) * 100))}%`;
</script>

<ul class="hbars" aria-label={aria}>
  {#each rows as r (r.label)}
    <li class="hbar">
      <span class="n">{r.label}</span>
      <span class="track" aria-hidden="true"><i style:width={pct(r.value)}></i></span>
      <span class="v">{r.text}</span>
    </li>
  {/each}
</ul>
