<script lang="ts" module>
  export interface StatItem {
    label: string;
    value: string;
    context?: string;
  }
</script>

<script lang="ts">
  let { items, label }: { items: StatItem[]; label: string } = $props();
</script>

<dl class="stats" aria-label={label}>
  {#each items as s (s.label)}
    <div>
      <dt>{s.label}</dt>
      <dd class="value">{s.value}</dd>
      {#if s.context}<dd class="context">{s.context}</dd>{/if}
    </div>
  {/each}
</dl>
