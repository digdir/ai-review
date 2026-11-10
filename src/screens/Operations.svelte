<script lang="ts">
  import Columns from '../lib/charts/Columns.svelte';
  import CostMonth from '../lib/charts/CostMonth.svelte';
  import type { Metrics } from '../lib/compute';
  import { docHref } from '../lib/docs';
  import { day, fmt, minutes, nok, pct, stamp, usd, weekday } from '../lib/format';
  import { JOB, QUESTION } from '../lib/labels';
  import type { Data, ExperimentConfig } from '../lib/types';
  import Pill from '../lib/ui/Pill.svelte';
  import Stat from '../lib/ui/Stat.svelte';

  let { data, m, config, collected, ok }: { data: Data; m: Metrics; config: ExperimentConfig; collected: string; ok: boolean } = $props();

  const o = $derived(m.ops);
  const repo = $derived(data.config.repo);
  const since = $derived(weekday(m.T.startMs));
  const month = $derived(new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(m.now));
  const costNote = $derived(
    m.projected == null
      ? `The projection reads from day 5 of the month. Until then, ${nok(m.monthNok)} is what was spent so far.`
      : `Spent so far plus the daily average for the remaining ${fmt(m.daysLeftMonth)} days: ${nok(m.projected)} projected.`,
  );
</script>

<div class="head">
  <h1>Operations</h1>
  <p>For the lab: did collection and the runs work, cost against the budget, this week's checklist, grading and failed runs.</p>
</div>

