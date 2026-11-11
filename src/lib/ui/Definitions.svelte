<script lang="ts" module>
  export interface Definition {
    term: string;
    means: string;
    source: string;
    doc: [string, string];
  }
</script>

<script lang="ts">
  import { docHref, docLabel } from '../docs';

  let { items }: { items: Definition[] } = $props();
</script>

<details class="ds-details definitions" id="definitions">
  <summary>How these figures are measured</summary>
  <div>
    <dl>
      {#each items as d (d.term)}
        <div>
          <dt>{d.term}</dt>
          <dd>
            {d.means}
            <span class="src">Source: {d.source} <a class="ds-link" href={docHref(d.doc[0], d.doc[1])}>{docLabel(d.doc[0], d.doc[1])}</a></span>
          </dd>
        </div>
      {/each}
    </dl>
  </div>
</details>
