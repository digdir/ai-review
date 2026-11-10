<script lang="ts">
  import { OUT } from '../labels';

  let { outcome }: { outcome: string } = $props();
</script>

<span class="out {outcome}" title={OUT[outcome]?.[1]}>{OUT[outcome]?.[0] ?? outcome}</span>
