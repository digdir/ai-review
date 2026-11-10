<script lang="ts">
  import type { Metrics } from '../compute';
  import { fmt, hours, nok, pct, plural, stamp, weekday } from '../format';
  import { DECISION } from '../labels';
  import type { ExperimentConfig } from '../types';
  import { afterKey, toggled } from './board';
  import ExplainBody from './ExplainBody.svelte';
  import Tile from './Tile.svelte';

  let { m, config, collected, ok, initialOpen = null }: { m: Metrics; config: ExperimentConfig; collected: string; ok: boolean; initialOpen?: string | null } = $props();

  // svelte-ignore state_referenced_locally
  let open = $state<string | null>(initialOpen);
  const panelId = $props.id();
  let panel = $state<HTMLElement>();

  const days = $derived(config.weeks * 7);
  const b = $derived(m.board);
  const phaseSub = $derived(
    m.phase === 'setup'
      ? `Setup, week ${m.week} of ${config.weeks}. Counts from ${weekday(m.T.measureMs)}`
      : m.phase === 'measuring'
        ? `Measuring, week ${m.week} of ${config.weeks}. Decision in the week of ${weekday(m.T.decisionMs)}`
        : m.decided
          ? `Decided ${weekday(m.decided.date + 'T12:00:00Z')}: ${DECISION[m.decided.outcome!]}. Criteria stay on as health`
          : 'The six weeks are over. The decision is not logged yet',
  );
  const trust = $derived(m.phase === 'setup' ? { v: fmt(7), u: 'too early', s: `Nothing is counted before ${weekday(m.T.measureMs)}` } : { v: fmt(m.counts.met), u: `of ${m.criteria.length} met`, s: `${fmt(m.counts.notmet)} not met, ${fmt(m.counts.early)} too early` });

  const explanations: Record<string, { means: string; source: string; doc: [string, string] }> = {
    Phase: { means: 'Where the experiment is on its calendar. Day 1 is the start; measurement starts in week 3; the decision is made after the last day.', source: "The repository's settings file in repos/: start, experiment.weeks and measureFromWeek.", doc: ['experiment', 'dates'] },
    'Trust earned': { means: 'How the seven criteria stand. Too early means the read-when rule is not reached yet, not a problem.', source: 'src/lib/compute.ts, over the decision period, or the last four weeks after the decision.', doc: ['experiment', 'measures-and-thresholds'] },
    'Runs today': { means: 'Review and follow-up runs started today, both groups, and how many did not complete.', source: 'Run records uploaded by the review workflow in the repository.', doc: ['runbook', 'when-a-review-fails'] },
    'Cost sane': { means: 'Azure cost of the review this month against the budget, projected from the daily average. The budget alerts at 80 and 100 percent.', source: 'Azure Cost Management, about a day behind; the run records until it arrives.', doc: ['runbook', 'when-the-budget-alerts'] },
    'Waiting on authors': { means: 'Review threads on open pull requests with no reply from the author yet. Every thread needs an answer before merge.', source: 'Review threads in GitHub.', doc: ['working-with-the-review', 'answering-findings'] },
    'In the queue': { means: 'Open pull requests by people that have had their review and are waiting on CI, answers or the merge queue.', source: 'Pull requests from GitHub, joined with the run records.', doc: ['working-with-the-review', 'what-happens-to-your-pull-request'] },
    Collected: { means: 'When the dashboard last read GitHub, the run records and Azure. It rebuilds every 20 minutes on weekdays and every hour otherwise.', source: 'data/index.json from dashboard/collect.mjs.', doc: ['runbook', 'when-the-dashboard-is-stale-or-down'] },
  };

  function select(label: string) {
    open = toggled(open, label);
    if (open) queueMicrotask(() => panel?.scrollIntoView?.({ block: 'nearest' }));
  }
  const shown = $derived(open ? explanations[open] : null);
</script>

<svelte:window onkeydown={(e) => (open = afterKey(open, e.key))} />

<div class="board-wrap">
<section class="board" aria-label="Status board">
  <Tile
    label="Phase"
    value={m.phase === 'after' ? `Day ${fmt(m.T.day)}` : `Day ${fmt(m.T.day)} of ${fmt(days)}`}
    unit={m.phase === 'after' ? 'after' : undefined}
    sub={phaseSub}
    tone="on"
    open={open === 'Phase'}
    {panelId}
    ontoggle={() => select('Phase')}
  />
  <Tile
    label="Trust earned"
    value={trust.v}
    unit={trust.u}
    sub={trust.s}
    tone={m.phase === 'setup' ? 'plain' : m.counts.notmet ? 'watch' : 'on'}
    open={open === 'Trust earned'}
    {panelId}
    ontoggle={() => select('Trust earned')}
  />
  <Tile
    label="Runs today"
    value={fmt(b.runsToday)}
    unit={b.failedToday ? `${fmt(b.failedToday)} failed` : 'none failed'}
    sub="{fmt(b.runsYesterday)} yesterday, {fmt(b.failedTotal)} failed since the start"
    tone={b.failedToday ? 'watch' : 'on'}
    open={open === 'Runs today'}
    {panelId}
    ontoggle={() => select('Runs today')}
  />
  <Tile
    label="Cost sane"
    value={m.projected != null ? pct(m.projected / config.budgetNok) : nok(m.monthNok)}
    unit={m.projected != null ? 'of budget' : 'spent'}
    sub={m.projected != null
      ? `${nok(m.monthNok)} spent, ${nok(m.projected)} projected, ${plural(m.daysLeftMonth, 'day')} left`
      : `Projection from day 5. ${plural(m.daysLeftMonth, 'day')} left in the month`}
    tone={m.projected != null && m.projected > config.budgetNok * 0.8 ? 'watch' : 'on'}
    open={open === 'Cost sane'}
    {panelId}
    ontoggle={() => select('Cost sane')}
  />
  <Tile
    label="Waiting on authors"
    value={fmt(b.waiting.threads)}
    unit={b.waiting.threads === 1 ? 'thread' : 'threads'}
    sub={b.waiting.threads ? `on ${plural(b.waiting.prs, 'pull request')}, oldest ${hours(b.waiting.oldestHours)}` : 'every thread answered'}
    tone={b.waiting.threads ? 'watch' : 'on'}
    open={open === 'Waiting on authors'}
    {panelId}
    ontoggle={() => select('Waiting on authors')}
  />
  <Tile
    label="In the queue"
    value={fmt(b.queue.n)}
    unit="pull requests"
    sub={b.queue.queued ? `${fmt(b.queue.queued)} in the merge queue` : 'open, reviewed, not merged'}
    open={open === 'In the queue'}
    {panelId}
    ontoggle={() => select('In the queue')}
  />
  <Tile
    label="Collected"
    value={stamp(collected)}
    mono
    sub={ok ? 'last collection worked' : 'last collection failed'}
    tone={ok ? 'on' : 'off'}
    open={open === 'Collected'}
    {panelId}
    ontoggle={() => select('Collected')}
  />
</section>
<div class="explain board-explain" id={panelId} role="region" aria-label={open ? `${open} explained` : undefined} bind:this={panel} hidden={!shown}>
  {#if shown}<ExplainBody means={shown.means} source={shown.source} doc={shown.doc} />{/if}
</div>
</div>
