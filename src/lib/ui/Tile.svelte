<script lang="ts">
  import Explain from './Explain.svelte';

  let {
    label,
    value,
    unit,
    sub,
    tone = 'plain',
    means,
    source,
    doc,
    mono = false,
  }: {
    label: string;
    value: string;
    unit?: string;
    sub: string;
    tone?: 'on' | 'watch' | 'off' | 'plain';
    means: string;
    source: string;
    doc: [string, string];
    mono?: boolean;
  } = $props();
</script>

<div class="tile {tone}">
  <span class="label">{label}</span>
  <Explain name={label} {means} {source} {doc} />
  <span class={['value', mono && 'mono stamp-value']}>{value}{#if unit}<small>{unit}</small>{/if}</span>
  <span class="sub">{sub}</span>
</div>
