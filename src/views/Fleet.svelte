<script lang="ts">
  import { docHref } from '../lib/docs';
  import type { FleetRow } from '../lib/fleet';
  import { fmt, nok, pct, stamp } from '../lib/format';
  import { DECISION, PHASE } from '../lib/labels';
  import Explain from '../lib/ui/Explain.svelte';

  let { rows }: { rows: FleetRow[] } = $props();

  const share = (r: FleetRow['fixed']) => (r.n && !r.few ? pct(r.v) : r.n ? 'Too few' : '–');
  const phase = (r: FleetRow) =>
    !r.phase ? '–' : r.phase === 'after' ? (r.decided ? `After, decided ${DECISION[r.decided]}` : PHASE.after) : `${PHASE[r.phase]}, week ${r.week}`;
  const criteria = (r: FleetRow) =>
    !r.counts ? '–' : r.phase === 'setup' ? 'Too early' : `${r.counts.met} met, ${r.counts.notmet} not met, ${r.counts.early} too early`;
</script>

<div class="head">
  <h1>Repositories</h1>
  <p>Every repository that has the review and a page here. genki is the first; joining is one pull request here and one in the repository.</p>
</div>

<section class="panel">
  <header>
    <h2>{rows.length === 1 ? '1 repository' : `${fmt(rows.length)} repositories`}</h2>
    <Explain
      name="the repositories table"
      means="One row per repository with a settings file in repos/. Phase and criteria are that repository's own experiment. Findings acted on and dismissed are all severities over all weeks, so they match the published rates rather than the criteria. Rates from fewer pull requests than the minimum are hidden."
      source="data/index.json and each repository's data file."
      doc={['joining', 'what-the-lab-sets-up']}
    />
  </header>
  <div class="twrap">
    <table class="stack">
      <thead>
        <tr><th>Repository</th><th>Phase</th><th>Criteria</th><th class="n">Reviewed, 7 days</th><th class="n">Findings acted on</th><th class="n">Dismissed</th><th class="n">Cost, projected</th><th>Last run</th><th>Collected</th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.repo)}
          <tr>
            <td data-l="Repository" class="full"><a class="mono" href="#/{r.repo}/overview">{r.repo}</a></td>
            <td data-l="Phase">{phase(r)}</td>
            <td data-l="Criteria">{criteria(r)}</td>
            <td data-l="Reviewed, 7 days" class="n">{r.phase ? fmt(r.reviewedWeek) : '–'}</td>
            <td data-l="Findings acted on" class="n">{r.phase ? share(r.fixed) : '–'}</td>
            <td data-l="Dismissed" class="n">{r.phase ? share(r.dismissed) : '–'}</td>
            <td data-l="Cost, projected" class="n">{r.phase ? `${nok(r.projected ?? r.spent)} / ${fmt(r.budgetNok)}` : '–'}</td>
            <td data-l="Last run" class="mono small">{#if r.lastRun}{stamp(r.lastRun)}{#if r.lastRunFailed}, failed{/if}{:else}–{/if}</td>
            <td data-l="Collected" class="mono small">{#if r.error}<span class="status notmet">{r.error}</span>{:else if r.generatedAt}{stamp(r.generatedAt)}{/if}</td>
          </tr>
        {:else}
          <tr><td colspan="9" class="muted">No repositories yet. Add a settings file in repos/.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<div class="callout">
  <b>Joining:</b> the repository writes AGENTS.md, REVIEW.md and a pull request template with Risk and Undo, adds the snapshot workflow and the label
  <code>review again</code>; the lab adds a federated credential, a budget and <code>repos/&lt;owner&gt;/&lt;name&gt;.json</code>.
  <a href={docHref('joining')}>Joining the review</a>.
</div>
