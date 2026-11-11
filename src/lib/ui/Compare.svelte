<script lang="ts">
  import { COMPARE, HOW_ANTHROPIC } from '../compare';
  import TableRegion from './TableRegion.svelte';

  let { ours }: { ours: Record<string, string> } = $props();
</script>

<details class="ds-details" id="compare">
  <summary>How we compare with published figures</summary>
  <div class="section">
    <p class="section-desc">
      Our numbers beside Anthropic's published internal figures and independent studies. None is like for like; each row says why. The figures were
      quoted from the linked sources on 10 Nov 2026.
    </p>
    <TableRegion label="How we compare">
      <table class="ds-table stacked" data-size="sm">
        <thead><tr><th>Measure</th><th>Ours</th><th>Anthropic, internal</th><th>Published elsewhere</th><th>Why it differs</th></tr></thead>
        <tbody>
          {#each COMPARE as row (row.key)}
            <tr>
              <td class="lead">{row.name}</td>
              <td data-l="Ours"><b>{ours[row.key]}</b></td>
              <td data-l="Anthropic, internal">{row.anthropic}</td>
              <td data-l="Published elsewhere">{row.published}</td>
              <td data-l="Why it differs">
                {row.caveat}
                <span class="sub">{#each row.sources as s, i (s.url)}{i ? ', ' : ''}<a class="ds-link" href={s.url}>{s.label}</a>{/each}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </TableRegion>
    <div class="columns">
      <div class="prose small">
        <h3 class="ds-heading" data-size="2xs">How Anthropic does it</h3>
        <p>{HOW_ANTHROPIC.does} <a class="ds-link" href={HOW_ANTHROPIC.source.url}>{HOW_ANTHROPIC.source.label}</a>.</p>
      </div>
      <div class="prose small">
        <h3 class="ds-heading" data-size="2xs">What we copied</h3>
        <ul>{#each HOW_ANTHROPIC.copied as x (x)}<li>{x}</li>{/each}</ul>
        <h3 class="ds-heading" data-size="2xs">What differs</h3>
        <ul>{#each HOW_ANTHROPIC.differs as x (x)}<li>{x}</li>{/each}</ul>
      </div>
    </div>
  </div>
</details>
