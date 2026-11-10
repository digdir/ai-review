<script lang="ts">
  import { DOCS, docHref } from '../lib/docs';
  import { SOURCE } from '../lib/markdown';

  let { page, anchor }: { page: string; anchor: string | null } = $props();

  const doc = $derived(DOCS.find((d) => d.id === page) ?? DOCS[0]);
  const flash = (id: string | null, html: string) => (el: HTMLElement) => {
    const h = id && html ? el.querySelector(`[id="${id}"]`) : null;
    h?.classList.add('flash');
    return () => h?.classList.remove('flash');
  };
</script>

<div class="docs">
  <nav aria-label="Docs">
    <a href="#/start">Start here</a>
    {#each DOCS as d (d.id)}
      <a href={docHref(d.id)} aria-current={d.id === doc.id ? 'page' : undefined}>{d.title}</a>
      {#if d.id === doc.id}
        {#each d.headings.filter((h) => h.depth === 2) as h (h.id)}
          <a class="sub" href={docHref(d.id, h.id)}>{h.text}</a>
        {/each}
      {/if}
    {/each}
  </nav>
  <article class="doc" {@attach flash(anchor, doc.html)}>
    <h1>{doc.title}</h1>
    <p class="source">Rendered from <a href="{SOURCE}docs/{doc.id}.md"><code>docs/{doc.id}.md</code></a> when the dashboard was built.</p>
    {@html doc.html}
  </article>
</div>
