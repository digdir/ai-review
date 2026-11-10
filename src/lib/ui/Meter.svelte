<script lang="ts">
  import type { Status } from '../types';

  let {
    fill,
    tick,
    tickLabel,
    status,
    label,
    tall = false,
  }: { fill: number | null; tick: number; tickLabel: string; status?: Status; label: string; tall?: boolean } = $props();

  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;
  const tone = $derived(fill == null ? 'none' : status === 'met' ? 'ok' : status === 'notmet' ? 'bad' : '');
</script>

{#if fill == null}
  <div class={['meter', tall && 'tall']} aria-hidden="true"><span class="fill none" style:width="0"></span></div>
{:else}
  <div class={['meter', tall && 'tall']} role="img" aria-label={label}>
    <span class="fill {tone}" style:width={pct(fill)}></span>
    <span class="tick" style:left={pct(tick)} data-l={tickLabel}></span>
  </div>
{/if}
