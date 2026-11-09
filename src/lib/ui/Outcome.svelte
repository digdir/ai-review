<script lang="ts">
  import { OUT, OUT_COLOR } from '../labels';

  let { outcome, shadow = false }: { outcome: string; shadow?: boolean } = $props();
</script>

{#if shadow}
  <span class="out" title="Reviewed silently, nothing posted">Shadow</span>
{:else}
  <span class="out" style:--dot={OUT_COLOR[outcome]} title={OUT[outcome]?.[2]}>{OUT[outcome]?.[1] ?? outcome}</span>
{/if}
