<script lang="ts">
  let { severity, count }: { severity: string; count?: number } = $props();
</script>

<span class="ds-tag" data-variant="outline" data-color={severity === 'Important' ? 'danger' : 'neutral'} data-size="sm"
  >{count != null ? `${count} ` : ''}{severity}</span
>
