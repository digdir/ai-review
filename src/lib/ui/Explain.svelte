<script lang="ts">
  import ExplainBody from './ExplainBody.svelte';

  let {
    name,
    means,
    source,
    doc,
    docLabel,
  }: { name: string; means: string; source: string; doc: [string, string]; docLabel?: string } = $props();

  let open = $state(false);
  const id = $props.id();
</script>

<button type="button" class="why" aria-expanded={open} aria-controls={id} aria-label="Explain {name}" onclick={() => (open = !open)}>?</button>
<div class="explain" {id} hidden={!open}>
  <ExplainBody {means} {source} {doc} {docLabel} />
</div>
