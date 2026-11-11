<script lang="ts">
  import Columns from '../lib/charts/Columns.svelte';
  import CostMonth from '../lib/charts/CostMonth.svelte';
  import HBars from '../lib/charts/HBars.svelte';
  import type { Metrics } from '../lib/compute';
  import { day, fmt, minutes, nok, pct, stamp, usd, weekday } from '../lib/format';
  import { JOB, SWEEP_PASSES } from '../lib/labels';
  import type { Data, ExperimentConfig } from '../lib/types';
  import Definitions, { type Definition } from '../lib/ui/Definitions.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Section from '../lib/ui/Section.svelte';
  import Stats from '../lib/ui/Stats.svelte';
  import StatusTag from '../lib/ui/StatusTag.svelte';
  import TableRegion from '../lib/ui/TableRegion.svelte';

  let { data, m, config, collected, ok }: { data: Data; m: Metrics; config: ExperimentConfig; collected: string; ok: boolean } = $props();

  const o = $derived(m.ops);
  const sw = $derived(m.ops.sweep);
  const r = $derived(m.repo);
  const repo = $derived(data.config.repo);
  const since = $derived(weekday(m.T.startMs));
  const month = $derived(new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(m.now));
  const costNote = $derived(
    m.projected == null
      ? `The projection reads from day 5 of the month. Until then, ${nok(m.monthNok)} is what was spent so far.`
      : `${nok(m.monthNok)} spent so far ${m.haveAzure ? 'according to Azure Cost Management' : `from the run records at USD 1 = NOK ${fmt(config.usdNok, 2)}`}. With the daily average for the remaining ${fmt(m.daysLeftMonth)} days, ${nok(m.projected)} by the end of ${month}.`,
  );
  const definitions: Definition[] = [
    {
      term: 'Collection',
      means: 'Whether the last read of GitHub, the run records, the CodeQL snapshot and Azure cost worked. The dashboard rebuilds every 20 minutes on weekdays and every hour otherwise.',
      source: 'data/index.json from dashboard/collect.mjs.',
      doc: ['runbook', 'when-the-dashboard-is-stale-or-down'],
    },
    {
      term: 'Failed runs',
      means: 'Runs that did not complete. A failed review means the pull request got no review; a failed follow-up leaves threads open.',
      source: 'Run records and the Actions log.',
      doc: ['runbook', 'when-a-review-fails'],
    },
    {
      term: 'Review time',
      means: 'How long one review run takes, median. Anthropic reports about 20 minutes on its managed service for large pull requests.',
      source: 'Run records.',
      doc: ['runbook', 'when-a-review-fails'],
    },
    {
      term: 'Cost',
      means: 'Azure cost of the review resource group this month, projected to the end of the month from the daily average. It counts the review, the follow-ups and the weekly security sweep, which uses the same Foundry resource. The budget alerts at 80 and 100 percent.',
      source: 'Azure Cost Management, about a day behind. Until it arrives, the run records of the review and the security sweep in USD.',
      doc: ['runbook', 'when-the-budget-alerts'],
    },
    {
      term: 'Security sweep',
      means: 'The weekly sweep of the security-sensitive code: three passes (tenancy, rights, secrets) and a coordinate step that confirms their candidates, each step capped at about USD 6. Coordinate is skipped when the passes find no candidates. Incomplete means a step failed or hit its cap, so the sealed report may miss findings, and the cost may be low because a step that stops early reports none. The cost counts in the month\'s cost, not in the cost per pull request. The findings are sealed for the maintainers; the dashboard never reads them.',
      source: 'The run list of the sweep workflow, the outcome of each step from the run log, and cost and duration from security-sweep-run.json in the run artifact. The artifact is kept 14 days; the collector keeps its own copy.',
      doc: ['runbook', 'the-security-sweep'],
    },
    {
      term: 'Per reviewed pull request and per confirmed fix',
      means: 'All review and follow-up runs divided by reviewed pull requests, or by findings answered fixed. The security sweep is not included. Anthropic charges USD 15 to 25 per review; GitHub Copilot about USD 0.52.',
      source: 'Run records in USD; Azure as the check.',
      doc: ['runbook', 'when-the-budget-alerts'],
    },
    {
      term: 'Cache hit share',
      means: 'Share of input tokens served from the prompt cache. A drop after a prompt change means the cache was invalidated.',
      source: 'Token counts in the run records.',
      doc: ['runbook', 'when-the-budget-alerts'],
    },
    {
      term: 'Empty re-reviews',
      means: 'Full reviews of a head commit that an earlier review of the same pull request already covered. Each costs a run and finds nothing new.',
      source: 'Run records: pull request and head commit.',
      doc: ['runbook', 'when-a-review-fails'],
    },
    {
      term: 'Permission denials',
      means: 'Times a run was refused a tool call. The review completes, but a finding may rest on less than the whole file.',
      source: 'The field permission_denials in the run records, once the review workflow writes it.',
      doc: ['runbook', 'when-a-review-fails'],
    },
    {
      term: 'Coverage',
      means: 'Pull requests by people, not drafts, that got a review run in either group. A health check, not a goal.',
      source: 'Pull requests and run records.',
      doc: ['experiment', 'design'],
    },
    {
      term: 'Grading',
      means: 'Two graders grade a weekly sample without seeing the group or the outcome. Kappa under 0.4 means the grades are not reliable yet.',
      source: 'inputs/<owner>/<name>/grading.json.',
      doc: ['grading', 'who-and-when'],
    },
  ];
