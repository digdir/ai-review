<script lang="ts">
  import type { Snippet } from 'svelte';
  import { LED } from '../labels';
  import type { Status } from '../types';

  let { label, value, help, status, children }: { label: string; value: string; help: string; status?: Status | null; children?: Snippet } = $props();
</script>

<div class="stat">
  <span class="stat-label">
    {#if status}<i class="led {LED[status]}"></i>{/if}{label}<span class="help" title={help} aria-label={help} role="img">?</span>
  </span>
  <span class="stat-value">{value}</span>
  <span class="stat-sub">{@render children?.()}</span>
</div>
