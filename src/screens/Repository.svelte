<script lang="ts">
  import Columns from '../lib/charts/Columns.svelte';
  import HBars from '../lib/charts/HBars.svelte';
  import type { Metrics } from '../lib/compute';
  import { docHref } from '../lib/docs';
  import { fmt, hours, minutes, pct, weekday } from '../lib/format';
  import { QUESTION } from '../lib/labels';
  import type { Rate } from '../lib/stats';
  import type { Data } from '../lib/types';
  import Explain from '../lib/ui/Explain.svelte';
  import Stat from '../lib/ui/Stat.svelte';

  let {
    data,
    m,
    author,
    username,
    onusername,
  }: { data: Data; m: Metrics; author: string | null; username: string; onusername: (v: string) => void } = $props();

  let number = $state('');
  let all = $state(false);
  const repo = $derived(data.config.repo);
  const r = $derived(m.repo);
  const since = $derived(weekday(m.T.startMs));
  const wanted = $derived(number.replace('#', '').trim());
  const prs = $derived(r.prs.filter((p) => (!author || p.author === author) && (!wanted || String(p.n).includes(wanted))));
  const limit = $derived(all || author || wanted ? prs.length : 15);
  const share = (x: Rate, min = 1) => (x.n >= min ? pct(x.v) : 'Too few');
  const two = (v: readonly [number | null, number | null], f: (x: number | null) => string) => [f(v[0]), f(v[1])];
</script>

<div class="head">
  <h1>{repo}</h1>
  <p>What the review found on the pull requests, what an author is expected to do, and how the review is doing on this repository since {since}.</p>
</div>

