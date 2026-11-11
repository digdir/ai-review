<script lang="ts">
  import { DOCS, docHref } from '../lib/docs';
  import { SOURCE } from '../lib/markdown';

  let { page, anchor }: { page: string; anchor: string | null } = $props();

  const doc = $derived(DOCS.find((d) => d.id === page) ?? DOCS[0]);
  const sections = $derived(doc.headings.filter((h) => h.depth === 2));
  const flash = (id: string | null, html: string) => (el: HTMLElement) => {
    const h = id && html ? el.querySelector(`[id="${id}"]`) : null;
    h?.classList.add('flash');
    return () => h?.classList.remove('flash');
  };
</script>

<div class="page">
  <div class="page-header">
    <p class="context">Docs</p>
    <h1 class="ds-heading" data-size="lg">{doc.title}</h1>
    <p class="doc-source">Rendered from <a class="ds-link" href="{SOURCE}docs/{doc.id}.md">docs/{doc.id}.md</a> when the dashboard was built.</p>
  </div>
  {#if sections.length > 2}
    <nav class="on-page" aria-labelledby="on-page">
      <h2 id="on-page">On this page</h2>
      <ul>
        {#each sections as h (h.id)}<li><a class="ds-link" href={docHref(doc.id, h.id)}>{h.text}</a></li>{/each}
      </ul>
    </nav>
  {/if}
  <article class="doc" {@attach flash(anchor, doc.html)}>
    {@html doc.html}
  </article>
</div>
