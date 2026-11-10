<script lang="ts">
  import { docHref, docLabel as headingLabel } from '../docs';

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
  <dl>
    <dt>What it means</dt>
    <dd>{means}</dd>
    <dt>Where it comes from</dt>
    <dd>{source}</dd>
    <dt>Read more</dt>
    <dd><a href={docHref(doc[0], doc[1])}>{docLabel ?? headingLabel(doc[0], doc[1])}</a></dd>
  </dl>
</div>
