<script lang="ts">
  import type { Metrics } from '../compute';
  import { weekday } from '../format';
  import { CRITERIA, QUESTION } from '../labels';
  import Explain from './Explain.svelte';
  import Meter from './Meter.svelte';
  import Pill from './Pill.svelte';

  let { m }: { m: Metrics } = $props();

  const items = $derived(CRITERIA.map((def) => ({ def, c: m.criteria.find((x) => x.key === def.key)! })));
  const summary = $derived(`${m.counts.met} of 7 met, ${m.counts.notmet} not met, ${m.counts.early} too early.`);
  const meta = $derived(
    m.phase === 'setup'
      ? `Counted from ${weekday(m.T.measureMs)}, weeks 3 to 6`
      : m.health
        ? `Last four weeks, as ongoing health. ${summary}`
        : `Weeks 3 to 6${m.phase === 'measuring' ? ' so far' : ''}. ${summary}`,
  );
</script>

<section class="panel" id="criteria">
  <header><h2>{QUESTION.trust} The seven criteria</h2><span class="meta">{meta}</span></header>
  <ul class="crit">
    {#each items as { def, c } (def.key)}
      {#if def.question}<li class="group"><span class="eyebrow">{def.question}</span></li>{/if}
      <li>
        <span class="name">{def.name}<small>{def.rule}. Read when: {def.read.toLowerCase()}</small></span>
        <span class="val"><span class={{ muted: c.status === 'early' }}>{c.text}</span><small>{c.sub}</small></span>
        <Meter fill={m.phase === 'setup' ? null : c.fill} tick={c.tick} tickLabel={c.tickLabel} status={c.status} label="{c.text} against {def.rule.toLowerCase()}" />
        <span class="status-cell"><Pill status={c.status} /></span>
        <Explain name={def.name} means={def.means} source={def.source} doc={def.doc} docLabel="Measures and thresholds in the protocol" />
      </li>
    {/each}
  </ul>
</section>