<section class="panel" id="pull-requests">
  <header>
    <h2>Pull requests since {since}</h2>
    <div class="filters">
      <label class="small muted" for="username">Your GitHub username</label>
      <input id="username" type="search" placeholder="username" autocomplete="off" spellcheck="false" value={username}
        oninput={(e) => onusername(e.currentTarget.value)} />
      <label class="small muted" for="pr-number">or number</label>
      <input id="pr-number" class="narrow" type="search" placeholder="#512" inputmode="numeric" bind:value={number} />
    </div>
  </header>
  <p class="body small muted note-line">
    {fmt(r.opened)} opened by people, {fmt(r.reviewed)} in the reviewed group, {fmt(r.silent)} in the silent group, {fmt(r.bots)} from bots left out.
    {#if author}Showing the pull requests by that username, matched by a hash in the browser. {/if}
    <a href={docHref('working-with-the-review', 'what-happens-to-your-pull-request')}>Why some pull requests get no comments</a>.
  </p>
  <ul class="rows">
    {#each prs.slice(0, limit) as p (p.n)}
      <li>
        <span class="t">
          <span class="pr">#{p.n}</span>
          <a href="https://github.com/{repo}/pull/{p.n}">{p.title}</a>
          {#if p.escaped}<span class="tag">escaped</span>{/if}
          {#if p.draft}<span class="tag">draft</span>{/if}
        </span>
        <span class="r">
          {#if p.open}<span class="warn-text">{p.open} {p.open === 1 ? 'thread' : 'threads'} to answer</span>{:else if p.mergedHours != null}merged in {hours(p.mergedHours)}{:else}open{/if}
        </span>
        <span class="s sans">
          {#if p.group === 'silent'}
            <span class="tag silent">silent, {p.recorded} recorded, nothing posted</span>
          {:else if p.group === 'none'}
            <span class="tag">no review run</span>
          {:else}
            {#if p.important}<span class="sev Important">{p.important} Important</span>{/if}
            {#if p.nit}<span class="sev Nit">{p.nit} Nit</span>{/if}
            {#if p.pre}<span class="sev Pre-existing">{p.pre} Pre-existing</span>{/if}
            {#if !p.important && !p.nit && !p.pre}<span class="tag">no findings</span>{/if}
          {/if}
          <span class="xs muted">{fmt(p.lines)} lines</span>
        </span>
      </li>
    {:else}
      <li class="muted">No pull requests match.</li>
    {/each}
  </ul>
  {#if prs.length > limit}
    <p class="empty small">Showing the newest {fmt(limit)} of {fmt(prs.length)}. <button type="button" class="btn" onclick={() => (all = true)}>Show all</button></p>
  {/if}
</section>

{#if r.openImportant.length}
  <div class="callout bad">
    <b>Merged with an Important thread still open:</b>
    {#each r.openImportant as p, i (p.pr)}{i ? ', ' : ''}<a href={p.url || `https://github.com/${repo}/pull/${p.pr}`}>#{p.pr} {p.title}</a>{/each}. A reply is enough; it is how
    fixed and dismissed are counted.
  </div>
{/if}

<section class="panel">
  <header><h2>What an author does</h2><a class="meta" href={docHref('working-with-the-review', 'answering-findings')}>Working with the review</a></header>
  <div class="body">
    <div class="three">
      <div class="todo-body"><h3>Every thread gets an answer</h3><p class="small">Right and worth it: fix and push, the follow-up resolves it. Right but not now, or wrong: reply "not fixing, because ..." and resolve. No second person is needed.</p></div>
      <div class="todo-body"><h3>One more review</h3><p class="small">The label <code>review again</code> runs the full review once more. At most three rounds. Do not add it on a silent pull request only to get comments.</p></div>
      <div class="todo-body">
        <h3>When something slipped through</h3>
        <p class="small">
          A merged change had a bug the review could have seen: label the fix <code>escaped</code>.
          {#if r.escaped.length}{fmt(r.escaped.length)} so far: {#each r.escaped as e, i (e.n)}{i ? ', ' : ''}<a href="https://github.com/{repo}/pull/{e.n}">#{e.n}</a>{/each}.{:else}None so far.{/if}
        </p>
      </div>
    </div>
  </div>
</section>

<section class="panel" id="findings-health">
  <header><h2>{QUESTION.right} Here, all weeks</h2><span class="meta">Since {since}. The decision uses weeks 3 to 6 only, on the overview.</span></header>
  <div class="stats">
    <Stat label="Findings acted on" value={share(r.allFix)} sub="{fmt(r.allFix.k)} of {fmt(r.allFix.n)} posted, all severities"
      means="Posted findings answered as fixed and confirmed. All severities, so it matches the published rates; the criterion counts Important only."
      source="Review threads and follow-up run records." doc={['experiment', 'measures-and-thresholds']} />
    <Stat label="Important fix rate" value={share(r.important, 10)} sub="{fmt(r.important.k)} of {fmt(r.important.n)} on merged"
      means="Important findings on merged pull requests answered as fixed. All weeks, so it can differ from the overview."
      source="Review threads and follow-up run records." doc={['experiment', 'measures-and-thresholds']} />
    <Stat label="Dismissed" value={share(r.dismissed, 20)} sub="{fmt(r.dismissed.k)} of {fmt(r.dismissed.n)} posted"
      means="Findings the author answered as not fixed. All weeks." source="Review threads in GitHub." doc={['experiment', 'measures-and-thresholds']} />
    <Stat label="PRs with a finding" value={share(r.withFinding)} sub="{fmt(r.withFinding.k)} of {fmt(r.withFinding.n)} reviewed. Anthropic: 54%"
      means="Reviewed-group pull requests with at least one posted finding. A healthy reviewer says nothing on a clean pull request."
      source="Run records and review threads." doc={['experiment', 'measures-and-thresholds']} />
    <Stat label="Author response" value={hours(r.response.med)} sub="slowest tenth {hours(r.response.p90)}, {fmt(r.response.n)} threads"
      means="Hours from a finding being posted to the author's first reply or the confirmed fix. Short means findings are actionable; long means they are debated or ignored."
      source="Thread timestamps in GitHub." doc={['working-with-the-review', 'answering-findings']} />
    <Stat label="Merged with open threads" value={share(r.mergedOpen)} sub="{fmt(r.mergedOpen.k)} of {fmt(r.mergedOpen.n)} merged"
      means="Reviewed pull requests merged with a review thread still unanswered. The rule is that every thread gets an answer."
      source="Threads and merge timestamps in GitHub." doc={['working-with-the-review', 'answering-findings']} />
  </div>
  <div class="body two topline">
    <div>
      <h3>Findings per pull request, by size</h3>
      <p class="xs muted chart-note">Mean posted findings. Anthropic: 0.5 under 50 lines, 7.5 over 1,000.</p>
      <HBars aria="Mean posted findings per pull request, by size" max={Math.max(8, ...r.bySize.map((b) => b.mean ?? 0))}
        rows={r.bySize.map((b) => ({ label: `${b.label.replace(' lines', '')} (${fmt(b.n)})`, value: b.mean, text: fmt(b.mean, 1) }))} />
    </div>
    <div>
      <h3>Time to first review</h3>
      <p class="xs muted chart-note">Reviewed pull requests by minutes from open to the review posted. Median {minutes(m.firstReview.med)}, slowest tenth {minutes(m.firstReview.p90)}.</p>
      <HBars aria="Reviewed pull requests by time to first review" rows={r.latency.map((b) => ({ label: b.label, value: b.n, text: fmt(b.n) }))} />
    </div>
    <div>
      <h3>Review rounds per pull request</h3>
      <p class="xs muted chart-note">Full reviews per reviewed pull request, counting review again.</p>
      <HBars aria="Reviewed pull requests by review rounds" rows={r.rounds.map((b) => ({ label: b.label, value: b.n, text: fmt(b.n) }))} />
    </div>
    <div>
      <h3>Findings per reviewed pull request, by week</h3>
      <p class="xs muted chart-note">Answers whether the rules are making the review quieter. Setup weeks are marked.</p>
      <Columns aria="Findings per reviewed pull request by week" slots={6} floor={4} format={(v) => fmt(v, v % 1 ? 1 : 0)}
        rows={r.perWeek.map((w, i) => ({ label: `W${w.week}`, value: w.perPr ?? 0, tone: w.setup ? 'setup' : undefined, tip: `Week ${w.week}: ${fmt(w.perPr, 1)} per pull request, ${fmt(w.prs)} pull requests`, top: i === r.perWeek.length - 1 ? fmt(w.perPr, 1) : undefined }))}>
        {#snippet legend()}<span><i class="key setup"></i>Setup weeks, not counted</span><span><i class="key"></i>Weeks 3 to 6</span>{/snippet}
      </Columns>
    </div>
  </div>
</section>

{#if r.side.ready}
  <section class="panel" id="slowing">
    <header><h2>{QUESTION.slow} Reviewed against silent</h2><span class="meta">Since {since}, same repository. The silent group is the control.</span></header>
    <div class="twrap">
      <table class="stack">
        <thead><tr><th>Measure</th><th class="n">Reviewed</th><th class="n">Silent</th><th>Reads as</th></tr></thead>
        <tbody>
          {#each [
            ['Time to merge, median', two(r.side.ttm, hours), 'Threshold: at most 20% higher than silent'],
            ['Rework within 14 days', two(r.side.rework, pct), `Baseline ${pct(m.reworkBase.v)}; limit 5 points above`],
            ['Review rounds until merge', two(r.side.rounds, (v) => fmt(v, 1)), 'The mechanism behind a time-to-merge change'],
            ['Merged without human review', two(r.side.noHuman, pct), 'Whether the review substitutes or supplements people'],
          ] as [label, [a, b], note] (label)}
            <tr><td data-l="Measure">{label}</td><td data-l="Reviewed" class="n">{a}</td><td data-l="Silent" class="n">{b}</td><td data-l="Reads as" class="full small muted">{note}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{:else}
  <div class="callout">Reviewed against silent appears when the silent group has 10 merged pull requests. {fmt(r.side.silentMerged)} so far.</div>
{/if}

<section class="panel" id="finders">
  <header>
    <h2>Per finder</h2>
    <span class="meta inline">Five focused finders in every review</span>
    <Explain
      name="per finder"
      means="Each review runs five focused finders. Fixed and dismissed are shares of that finder's posted findings. A finder with many dismissals is where a rule change pays off first. Precision per finder needs the finder in the grading file, which it does not have yet."
      source="Finding category from the run record, joined with the review threads."
      doc={['grading', 'how-to-grade']}
    />
  </header>
  <div class="twrap">
    <table class="stack">
      <thead><tr><th>Finder</th><th class="n">Findings</th><th class="n">Fixed</th><th class="n">Dismissed</th></tr></thead>
      <tbody>
        {#each r.byFinder as f (f.key)}
          <tr><td data-l="Finder">{f.label}</td><td data-l="Findings" class="n">{fmt(f.n)}</td><td data-l="Fixed" class="n">{share(f.fixed)}</td><td data-l="Dismissed" class="n">{share(f.dismissed)}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
