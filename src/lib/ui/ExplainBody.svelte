<script lang="ts">
  import { docHref, docLabel as headingLabel } from '../docs';

  let { means, source, doc, docLabel }: { means: string; source: string; doc: [string, string]; docLabel?: string } = $props();
</script>

<dl>
  <dt>What it means</dt>
  <dd>{means}</dd>
  <dt>Where it comes from</dt>
  <dd>{source}</dd>
  <dt>Read more</dt>
  <dd><a href={docHref(doc[0], doc[1])}>{docLabel ?? headingLabel(doc[0], doc[1])}</a></dd>
</dl>
