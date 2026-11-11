<script lang="ts">
  import Trend from '../lib/charts/Trend.svelte';
  import type { Metrics } from '../lib/compute';
  import { docHref } from '../lib/docs';
  import { day, fmt, nok, pct, weekday } from '../lib/format';
  import { CRITERIA, DECISION, RULE } from '../lib/labels';
  import type { Data, ExperimentConfig } from '../lib/types';
  import Compare from '../lib/ui/Compare.svelte';
  import Definitions, { type Definition } from '../lib/ui/Definitions.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Section from '../lib/ui/Section.svelte';
  import Stats from '../lib/ui/Stats.svelte';
  import StatusTag from '../lib/ui/StatusTag.svelte';
  import TableRegion from '../lib/ui/TableRegion.svelte';

  let { data, m, config }: { data: Data; m: Metrics; config: ExperimentConfig } = $props();

  let allChanges = $state(false);
  const repo = $derived(data.config.repo);
  const measure = $derived(weekday(m.T.measureMs));
  const decision = $derived(weekday(m.T.decisionMs));
  const n = $derived(m.criteria.length);
  const counts = $derived(`${fmt(m.counts.met)} of ${fmt(n)} criteria met, ${fmt(m.counts.notmet)} not met, ${fmt(m.counts.early)} too early.`);
  const verdict = $derived(
    m.phase === 'setup'
      ? { lead: 'Too early to say.', rest: `Nothing is decided in the setup weeks. The criteria count from ${measure}, and the decision is made in the week of ${decision}.` }
      : m.phase === 'measuring'
        ? {
            lead: m.counts.met === n ? 'So far, yes.' : 'Not yet.',
            rest: `${counts}${m.rule ? ` If week ${config.weeks} ended today: ${DECISION[m.rule.outcome]}. ${m.rule.text}` : ''}`,
          }
        : m.decided
          ? { lead: `Decided ${day(m.decided.date + 'T12:00:00Z')}: ${DECISION[m.decided.outcome!]}.`, rest: `${m.decided.note} Over the last four weeks, ${counts.charAt(0).toLowerCase()}${counts.slice(1)}` }
          : { lead: `The ${config.weeks} weeks are over and the decision is not logged yet.`, rest: `${counts}${m.rule ? ` The rule gives ${DECISION[m.rule.outcome]}. ${m.rule.text}` : ''}` },
  );
  const phase = $derived(
    m.phase === 'setup'
      ? { value: `Week ${m.week} of ${config.weeks}`, context: `Setup, not counted. Measured from ${measure}` }
      : m.phase === 'measuring'
        ? { value: `Week ${m.week} of ${config.weeks}`, context: `Measuring. Decision in the week of ${decision}` }
        : { value: 'After the experiment', context: m.decided ? `Decided ${day(m.decided.date + 'T12:00:00Z')}` : 'Decision not logged yet' },
  );
  const period = $derived(
    m.phase === 'setup' ? `Counted from ${measure}, weeks ${config.measureFromWeek} to ${config.weeks}.` : m.health ? 'The last four weeks, as ongoing health.' : `Weeks ${config.measureFromWeek} to ${config.weeks}${m.phase === 'measuring' ? ' so far' : ''}.`,
  );
  const groups = $derived.by(() => {
    const out: { question: string; items: { def: (typeof CRITERIA)[number]; c: Metrics['criteria'][number] }[] }[] = [];
    for (const def of CRITERIA) {
      if (def.question || !out.length) out.push({ question: def.question ?? '', items: [] });
      out[out.length - 1].items.push({ def, c: m.criteria.find((x) => x.key === def.key)! });
    }
    return out;
  });
  const weeks = $derived(m.repo.perWeek);
  const one = $derived(weeks.find((w) => w.posted));
  const changes = $derived([...m.changes].reverse());
  const definitions: Definition[] = [
    {
      term: 'Phase',
      means: 'Where the experiment is on its calendar. The first weeks tighten the rules and do not count; the measured weeks decide; after the decision the criteria stay on as health.',
      source: "The repository's settings file in repos/: start, experiment.weeks and measureFromWeek.",
      doc: ['experiment', 'dates'],
    },
    {
      term: 'Findings acted on',
      means: 'Posted findings the author answered as fixed and the follow-up run confirmed, all severities and all weeks, so it matches the published rates. The criterion counts Important findings only.',
      source: 'Review threads in GitHub, joined with the follow-up run records.',
      doc: ['experiment', 'measures-and-thresholds'],
    },
    {
      term: 'Fixed and dismissed by week',
      means: 'Of the findings posted in a week, the share answered as fixed and the share answered as not fixed. Findings from the latest week are still being answered, so its shares rise over the following days.',
      source: 'Review threads in GitHub.',
      doc: ['working-with-the-review', 'answering-findings'],
    },
    ...CRITERIA.map((c) => ({ term: c.name, means: c.means, source: c.source, doc: c.doc })),
  ];
</script>

