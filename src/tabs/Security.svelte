<script lang="ts">
  import Bars from '../lib/charts/Bars.svelte';
  import Rates from '../lib/charts/Rates.svelte';
  import type { Metrics } from '../lib/compute';
  import { day, fmt, pct } from '../lib/format';
  import { CAT } from '../lib/labels';
  import type { ExperimentConfig } from '../lib/types';
  import Stat from '../lib/ui/Stat.svelte';

  let { m, config }: { m: Metrics; config: ExperimentConfig } = $props();

  const secImportant = $derived(m.secFindings.filter((f) => f.severity === 'Important').length);
  const secFixed = $derived(m.byCat[0]);
  const openAlerts = $derived(m.codeql.filter((a) => a.state === 'open').length);
</script>

<p class="hint">
  Does the review catch what matters most: access, tenant separation, model controls, personal data, migrations, infrastructure and workflows? A sensitive
  pull request is one that changes such files.
</p>
<div class="stats">
  <Stat label="Security findings" value={fmt(m.secFindings.length)} help="Findings from the security finder.">{fmt(secImportant)} Important</Stat>
  <Stat
    label="Security fix rate"
    value={secFixed.n && !secFixed.few ? pct(secFixed.v) : secFixed.n ? 'Too few' : '–'}
    help="Security findings on merged pull requests confirmed fixed."
  >
    {fmt(secFixed.k)} of {fmt(secFixed.n)} on merged PRs
  </Stat>
  <Stat label="Sensitive PRs" value={pct(m.since.length ? m.sensSince.length / m.since.length : null)} help="Merged pull requests that touch sensitive paths.">
    {fmt(m.sensSince.length)} of {fmt(m.since.length)} merged
  </Stat>
  <Stat
    label="Risk section filled in"
    value={pct(m.riskFilled(m.since).v)}
    status={m.riskMismatch ? 'wait' : null}
    help="Pull requests with the Risk section of the template filled in."
  >
    {m.riskMismatch ? `${fmt(m.riskMismatch)} sensitive marked low` : 'no sensitive PR marked low'}
  </Stat>
  <Stat
    label="Open CodeQL alerts"
    value={m.codeqlKnown ? fmt(openAlerts) : '–'}
    status={m.codeqlKnown ? (openAlerts ? 'wait' : 'ok') : null}
    help="Alerts from code scanning that are still open."
  >
    {m.codeqlKnown ? `${fmt(m.codeql.length)} since the baseline` : 'not readable with the workflow token'}
  </Stat>
</div>
<div class="grid grid-2">
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Fix rate by finder</h2>
    <p class="hint">Which of the five finders a finding came from.</p>
    <div class="rates" style="margin-top:var(--ds-size-3)">
      <Rates rows={m.byCat.filter((c) => c.n)} name={(k) => CAT[k]} band={config.humanBand} empty="No findings with a finder on merged pull requests yet." />
    </div>
  </div>
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="2xs">Sensitive pull requests</h2>
    <p class="hint">Human means an approval or comment from someone other than the author.</p>
    <div class="table-wrap" style="margin-top:var(--ds-size-3)">
      <table class="ds-table" data-size="sm">
        <thead>
          <tr><th>Group</th><th class="num">PRs</th><th class="num">Reviewed</th><th class="num">Security finding</th><th class="num">Human review</th></tr>
        </thead>
        <tbody>
          {#each m.sensitiveRows as row (row.name)}
            <tr>
              <td>{row.name}</td><td class="num">{fmt(row.n)}</td><td class="num">{pct(row.reviewed)}</td><td class="num">{pct(row.security)}</td><td
                class="num">{pct(row.human)}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
<div class="ds-card" data-color="neutral">
  <div class="section-head">
    <h2 class="ds-heading" data-size="2xs">New CodeQL alerts per week</h2>
    <div class="legend">
      <span><i style="background:var(--ds-color-neutral-border-default)"></i>Baseline</span><span
        ><i style="background:var(--ds-color-accent-base-default)"></i>With review</span
      >
    </div>
  </div>
  <p class="hint">What the automated checks found. The review should find something else, not the same thing.</p>
  {#if !m.codeqlKnown}
    <p class="empty">Not available: the workflow token cannot read this repository's code-scanning alerts.</p>
  {:else}
  <Bars
    rows={m.weeks}
    value={(w) => w.codeql}
    label={(w) => day(w.w)}
    cls={(w) => (w.phase === 'review' ? 'bar-review' : 'bar-base')}
    title="New CodeQL alerts per week"
    height={180}
    tip={(w) => `Week of ${day(w.w)}: ${w.codeql} new alerts`}
  />
  {/if}
</div>