</script>

<div class="page">
  <PageHeader context={repo} title="Operations">
    Is the review running, and within budget? For the lab: runs, cost, this week's checklist, setup and grading.
  </PageHeader>

  {#if !ok}
    <div class="ds-alert" data-color="danger">The last collection failed. The numbers on this page may be old.</div>
  {/if}

  <Stats
    label="Runs and cost"
    items={[
      { label: 'Collection', value: ok ? 'Worked' : 'Failed', context: `Last ${stamp(collected)}` },
      { label: 'Runs today', value: fmt(m.board.runsToday), context: `${fmt(o.reviews)} reviews and ${fmt(o.followUps)} follow-ups since ${since}` },
      { label: 'Failed runs', value: `${fmt(o.failed.k)} of ${fmt(o.failed.n)}`, context: `${pct(o.failed.v ?? 0)} since ${since}` },
      { label: 'Review time', value: minutes(o.reviewTime.med), context: `Median, slowest tenth ${minutes(o.reviewTime.p90)}` },
      {
        label: `Cost in ${month}`,
        value: m.projected != null ? pct(m.projected / config.budgetNok) : nok(m.monthNok),
        context: m.projected != null ? `Of the ${nok(config.budgetNok)} budget, projected` : 'Spent so far. Projected from day 5',
      },
    ]}
  />

  <Section id="runs" title="Runs per day" description="The last two weeks, both jobs and both groups. Failed runs in red.">
    <Columns
      aria="Runs per day over the last two weeks, failed runs marked"
      floor={4}
      rows={o.runsPerDay.map((d) => ({ label: d.date.slice(8), value: d.runs, part: d.failed, tip: `${day(d.date + 'T12:00:00Z')}: ${fmt(d.runs)} runs, ${fmt(d.failed)} failed` }))}
    >
      {#snippet legend()}<span><i></i>Runs (day of month)</span><span><i class="bad"></i>Failed</span>{/snippet}
    </Columns>
  </Section>

  <Section id="failed" title="Failed runs" doc={['runbook', 'when-a-review-fails']}>
    {#if o.failedRuns.length}
      <TableRegion label="Failed runs">
        <table class="ds-table" data-size="sm">
          <thead><tr><th scope="col">Started</th><th scope="col">Pull request</th><th scope="col">Job</th><th scope="col">Log</th></tr></thead>
          <tbody>
            {#each o.failedRuns.slice(0, 20) as x (x.run_id)}
              <tr>
                <td class="nowrap">{stamp(x.started_at)}</td>
                <td>{#if x.pr_number}<a class="ds-link" href="https://github.com/{repo}/pull/{x.pr_number}">#{x.pr_number}</a>{:else}–{/if}</td>
                <td>{JOB[x.job ?? 'review']}</td>
                <td><a class="ds-link" href="https://github.com/{repo}/actions/runs/{x.run_id}">Actions log</a></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </TableRegion>
    {:else}
      <EmptyState>No failed runs.</EmptyState>
    {/if}
  </Section>

  <Section id="cost" title="Cost in {month}" doc={['runbook', 'when-the-budget-alerts']}>
    <p class="section-desc">{costNote}</p>
    <CostMonth spent={m.monthNok} projected={m.projected} budget={config.budgetNok} />
    <dl class="facts">
      <dt>Per reviewed pull request</dt>
      <dd>{nok(o.cost.perPr)}, runs {usd(o.cost.run.min)} to {usd(o.cost.run.max)}, median {usd(o.cost.run.med)}</dd>
      <dt>Per confirmed fix</dt>
      <dd>{nok(o.cost.perFix)}{#if o.cost.perImportantFix}, per Important fix {nok(o.cost.perImportantFix)}{/if}</dd>
      <dt>Cache hit share</dt>
      <dd>{pct(o.cost.cacheHit)} of input tokens</dd>
      {#if sw.configured}
        <dt>Security sweep</dt>
        <dd>{nok(sw.month.nok)} in {fmt(sw.month.runs)} {sw.month.runs === 1 ? 'run' : 'runs'} ({usd(sw.month.usd)}), {m.haveAzure ? 'part of the Azure cost' : 'added to the run records'}</dd>
      {/if}
    </dl>
  </Section>

  {#if sw.configured}
    <Section id="security-sweep" title="Security sweep" description="Weekly runs of the security sweep, with the outcome of each step. The findings are sealed for the maintainers and not shown here." doc={['runbook', 'the-security-sweep']}>
      {#if !sw.known}
        <EmptyState>Unknown: the security sweep runs could not be read in the last collection.</EmptyState>
      {:else if sw.runs.length}
        <TableRegion label="Security sweep runs">
          <table class="ds-table stacked" data-size="sm">
            <thead>
              <tr>
                <th scope="col">Started</th>
                <th scope="col">Outcome</th>
                {#each SWEEP_PASSES as [key, label] (key)}<th scope="col">{label}</th>{/each}
                <th scope="col" class="n">Cost</th>
                <th scope="col">Log</th>
              </tr>
            </thead>
            <tbody>
              {#each sw.runs.slice(0, 12) as x (x.run_id)}
                <tr>
                  <td class="lead nowrap">{stamp(x.started_at)}</td>
                  <td data-l="Outcome"><StatusTag status={x.state} /></td>
                  {#each SWEEP_PASSES as [key, label] (key)}
                    <td data-l={label}>{#if x.passes?.[key]}<StatusTag status={x.passes[key]} />{:else}–{/if}</td>
                  {/each}
                  <td data-l="Cost" class="n">
                    {usd(x.cost_usd)}
                    {#if x.cost_usd == null && x.state !== 'running'}<span class="sub">No run record</span>{:else if x.cost_usd != null && x.state === 'incomplete'}<span class="sub">May be low</span>{/if}
                  </td>
                  <td data-l="Log"><a class="ds-link" href="https://github.com/{repo}/actions/runs/{x.run_id}">Actions log</a></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </TableRegion>
      {:else}
        <EmptyState>No security sweep has run yet. Each run shows here once it starts.</EmptyState>
      {/if}
    </Section>
  {/if}

  <div class="columns">
    <Section id="checklist" title="This week's checklist" doc={['runbook', 'every-monday']}>
      <TableRegion label="This week's checklist">
        <table class="ds-table" data-size="sm">
          <thead><tr><th scope="col">Item</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {#each m.checklist as c (c.name)}
              <tr><td>{c.name}<span class="sub">{c.text}</span></td><td><StatusTag status={c.status} /></td></tr>
            {/each}
          </tbody>
        </table>
      </TableRegion>
    </Section>
    <Section id="setup" title="Setup" description="Read from change-log entries of kind setup.">
      <TableRegion label="Setup">
        <table class="ds-table" data-size="sm">
          <thead><tr><th scope="col">Item</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {#each m.setup as c (c.name)}
              <tr><td>{c.name}<span class="sub">{c.text}</span></td><td><StatusTag status={c.status} /></td></tr>
            {/each}
          </tbody>
        </table>
      </TableRegion>
    </Section>
  </div>

  <div class="columns">
    <Section id="grading" title="Grading and the pulse survey" doc={['grading', 'who-and-when']}>
      {#if o.grading.length}
        <TableRegion label="Grading by week">
          <table class="ds-table" data-size="sm">
            <thead><tr><th scope="col">Week</th><th scope="col" class="n">Graded</th><th scope="col" class="n">Right and worth fixing</th></tr></thead>
            <tbody>
              {#each o.grading as g (g.week)}<tr><td>Week {g.week}</td><td class="n">{fmt(g.n)}</td><td class="n">{fmt(g.right)}</td></tr>{/each}
            </tbody>
          </table>
        </TableRegion>
        <p class="section-desc">Agreement between the graders: kappa {fmt(data.grading?.agreement, 2)}.</p>
      {:else}
        <p class="section-desc">Starts {weekday(m.T.measureMs)} with the week {config.measureFromWeek} sample. Two graders must be named in the change log before then.</p>
      {/if}
      <p class="section-desc">
        Pulse survey: {#if data.pulse?.length}{#each data.pulse as p, i (p.week)}{i ? '; ' : ''}week {p.week}, {fmt(p.n)} answers, useful {fmt(p.useful, 1)} of 5, noise {fmt(p.noise, 1)} of 5{/each}.{:else}the first round goes out at the end of week 2.{/if}
      </p>
    </Section>
    <Section id="codeql" title="New CodeQL alerts per week" description="What the automated checks find on their own. Important findings fixed before merge are what the checks missed.">
      {#if o.codeqlKnown}
        <Columns
          aria="New CodeQL alerts per week"
          height={140}
          slots={8}
          floor={4}
          rows={o.codeql.slice(-10).map((w) => ({ label: day(w.from), value: w.n, tone: w.base ? 'base' : undefined, tip: `Week of ${day(w.from)}: ${fmt(w.n)} new alerts` }))}
        >
          {#snippet legend()}<span><i class="setup"></i>Baseline weeks</span><span><i></i>Since the review started</span>{/snippet}
        </Columns>
      {:else}
        <EmptyState>Unknown: the repository's review snapshot has not run in the last seven days.</EmptyState>
      {/if}
    </Section>
  </div>

  <div class="columns">
    <Section id="first-review" title="Time to first review" description="Reviewed pull requests by minutes from open to the review posted. Median {minutes(m.firstReview.med)}, slowest tenth {minutes(m.firstReview.p90)}.">
      <HBars aria="Reviewed pull requests by time to first review" rows={r.latency.map((x) => ({ label: x.label, value: x.n, text: fmt(x.n) }))} />
    </Section>
    <Section id="rounds" title="Review rounds per pull request" description="Full reviews per reviewed pull request, counting review again.">
      <HBars aria="Reviewed pull requests by review rounds" rows={r.rounds.map((x) => ({ label: x.label, value: x.n, text: fmt(x.n) }))} />
    </Section>
  </div>

  <Section id="run-details" title="Run details">
    <dl class="facts">
      <dt>Coverage</dt>
      <dd>{fmt(o.coverage.k)} of {fmt(o.coverage.n)} pull requests by people got a run</dd>
      <dt>Review again</dt>
      <dd>{fmt(o.reviewAgain)} extra full reviews</dd>
      <dt>Empty re-reviews</dt>
      <dd>{fmt(o.emptyRereviews)} reviews of a head commit already reviewed</dd>
      <dt>Permission denials</dt>
      <dd>{#if o.denials}{fmt(o.denials.total)} in {fmt(o.denials.runs)} runs, at most {fmt(o.denials.max)} in one{:else}Not recorded yet{/if}</dd>
    </dl>
  </Section>

  <Definitions items={definitions} />
</div>
