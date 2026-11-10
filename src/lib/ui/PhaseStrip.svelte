<script lang="ts">
  import type { Metrics } from '../compute';
  import { day, weekday } from '../format';
  import { DECISION } from '../labels';
  import { docHref } from '../docs';
  import { DAY, WEEK } from '../stats';
  import type { Data, ExperimentConfig } from '../types';

  let { m, data, config }: { m: Metrics; data: Data; config: ExperimentConfig } = $props();

  const weeks = $derived(
    Array.from({ length: config.weeks }, (_, i) => {
      const n = i + 1;
      const from = m.T.startMs + i * WEEK;
      const setup = n < config.measureFromWeek;
      const cls = m.phase === 'after' || n < m.week ? (setup ? 'setup done' : 'done') : n === m.week ? 'now' : setup ? 'setup' : '';
      return { n, cls, label: setup ? 'Setup' : `Week ${n}`, dates: `${day(from)} to ${day(from + WEEK - DAY)}` };
    }),
  );
  const headline = $derived(
    m.phase === 'setup'
      ? `Week ${m.week} of ${config.weeks}, setup.`
      : m.phase === 'measuring'
        ? `Week ${m.week} of ${config.weeks}, measuring.`
        : m.decided
          ? `After the experiment. Decided ${day(m.decided.date + 'T12:00:00Z')}: ${DECISION[m.decided.outcome!]}.`
          : 'After the experiment. The decision is not logged yet.',
  );
  const text = $derived(
    m.phase === 'setup'
      ? `Weeks 1 to ${config.measureFromWeek - 1} tighten the rules and do not count. Measurement starts ${weekday(m.T.measureMs)}; the decision is made in the week of ${weekday(m.T.decisionMs)}.`
      : m.phase === 'measuring'
        ? `Weeks ${config.measureFromWeek} to ${config.weeks} count. Grading runs each Monday; the decision is made in the week of ${weekday(m.T.decisionMs)}. Rework for the last week is read two weeks later.`
        : m.decided
          ? 'The review keeps running. The seven criteria stay on as health, read over the last four weeks.'
          : `The criteria below read weeks ${config.measureFromWeek} to ${config.weeks}, the decision period, until the decision is logged.`,
  );
</script>

<section class="panel" id="phase">
  <div class="body phase">
    <p class="line"><b>{headline}</b> {text}</p>
    <ol class="weeks" aria-label="The six weeks">
      {#each weeks as w (w.n)}
        <li class={w.cls} aria-current={w.n === m.week ? 'step' : undefined}><span>{w.label}</span><small>{w.dates}</small></li>
      {/each}
      {#if m.phase === 'after' && m.decided}
        <li class="decision now"><span>{DECISION[m.decided.outcome!]}</span><small>{day(m.decided.date + 'T12:00:00Z')}</small></li>
      {:else}
        <li class="decision"><span>Decision</span><small>week of {day(m.T.decisionMs)}</small></li>
      {/if}
    </ol>
    <p class="small muted">
      Today {weekday(m.now)}. Baseline from {day(data.config.baselineFrom + 'T12:00:00Z')}. <a href={docHref('experiment', 'dates')}>Dates in the protocol</a>.
    </p>
  </div>
</section>
