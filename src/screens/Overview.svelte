<script lang="ts">
  import type { Metrics } from '../lib/compute';
  import { docHref } from '../lib/docs';
  import { day, weekday } from '../lib/format';
  import { DECISION, PURPOSE, RULE } from '../lib/labels';
  import type { Data, ExperimentConfig } from '../lib/types';
  import Board from '../lib/ui/Board.svelte';
  import Compare from '../lib/ui/Compare.svelte';
  import Criteria from '../lib/ui/Criteria.svelte';
  import Feed from '../lib/ui/Feed.svelte';
  import PhaseStrip from '../lib/ui/PhaseStrip.svelte';
  import StartHere from '../lib/ui/StartHere.svelte';

  let {
    data,
    m,
    config,
    collected,
    ok,
    showStart,
    ondismiss,
  }: { data: Data; m: Metrics; config: ExperimentConfig; collected: string; ok: boolean; showStart: boolean; ondismiss: () => void } = $props();

  const repo = $derived(data.config.repo);
  const gh = $derived(`https://github.com/${repo}`);
  const changes = $derived([...m.changes].reverse());
  const dates = $derived({ start: weekday(m.T.startMs), measure: weekday(m.T.measureMs), decision: weekday(m.T.decisionMs) });
  const sub: [string, string][] = [
    ['phase', 'Phase'],
    ['criteria', 'Criteria'],
    ['rule', 'Rule'],
    ['checkout', 'Check out'],
    ['compare', 'Compare'],
    ['changes', 'Changes'],
    ['todo', 'What to do'],
  ];
  const lab = $derived(
    m.phase === 'setup'
      ? `Name the two graders before ${dates.measure} and confirm privacy.`
      : m.phase === 'measuring'
        ? 'Draw the grading sample on Monday and merge the grades when both have graded.'
        : 'Watch the criteria as health; prepare the next repository.',
  );
  const approver = $derived(
    m.phase === 'setup'
      ? `Nothing before ${dates.measure}. The setup weeks are reported, not counted.`
      : m.phase === 'measuring'
        ? 'Read the criteria above and the outcome the rule would give today.'
        : m.decided
          ? 'The decision is made. Watch the criteria as health; a miss goes to the lab, not to a new decision.'
          : 'Make the decision and log it in the change log.',
  );
</script>

<div class="head">
  <h1>{repo}, the review experiment</h1>
  <p>{PURPOSE} The seven criteria measure whether that trust is earned.</p>
</div>

{#if showStart}<StartHere {dates} {ondismiss} />{/if}

<Board {m} {config} {collected} {ok} />

<nav class="subnav" aria-label="On this page">
  {#each sub as [a, label] (a)}<a href="#/{repo}/overview#{a}">{label}</a>{/each}
</nav>

<PhaseStrip {m} {data} {config} />
<Criteria {m} />

<div class="two">
  <section class="panel" id="rule">
    <header><h2>What the decision rule says</h2><a class="meta" href={docHref('experiment', 'measures-and-thresholds')}>The rule in the protocol</a></header>
    <div class="body stack-gap">
      {#if m.rule}
        <div class="callout">
          <b>{m.phase === 'after' ? 'Week 6 has ended. The rule gives' : 'If week 6 ended today'}: {DECISION[m.rule.outcome]}.</b>
          {m.rule.text}
        </div>
      {:else if m.decided}
        <div class="callout">
          <b>Decided {day(m.decided.date + 'T12:00:00Z')}: {DECISION[m.decided.outcome!]}.</b>
          {m.decided.note} The rule below no longer applies; a criterion outside its threshold now goes to the lab's Monday checklist.
        </div>
      {:else}
        <div class="callout">
          Nothing is decided in the setup weeks. From {dates.measure} each criterion reads Met, Not met or Too early, and this card says which outcome the
          rule would give.
        </div>
      {/if}
      <ol class="plain-list">
        {#each RULE as [k, v] (k)}<li><b>{DECISION[k]}:</b> {v}</li>{/each}
      </ol>
    </div>
  </section>

  <section class="panel" id="changes">
    <header><h2>What has changed</h2><a class="meta" href={docHref('experiment', 'the-change-log')}>How changes are logged</a></header>
    {#if changes.length}
      <ul class="rows">
        {#each changes as c, i (i)}
          <li>
            <span class="t">
              <span class="pr">{day(c.date + 'T12:00:00Z')}</span>
              <span class="tag">{c.kind}</span>
              {#if c.ref}<a href="https://github.com/{c.ref.replace('#', '/pull/')}">{c.ref.replace(/^.*#/, '#')}</a>{/if}
              <span>{c.note}</span>
            </span>
            {#if c.because}<span class="s because">Because: {c.because}</span>{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No changes logged yet.</p>
    {/if}
  </section>
</div>

<Feed items={m.checkout} />
<Compare ours={m.ours} />

<section id="todo">
  <div class="head todo-head"><h2>What to do</h2></div>
  <div class="three">
    <div class="panel">
      <header><h3>If your pull request was reviewed</h3></header>
      <div class="body todo-body">
        <ol>
          <li>Answer every thread before you merge: fix and push, or reply "not fixing, because ...".</li>
          <li>Add the label <code>review again</code> for one more full review after a large rework. At most three rounds.</li>
          <li>If a merged change had a bug the review could have seen, label the fix <code>escaped</code>.</li>
        </ol>
        <p class="small"><a href="#/{repo}/repository">Your pull requests</a> or <a href={docHref('working-with-the-review', 'answering-findings')}>the full guide</a>.</p>
      </div>
    </div>
    <div class="panel">
      <header><h3>If you run the experiment</h3></header>
      <div class="body todo-body">
        <ol>
          <li>Work through this week's checklist in the Monday issue.</li>
          <li>{lab}</li>
          <li>Check failed runs and the cost projection.</li>
        </ol>
        <p class="small"><a href="#/{repo}/operations">Operations</a> or <a href={docHref('runbook', 'every-monday')}>the runbook</a>.</p>
      </div>
    </div>
    <div class="panel">
      <header><h3>If you decide</h3></header>
      <div class="body todo-body">
        <ol>
          <li>{approver}</li>
          <li>The decision meeting is in the week of {dates.decision}; rework for the last week is read two weeks later.</li>
          <li>A protocol change is only allowed to correct an error, and is logged with the reason.</li>
        </ol>
        <p class="small"><a href="#/{repo}/overview#rule">The decision rule</a> or <a href="#/{repo}/overview#compare">how we compare</a>.</p>
      </div>
    </div>
  </div>
</section>

<p class="small muted"><a href="{gh}/pulls">Pull requests on GitHub</a> · <a href="{gh}/actions">Actions</a></p>