<div class="page">
  <PageHeader context={repo} title="Can we trust the AI review yet?">
    Seven criteria with fixed thresholds decide whether the review keeps running. New here? <a class="ds-link" href="#/start">Start here</a>.
  </PageHeader>

  <p class="answer" id="answer"><b>{verdict.lead}</b> {verdict.rest}</p>

  <Stats
    label="Key figures"
    items={[
      { label: 'Phase', ...phase },
      m.phase === 'setup'
        ? { label: 'Criteria', value: 'Too early', context: `Read from ${measure}` }
        : { label: 'Criteria met', value: `${fmt(m.counts.met)} of ${fmt(n)}`, context: `${fmt(m.counts.notmet)} not met, ${fmt(m.counts.early)} too early` },
      { label: 'Findings acted on', value: m.repo.allFix.n ? pct(m.repo.allFix.v) : '–', context: `${fmt(m.repo.allFix.k)} of ${fmt(m.repo.allFix.n)} posted, all weeks` },
      {
        label: 'Cost this month',
        value: m.projected != null ? nok(m.projected) : nok(m.monthNok),
        context: m.projected != null ? `Projected, ${pct(m.projected / config.budgetNok)} of the ${nok(config.budgetNok)} budget` : `Spent so far. Projected from day 5`,
      },
    ]}
  />

  <Section
    id="trend"
    title="Fixed and dismissed findings by week"
    description="Share of each week's posted findings that authors fixed or dismissed. The protocol wants dismissed under 50%; a falling dismissed line means the rules are getting sharper."
    doc={['experiment', 'measures-and-thresholds']}
  >
    {#if weeks.filter((w) => w.posted).length >= 2}
      <Trend
        aria="Fixed and dismissed share of posted findings by week. {weeks.map((w) => `Week ${w.week}: ${w.posted ? `${pct(w.fixed.v)} fixed, ${pct(w.dismissed.v)} dismissed of ${w.posted}` : 'no findings'}`).join('. ')}."
        labels={weeks.map((w) => `Week ${w.week}`)}
        shaded={weeks.map((w) => w.setup)}
        series={[
          { name: 'Fixed', tone: 'a', values: weeks.map((w) => (w.posted ? w.fixed.v : null)) },
          { name: 'Dismissed', tone: 'b', values: weeks.map((w) => (w.posted ? w.dismissed.v : null)) },
        ]}
        reference={{ value: 0.5, label: 'Dismissed limit, 50%' }}
      />
    {:else}
      <EmptyState>
        {#if one}Week {one.week} so far: {pct(one.fixed.v)} of {fmt(one.posted)} posted findings fixed, {pct(one.dismissed.v)} dismissed. The trend appears from the second week.{:else}No findings posted yet. The trend appears from the second week of reviews.{/if}
      </EmptyState>
    {/if}
  </Section>

  <Section id="criteria" title="The seven criteria" description="{period} Too early means the read-when rule is not reached yet, not a problem." doc={['experiment', 'measures-and-thresholds']}>
    <TableRegion label="The seven criteria">
      <table class="ds-table stacked" data-size="sm">
        <thead>
          <tr><th scope="col">Criterion</th><th scope="col">Threshold</th><th scope="col">Now</th><th scope="col">Read when</th><th scope="col">Status</th></tr>
        </thead>
        {#each groups as g (g.question)}
          <tbody>
            <tr class="group-row"><th colspan="5" scope="colgroup">{g.question}</th></tr>
            {#each g.items as { def, c } (def.key)}
              <tr>
                <td class="lead">{def.name}</td>
                <td data-l="Threshold">{def.rule}</td>
                <td data-l="Now"><span class={{ subtle: c.status === 'early' }}>{c.text}</span><span class="sub">{c.sub}</span></td>
                <td data-l="Read when">{def.read}</td>
                <td data-l="Status">{#if m.phase === 'setup'}<StatusTag status="early" />{:else}<StatusTag status={c.status} />{/if}</td>
              </tr>
            {/each}
          </tbody>
        {/each}
      </table>
    </TableRegion>
  </Section>

  <div class="columns">
    <Section id="rule" title="How the decision is made" doc={['experiment', 'measures-and-thresholds']}>
      <dl class="facts">
        {#each RULE as [k, v] (k)}<dt>{DECISION[k]}</dt><dd>{v.charAt(0).toUpperCase() + v.slice(1)}</dd>{/each}
      </dl>
    </Section>

    <Section id="checkout" title="Worth a look" description="Picked by fixed rules from the data. Titles only; the text stays in GitHub.">
      {#if m.checkout.length}
        <ul class="row-list">
          {#each m.checkout as x (x.kind)}
            <li>
              <span class="what">
                <span class="sub">{x.kind}</span>
                {#if x.url}<a class="ds-link" href={x.url}>{x.title}</a>{:else}{x.title}{/if}
                <span class="sub">{x.meta.join('. ')}{#if x.pr}. #{x.pr}{/if}</span>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <EmptyState>Nothing yet. Items appear as findings, changes and runs come in.</EmptyState>
      {/if}
    </Section>
  </div>

  <Section id="changes" title="What has changed" description="Rule, model and workflow changes, so a shift in the numbers can be traced to its cause." doc={['experiment', 'the-change-log']}>
    {#if changes.length}
      <ul class="row-list">
        {#each changes.slice(0, allChanges ? changes.length : 8) as c, i (i)}
          <li>
            <span class="when">{day(c.date + 'T12:00:00Z')}</span>
            <span class="what">
              {c.note}
              {#if c.ref}<a class="ds-link" href="https://github.com/{c.ref.replace('#', '/pull/')}">{c.ref.replace(/^.*#/, '#')}</a>{/if}
              <span class="sub">{c.kind.charAt(0).toUpperCase() + c.kind.slice(1)}{#if c.because}. Because: {c.because}{/if}</span>
            </span>
          </li>
        {/each}
      </ul>
      {#if changes.length > 8 && !allChanges}
        <p class="more">Showing the newest 8 of {fmt(changes.length)}. <button type="button" class="ds-button" data-variant="tertiary" data-size="sm" onclick={() => (allChanges = true)}>Show all</button></p>
      {/if}
    {:else}
      <EmptyState>No changes logged yet.</EmptyState>
    {/if}
  </Section>

  <Compare ours={m.ours} />
  <Definitions items={definitions} />
  <p class="more"><a class="ds-link" href={docHref('working-with-the-review', 'answering-findings')}>What to do when the review comments</a><a class="ds-link" href="https://github.com/{repo}/pulls">Pull requests on GitHub</a></p>
</div>
