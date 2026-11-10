<script lang="ts">
  import { COMPARE, HOW_ANTHROPIC } from '../compare';
  import Explain from './Explain.svelte';

  let { ours }: { ours: Record<string, string> } = $props();
</script>

<section class="panel" id="compare">
  <header>
    <h2>How we compare</h2>
    <span class="meta inline">Ours in bold. Read the caveat before the number.</span>
    <Explain
      name="the comparison"
      means="Our number beside Anthropic's published internal figures and independent studies. Each row says what makes the comparison imperfect; none is like for like."
      source="Figures quoted from the linked sources in a research note of 10 Nov 2026, kept in src/lib/compare.ts. Ours from the same computation as the criteria."
      doc={['experiment', 'question']}
      docLabel="The question and hypotheses"
    />
  </header>
  <div class="twrap">
    <table class="stack">
      <thead><tr><th>Measure</th><th>Ours</th><th>Anthropic, internal</th><th>Published elsewhere</th><th>Comparable?</th></tr></thead>
      <tbody>
        {#each COMPARE as row (row.key)}
          <tr>
            <td data-l="Measure" class="full"><b>{row.name}</b></td>
            <td data-l="Ours" class="ours">{ours[row.key]}</td>
            <td data-l="Anthropic, internal">{row.anthropic}</td>
            <td data-l="Published elsewhere">{row.published}</td>
            <td data-l="Comparable?" class="full">
              <span class="small muted">{row.caveat}</span>
              {#each row.sources as s (s.url)}<a class="xs src" href={s.url}>{s.label}</a>{/each}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="body two topline">
    <div>
      <h3>How Anthropic does it</h3>
      <p class="small gap-top">{HOW_ANTHROPIC.does} <a href={HOW_ANTHROPIC.source.url}>{HOW_ANTHROPIC.source.label}</a>.</p>
    </div>
    <div class="two">
      <div>
        <h4 class="eyebrow">What we copied</h4>
        <ul class="small bullets">{#each HOW_ANTHROPIC.copied as x (x)}<li>{x}</li>{/each}</ul>
      </div>
      <div>
        <h4 class="eyebrow">What differs</h4>
        <ul class="small bullets">{#each HOW_ANTHROPIC.differs as x (x)}<li>{x}</li>{/each}</ul>
      </div>
    </div>
  </div>
</section>
