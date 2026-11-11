<script lang="ts">
  import { CHECK, OUT, STATUS } from '../labels';

  let { status }: { status: string } = $props();

  const COLOR: Record<string, string> = {
    met: 'success',
    notmet: 'danger',
    early: 'neutral',
    done: 'success',
    todo: 'warning',
    later: 'neutral',
    fixed: 'success',
    open: 'warning',
  };
  const text = $derived(STATUS[status as keyof typeof STATUS] ?? CHECK[status as keyof typeof CHECK] ?? OUT[status]?.[0] ?? status);
</script>

<span class="ds-tag" data-color={COLOR[status] ?? 'neutral'} data-size="sm" title={OUT[status]?.[1]}>{text}</span>
