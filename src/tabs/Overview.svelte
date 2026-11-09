<script lang="ts">
  import type { Metrics } from '../lib/compute';
  import { clock, day, dayClock, fmt, minutes, nok, pct } from '../lib/format';
  import { JOB } from '../lib/labels';
  import type { Data, ExperimentConfig, Status } from '../lib/types';
  import Outcome from '../lib/ui/Outcome.svelte';
  import Stat from '../lib/ui/Stat.svelte';

  let { data, m, config }: { data: Data; m: Metrics; config: ExperimentConfig } = $props();

  const repo = $derived(data.config.repo);
  const imp = $derived(m.important);
  const shown = (r: { n: number; few: boolean }) => r.n > 0 && !r.few;
  const impStatus = $derived<Status>(!shown(imp) ? 'early' : imp.v! >= config.importantMin ? 'ok' : 'bad');
  const dismStatus = $derived<Status>(!shown(m.dismissed) ? 'early' : m.dismissed.v! < config.dismissedMax ? 'ok' : 'bad');
  const latest = $derived([...m.F].sort((a, b) => b.posted.localeCompare(a.posted)).slice(0, 8));
  const runs = $derived(m.runsNewest.slice(0, 8));
  const isThread = (url: string) => url.startsWith('https://github.com/');
</script>

<div class="stats" aria-label="Key numbers">
  <Stat
    label="Important fix rate"
    value={shown(imp) ? pct(imp.v) : imp.n ? 'Too few' : '–'}
    status={impStatus}
    help="Important findings on merged pull requests that the follow-up confirmed fixed. Humans reach 44 to 60% in published studies."
  >
    target ≥ {pct(config.importantMin)} · {fmt(imp.k)} of {fmt(imp.n)}
  </Stat>
  <Stat
    label="Dismissed"
    value={shown(m.dismissed) ? pct(m.dismissed.v) : m.dismissed.n ? 'Too few' : '–'}
    status={dismStatus}
    help="Findings the author replied will not be fixed. The main sign of noise."
  >
    limit {pct(config.dismissedMax)} · {fmt(m.dismissed.k)} of {fmt(m.dismissed.n)}
  </Stat>
  <Stat
    label="Time to first review"
    value={minutes(m.firstReview.med)}
    help="From a pull request is opened until the first review is posted. Median, with the slowest 10% after it."
  >
    p90 {minutes(m.firstReview.p90)} · {fmt(m.firstReview.n)} PRs
  </Stat>
  <Stat
    label="Cost per fixed finding"
    value={nok(m.costPerFix)}
    help="All review and follow-up runs, divided by findings confirmed fixed. Shadow runs are left out."
  >
    {nok(m.totalCost)} for {fmt(m.fixedN)} fixes
  </Stat>
  <Stat
    label="Merged with open Important"
    value={fmt(m.unresolvedImportant.length)}
    status={m.unresolvedImportant.length ? 'wait' : 'ok'}
    help="Merged pull requests with an Important finding nobody fixed or dismissed. Worth a look."
  >
    {m.unresolvedImportant.length ? 'see Findings' : 'none'}
  </Stat>
  <Stat label="Runs today" value={fmt(m.runsToday)} status={m.lastRun?.completed === false ? 'bad' : m.lastRun ? 'ok' : null} help="Review and follow-up runs started today.">
    {fmt(m.failedRuns)} failed in total{m.lastRun ? ` · last ${clock(m.lastRun.started_at)}` : ''}
  </Stat>
</div>

{#if m.unresolvedImportant.length}
  <div class="callout" role="note">
    <h2>Merged with an Important finding still open</h2>
    <ul>
      {#each m.unresolvedImportant.slice(0, 5) as u (u.pr)}
        <li><a href={isThread(u.url) ? u.url : `https://github.com/${repo}/pull/${u.pr}`}>#{u.pr} {u.title}</a></li>
      {/each}
    </ul>
  </div>
{/if}

<div class="grid grid-2">
  <div class="ds-card panel" data-color="neutral">
    <div class="panel-head"><span>Latest findings</span><a class="meta" href="#/{repo}/findings">all {fmt(m.F.length)} →</a></div>
    <ul class="rows">
      {#each latest as f, i (i)}
        <li>
          <div class="line1">
            <span class="sev sev-{f.severity}">{f.severity}</span>
            <span class="pr">#{f.pr}</span>
            <a class="title" href={isThread(f.url) ? f.url : undefined}>{f.prTitle}</a>
          </div>
          <div class="line2">
            <span class="path" title={f.path}>{f.path}</span>
            <span class="right"><Outcome outcome={f.outcome} shadow={f.arm === 'shadow'} /> · {dayClock(f.posted)}</span>
          </div>
        </li>
      {:else}
        <li class="empty">No findings yet.</li>
      {/each}
    </ul>
  </div>
  <div class="ds-card panel" data-color="neutral">
    <div class="panel-head"><span><i class="led live"></i>Latest runs</span><a class="meta" href="#/{repo}/runs">all {fmt(m.runsNewest.length)} →</a></div>
    <ul class="rows">
      {#each runs as r (r.run_id)}
        <li>
          <div class="line1">
            <span class="sev {r.completed === false ? 'sev-Important' : 'sev-Nit'}">{r.completed === false ? 'Failed' : JOB[r.job ?? 'review']}</span>
            <span class="pr">#{r.pr_number ?? '?'}</span>
            <a class="title" href="https://github.com/{repo}/actions/runs/{r.run_id}">{data.prs.find((p) => p.n === r.pr_number)?.title ?? 'Run ' + r.run_id}</a>
          </div>
          <div class="line2">
            <span>{dayClock(r.started_at)}</span>
            <span>{r.duration_s != null ? minutes(r.duration_s / 60) : '–'}</span>
            {#if r.findings != null}<span>{fmt(r.findings)} findings</span>{/if}
            {#if r.arm === 'shadow'}<span>shadow</span>{/if}
            <span class="right">{r.cost_usd != null ? nok(r.cost_usd * config.usdNok, 1) : '–'}</span>
          </div>
        </li>
      {:else}
        <li class="empty">No runs yet.</li>
      {/each}
    </ul>
  </div>
</div>

<div class="ds-card panel" data-color="neutral">
  <div class="panel-head"><span>From pull request to fix</span><span class="meta">since {day(data.config.start + 'T12:00:00Z')}</span></div>
  <ol class="chain">
    <li><span class="st">Opened</span><b>{fmt(m.createdSince)}</b><small>{fmt(m.botsSince)} from bots, left out</small></li>
    <li><span class="st">Reviewed</span><b>{fmt(m.reviewedCount)}</b><small>{pct(m.createdSince ? m.reviewedCount / m.createdSince : null)} coverage</small></li>
    <li class={{ bad: m.subagentsMedian === 0 }}>
      <span class="st">Finders</span><b>{m.subagentsMedian == null ? '–' : `${fmt(m.subagentsMedian)}/5`}</b><small
        >{m.subagentsMedian ? 'median per review' : 'not running yet'}</small
      >
    </li>
    <li><span class="st">Findings</span><b>{fmt(m.posted.length)}</b><small>{fmt(m.posted.filter((f) => f.severity === 'Important').length)} Important</small></li>
    <li><span class="st">Follow-ups</span><b>{fmt(m.followUps)}</b><small>checks on each push</small></li>
    <li><span class="st">Fixed</span><b>{fmt(m.fixedN)}</b><small>{fmt(m.dismissedN)} dismissed</small></li>
  </ol>
</div>
