<script lang="ts">
  import type { Snippet } from 'svelte';
  import { docHref, docLabel } from '../docs';

  let {
    id,
    title,
    description,
    doc,
    children,
  }: { id: string; title: string; description?: string; doc?: [string, string]; children: Snippet } = $props();
</script>

<section class="section" {id} aria-labelledby="{id}-heading">
  <div class="section-head">
    <h2 class="ds-heading" data-size="sm" id="{id}-heading">{title}</h2>
    {#if doc}<a class="ds-link section-doc" href={docHref(doc[0], doc[1])}>{docLabel(doc[0], doc[1])}</a>{/if}
  </div>
  {#if description}<p class="section-desc">{description}</p>{/if}
  {@render children()}
</section>
