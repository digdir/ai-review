<script lang="ts">
  import Explain from './Explain.svelte';

  let {
    label,
    value,
    unit,
    sub,
    means,
    source,
    doc,
  }: { label: string; value: string; unit?: string; sub: string; means: string; source: string; doc: [string, string] } = $props();
</script>

<div class="stat">
  <span class="label">{label}</span>
  <Explain name={label} {means} {source} {doc} />
  <span class="value num">{value}{#if unit}<small>{unit}</small>{/if}</span>
  <span class="sub">{sub}</span>
</div>
