<script lang="ts">
  import Bars from '../lib/charts/Bars.svelte';
  import CostMonth from '../lib/charts/CostMonth.svelte';
  import type { Metrics } from '../lib/compute';
  import { day, fmt, nok, pct } from '../lib/format';
  import type { ExperimentConfig } from '../lib/types';
  import Stat from '../lib/ui/Stat.svelte';

  let { m, config }: { m: Metrics; config: ExperimentConfig } = $props();

  const share = $derived(m.projected / config.budgetNok);
</script>

<div class="stats">
  <Stat label="Spent this month" value={nok(m.monthNok)} help="Actual cost from Azure Cost Management, or the model's own report until the invoice arrives.">
    {m.haveAzure ? 'from Azure' : 'estimated from runs'}
  </Stat>
  <Stat
    label="Projected month"
    value={nok(m.projected)}
    status={share > 1 ? 'bad' : share > 0.8 ? 'wait' : 'ok'}
    help="Spent so far plus the daily average for the rest of the month."
  >
    {pct(share)} of the NOK {fmt(config.budgetNok)} budget
  </Stat>
  <Stat label="Per reviewed PR" value={nok(m.costPerPr)} help="Review and follow-up runs divided by reviewed pull requests.">
    {fmt(m.reviewedCount)} PRs reviewed
  </Stat>
  <Stat label="Per fixed finding" value={nok(m.costPerFix)} help="What one confirmed fix costs. The best single measure of value for money.">
    {fmt(m.fixedN)} fixes
  </Stat>
  <Stat label="Split" value={nok(m.reviewCost)} help="Reviews, follow-ups and shadow runs.">
    reviews, {nok(m.followCost)} follow-ups, {nok(m.shadowCost)} shadow
  </Stat>
  <Stat label="Prompt cache hits" value={pct(m.cacheHit)} help="Share of input tokens read from the prompt cache. Higher is cheaper.">input tokens from cache</Stat>
</div>
<div class="ds-card" data-color="neutral">
  <div class="section-head">
    <h2 class="ds-heading" data-size="2xs">This month against budget</h2>
    <div class="legend">
      <span><i style="background:var(--ds-color-accent-base-default)"></i>Spent</span><span
        ><i style="border-top:2px dashed var(--ds-color-accent-base-default);height:0;border-radius:0"></i>Projected</span
      ><span><i style="border-top:2px dashed var(--ds-color-danger-base-default);height:0;border-radius:0"></i>Budget</span>
    </div>
  </div>
  <CostMonth points={m.monthCumulative} days={m.daysInMonth} projected={m.projected} budget={config.budgetNok} />
</div>
<div class="ds-card" data-color="neutral">
  <h2 class="ds-heading" data-size="2xs">Cost per reviewed pull request, by day</h2>
  <Bars
    rows={m.costDays}
    value={(d) => d.perPr}
    label={(d) => day(d.d)}
    cls={() => 'bar-review'}
    title="Cost per reviewed pull request by day"
    unit=" NOK"
    height={180}
  />
</div>
{#if !m.haveAzure}
  <div class="ds-alert" data-color="info" data-size="sm">
    <p class="ds-paragraph" data-size="sm">
      Cost in NOK comes from Azure Cost Management with about a day's delay. Until then, the dashboard uses the model's own report in USD, converted at
      {fmt(config.usdNok, 2)} NOK per USD.
    </p>
  </div>
{/if}
