<script lang="ts">
  import type { Snippet } from 'svelte';

  let { context, title, children }: { context?: string; title: string; children?: Snippet } = $props();
</script>

<div class="page-header">
  {#if context}<p class="context">{context}</p>{/if}
  <h1 class="ds-heading" data-size="lg">{title}</h1>
  {#if children}<p class="intro">{@render children()}</p>{/if}
</div>