<section class="panel" id="runs">
  <header><h2>Did it run</h2><span class="meta">Collected {stamp(collected)}</span></header>
  <div class="stats">
    <Stat label="Collection" value={ok ? 'Worked' : 'Failed'} sub="last {stamp(collected)}"
      means="Whether the last read of GitHub, the run records, the CodeQL snapshot and Azure cost worked. The dashboard rebuilds every 20 minutes on weekdays."
      source="data/index.json." doc={['runbook', 'when-the-dashboard-is-stale-or-down']} />
    <Stat label="Runs today" value={fmt(m.board.runsToday)} sub="{fmt(o.reviews)} reviews and {fmt(o.followUps)} follow-ups since {since}"
      means="Runs started today, both jobs and both groups." source="Run records." doc={['working-with-the-review', 'what-happens-to-your-pull-request']} />
    <Stat label="Failed runs" value="{fmt(o.failed.k)} of {fmt(o.failed.n)}" sub="{pct(o.failed.v ?? 0)} since {since}"
      means="Runs that did not complete. A failed review means the pull request got no review; a failed follow-up leaves threads open."
      source="Run records and the Actions log." doc={['runbook', 'when-a-review-fails']} />
    <Stat label="Review time" value={minutes(o.reviewTime.med)} sub="{minutes(o.reviewTime.min)} to {minutes(o.reviewTime.p90)} (slowest tenth)"
      means="How long one review run takes, median. Anthropic reports about 20 minutes on its managed service for large pull requests." source="Run records." doc={['runbook', 'when-a-review-fails']} />
    <Stat label="Empty re-reviews" value={fmt(o.emptyRereviews)} sub="same head commit reviewed again"
      means="Full reviews of a head commit that an earlier review of the same pull request already covered, usually after a label change. Each costs a run and finds nothing new; a workflow guard can skip them."
      source="Run records: pull request and head commit." doc={['runbook', 'when-a-review-fails']} />
    <Stat label="Review again" value={fmt(o.reviewAgain)} sub="extra full reviews"
      means="Reviews started by the label review again. The rule is at most three rounds per pull request."
      source="Run records." doc={['working-with-the-review', 'asking-for-another-review']} />
    <Stat label="Permission denials" value={o.denials ? fmt(o.denials.total) : 'Not recorded yet'}
      sub={o.denials ? `in ${fmt(o.denials.runs)} runs, at most ${fmt(o.denials.max)} in one` : 'the run records do not carry the count yet'}
      means="Times a run was refused a tool call. The review completes, but a denied read means a finding may rest on less than the whole file."
      source="The field permission_denials in the run records, once the review workflow writes it." doc={['runbook', 'when-a-review-fails']} />
    <Stat label="Coverage" value="{fmt(o.coverage.k)} of {fmt(o.coverage.n)}" sub="pull requests by people that got a run"
      means="Pull requests opened since the start, not drafts, that got a review run in either group. A health check, not a goal."
      source="Pull requests and run records." doc={['experiment', 'design']} />
  </div>
  <div class="body topline">
    <h3>Runs per day, last two weeks</h3>
    <Columns aria="Runs per day over the last two weeks, failed runs marked" floor={4}
      rows={o.runsPerDay.map((d) => ({ label: d.date.slice(8), value: d.runs, part: d.failed, tip: `${day(d.date + 'T12:00:00Z')}: ${fmt(d.runs)} runs, ${fmt(d.failed)} failed` }))}>
      {#snippet legend()}<span><i class="key"></i>Runs per day (day of month)</span><span><i class="key bad"></i>Failed</span>{/snippet}
    </Columns>
  </div>
</section>

<section class="panel" id="failed">
  <header><h2>Failed runs</h2><a class="meta" href={docHref('runbook', 'when-a-review-fails')}>When a review fails</a></header>
  {#if o.failedRuns.length}
    <div class="twrap">
      <table class="stack">
        <thead><tr><th>Started</th><th>Pull request</th><th>Job</th><th>Run</th></tr></thead>
        <tbody>
          {#each o.failedRuns.slice(0, 20) as x (x.run_id)}
            <tr>
              <td data-l="Started" class="mono small">{stamp(x.started_at)}</td>
              <td data-l="Pull request">{#if x.pr_number}<a href="https://github.com/{repo}/pull/{x.pr_number}">#{x.pr_number}</a>{:else}–{/if}</td>
              <td data-l="Job">{JOB[x.job ?? 'review']}</td>
              <td data-l="Run"><a href="https://github.com/{repo}/actions/runs/{x.run_id}">Actions log</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty">No failed runs.</p>
  {/if}
</section>

<div class="two">
  <section class="panel" id="cost">
    <header><h2>{QUESTION.cost} {month}</h2><a class="meta" href={docHref('runbook', 'when-the-budget-alerts')}>When the budget alerts</a></header>
    <div class="body stack-gap">
      <div><span class="big num">{nok(m.monthNok)}</span> <span class="muted small">spent, {m.haveAzure ? 'from Azure Cost Management' : `from the run records in USD at ${fmt(config.usdNok, 2)}`}</span></div>
      <CostMonth spent={m.monthNok} projected={m.projected} budget={config.budgetNok} />
      <p class="small muted">{costNote}</p>
      <div class="stats boxed">
        <Stat label="Per reviewed PR" value={nok(o.cost.perPr)} sub="runs {usd(o.cost.run.min)} to {usd(o.cost.run.max)}, median {usd(o.cost.run.med)}"
          means="All review and follow-up runs divided by reviewed pull requests. Anthropic's managed service: USD 15 to 25 per review; GitHub Copilot about USD 0.52."
          source="Run records in USD; Azure as the check." doc={['runbook', 'when-the-budget-alerts']} />
        <Stat label="Per confirmed fix" value={nok(o.cost.perFix)} sub={o.cost.perImportantFix ? `per Important fix ${nok(o.cost.perImportantFix)}` : 'no Important fix yet'}
          means="What one confirmed fix costs: all runs divided by findings answered fixed. Per Important fix is the number a budget owner understands."
          source="Run records and review threads." doc={['runbook', 'when-the-budget-alerts']} />
        <Stat label="Cache hit share" value={pct(o.cost.cacheHit)} sub="of input tokens read from cache"
          means="Share of input tokens served from the prompt cache. The largest controllable cost lever; a drop after a prompt change means the cache was invalidated."
          source="Token counts in the run records." doc={['runbook', 'when-the-budget-alerts']} />
      </div>
    </div>
  </section>

  <section class="panel" id="grading">
    <header><h2>Grading</h2><a class="meta" href={docHref('grading', 'who-and-when')}>How to grade</a></header>
    {#if o.grading.length}
      <ul class="checks">
        {#each o.grading as g (g.week)}
          <li><span class="k">{g.week}</span><span>Week {g.week}<small>{fmt(g.n)} graded, {fmt(g.right)} right and worth fixing</small></span><Pill status="done" /></li>
        {/each}
      </ul>
      <p class="body small muted">Agreement between the graders: kappa {fmt(data.grading?.agreement, 2)}. Under 0.4 means the grades are not reliable yet.</p>
    {:else}
      <p class="body small">Starts {weekday(m.T.measureMs)} with the week {config.measureFromWeek} sample. Two graders must be named in the change log before then.</p>
    {/if}
    <p class="body small muted">
      Pulse survey: {#if data.pulse?.length}{#each data.pulse as p, i (p.week)}{i ? '; ' : ''}week {p.week}, {fmt(p.n)} answers, useful {fmt(p.useful, 1)} of 5, noise {fmt(p.noise, 1)} of 5{/each}.{:else}the first round goes out at the end of week 2.{/if}
    </p>
    <div class="body topline">
      <h3>New CodeQL alerts per week</h3>
      <p class="xs muted chart-note">What the automated checks find on their own. Important findings fixed before merge are the missed-by-the-checks pool.</p>
      {#if o.codeqlKnown}
        <Columns aria="New CodeQL alerts per week" height={120} slots={8} floor={4}
          rows={o.codeql.slice(-10).map((w) => ({ label: day(w.from), value: w.n, tone: w.base ? 'base' : undefined, tip: `Week of ${day(w.from)}: ${fmt(w.n)} new alerts` }))}>
          {#snippet legend()}<span><i class="key setup"></i>Baseline weeks</span><span><i class="key"></i>Since the review started</span>{/snippet}
        </Columns>
      {:else}
        <p class="small muted">Unknown: the repository's review snapshot has not run in the last seven days.</p>
      {/if}
    </div>
  </section>
</div>

<div class="two">
  <section class="panel" id="checklist">
    <header><h2>This week's checklist</h2><a class="meta" href={docHref('runbook', 'every-monday')}>Every Monday</a></header>
    <ul class="checks">
      {#each m.checklist as c, i (c.name)}
        <li><span class="k">{i + 1}</span><span>{c.name}<small>{c.text}</small></span><Pill status={c.status} /></li>
      {/each}
    </ul>
  </section>
  <section class="panel" id="setup">
    <header><h2>Setup</h2><span class="meta">From change-log entries of kind setup</span></header>
    <ul class="checks">
      {#each m.setup as c (c.name)}
        <li><span class="k"></span><span>{c.name}<small>{c.text}</small></span><Pill status={c.status} /></li>
      {/each}
    </ul>
  </section>
</div>
