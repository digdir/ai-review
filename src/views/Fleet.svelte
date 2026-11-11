<script lang="ts">
  import { docHref } from '../lib/docs';
  import type { FleetRow } from '../lib/fleet';
  import { fmt, nok, pct, stamp } from '../lib/format';
  import { DECISION, PHASE } from '../lib/labels';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import TableRegion from '../lib/ui/TableRegion.svelte';

  let { rows }: { rows: FleetRow[] } = $props();

  const share = (r: FleetRow['fixed']) => (r.n && !r.few ? pct(r.v) : r.n ? 'Too few' : '–');
  const phase = (r: FleetRow) =>
    !r.phase ? '–' : r.phase === 'after' ? (r.decided ? `After, decided ${DECISION[r.decided]}` : PHASE.after) : `${PHASE[r.phase]}, week ${r.week}`;
  const criteria = (r: FleetRow) =>
    !r.counts ? '–' : r.phase === 'setup' ? 'Too early' : `${r.counts.met} met, ${r.counts.notmet} not met, ${r.counts.early} too early`;
</script>

<div class="page">
  <PageHeader title="Repositories">
    Every repository with the review and a page here, and how each is doing. Joining takes one pull request here and one in the repository:
    <a class="ds-link" href={docHref('joining', 'what-the-lab-sets-up')}>Joining the review</a>.
  </PageHeader>

  {#if rows.length}
    <TableRegion label="Repositories">
      <table class="ds-table stacked" data-size="sm">
        <thead>
          <tr>
            <th scope="col">Repository</th><th scope="col">Phase</th><th scope="col">Criteria</th><th scope="col" class="n">Reviewed, 7 d</th>
            <th scope="col" class="n">Acted on</th><th scope="col" class="n">Dismissed</th><th scope="col" class="n">Cost</th><th scope="col">Last run</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.repo)}
            <tr>
              <td class="lead">
                <a class="ds-link" href="#/{r.repo}/overview">{r.repo}</a>
                {#if r.error}<span class="sub"><span class="ds-tag" data-color="danger" data-size="sm">{r.error}</span></span>{:else if r.generatedAt}<span class="sub nowrap">Collected {stamp(r.generatedAt)}</span>{/if}
              </td>
              <td data-l="Phase" class="nowrap">{phase(r)}</td>
              <td data-l="Criteria">{criteria(r)}</td>
              <td data-l="Reviewed, last 7 days" class="n">{r.phase ? fmt(r.reviewedWeek) : '–'}</td>
              <td data-l="Acted on" class="n">{r.phase ? share(r.fixed) : '–'}</td>
              <td data-l="Dismissed" class="n">{r.phase ? share(r.dismissed) : '–'}</td>
              <td data-l="Cost this month, projected" class="n">{r.phase ? `${nok(r.projected ?? r.spent)} of ${fmt(r.budgetNok)}` : '–'}</td>
              <td data-l="Last run" class="nowrap">{#if r.lastRun}{stamp(r.lastRun)}{#if r.lastRunFailed}, failed{/if}{:else}–{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </TableRegion>
  {:else}
    <EmptyState>No repositories yet. Add a settings file in repos/.</EmptyState>
  {/if}

  <p class="section-desc">
    Acted on and dismissed are all severities over all weeks, so they match the published rates rather than the criteria. Rates from fewer pull requests
    than the minimum are hidden.
  </p>
</div>
