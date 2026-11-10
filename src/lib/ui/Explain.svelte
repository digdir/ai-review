<script lang="ts">
  import { docHref } from '../docs';

  let {
    name,
    means,
    source,
    doc,
    docLabel = 'The definition in the docs',
  }: { name: string; means: string; source: string; doc?: [string, string]; docLabel?: string } = $props();

  let open = $state(false);
  const id = $props.id();
</script>

<button type="button" class="why" aria-expanded={open} aria-controls={id} aria-label="Explain {name}" onclick={() => (open = !open)}>?</button>
<div class="explain" {id} hidden={!open}>
  <dl>
    <dt>What it means</dt>
    <dd>{means}</dd>
    <dt>Where it comes from</dt>
    <dd>{source}</dd>
    {#if doc}
      <dt>Read more</dt>
      <dd><a href={docHref(doc[0], doc[1])}>{docLabel}</a></dd>
    {/if}
  </dl>
</div>
