<script lang="ts">
  import { CHECK, STATUS } from '../labels';
  import type { Check, Status } from '../types';

  let { status }: { status: Status | Check } = $props();

  const text = $derived(status in STATUS ? STATUS[status as Status] : CHECK[status as Check]);
</script>

<span class="status {status}">{text}</span>
