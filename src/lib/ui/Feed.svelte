<script lang="ts">
  import type { CheckOut } from '../compute';

  let { items }: { items: CheckOut[] } = $props();

  const TONE: Record<CheckOut['tone'], string> = {
    important: 'k-imp',
    dismissed: 'k-dis',
    waiting: 'k-wait',
    rule: 'k-rule',
    escaped: 'k-esc',
    cost: 'k-cost',
    size: 'k-size',
  };
</script>

<section class="panel" id="checkout">
  <header>
    <h2>Things to check out</h2>
    <span class="meta">Picked by fixed rules from the data. Titles only; the full text stays in GitHub.</span>
  </header>
  {#if items.length}
    <ul class="feed">
      {#each items as x (x.kind)}
        <li>
          <span class="kind {TONE[x.tone]}"><i></i>{x.kind}</span>
          <div>
            <div class="h">{#if x.url}<a href={x.url}>{x.title}</a>{:else}{x.title}{/if}</div>
            <div class="m">
              {#each x.meta as line, i (i)}<span>{line}</span>{/each}
              {#if x.pr}<span>#{x.pr}</span>{/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">Nothing yet. Items appear as findings, changes and runs come in.</p>
  {/if}
</section>
