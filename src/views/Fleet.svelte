<script lang="ts">
  import type { FleetRow } from '../lib/fleet';
  import { fmt, nok, pct, stamp } from '../lib/format';
  import { LED, STATUS, VERDICT } from '../lib/labels';
  import { sum } from '../lib/stats';
  import Stat from '../lib/ui/Stat.svelte';

  let { rows }: { rows: FleetRow[] } = $props();

  const ok = $derived(rows.filter((r) => r.status));
  const failed = $derived(rows.filter((r) => r.error).length);
  const reviewed = $derived(sum(ok.map((r) => r.reviewedWeek)));
  const projected = $derived(sum(ok.map((r) => r.projected)));
  const budget = $derived(sum(ok.map((r) => r.budgetNok)));
  const go = $derived(ok.filter((r) => r.status === 'ok').length);
  const share = (r: FleetRow['fixed']) => (r.n && !r.few ? pct(r.v) : r.n ? 'Too few' : '–');
</script>

<section class="repo-head">
  <div class="wrap" style="padding-bottom:var(--ds-size-4)">
    <div class="repo-title"><h1>All repositories</h1></div>
    <div class="stats">
      <Stat label="Repositories" value={fmt(rows.length)} help="Repositories with a settings file in repos/.">using the review</Stat>
      <Stat label="Collection" value={failed ? `${failed} failed` : 'OK'} status={failed ? 'bad' : 'ok'} help="Whether the last collection worked for every repository.">
        last run
      </Stat>
      <Stat label="Reviewed, 7 days" value={fmt(reviewed)} help="Pull requests reviewed in the last seven days, across repositories.">pull requests</Stat>
      <Stat label="GO" value="{go}/{ok.length}" status={ok.length && go === ok.length ? 'ok' : 'wait'} help="Repositories that meet every go/no-go criterion.">
        repositories meeting every criterion
      </Stat>
      <Stat
        label="Projected cost"
        value={nok(projected)}
        status={projected > budget ? 'bad' : projected > budget * 0.8 ? 'wait' : 'ok'}
        help="Projected cost this month, summed across repositories."
      >
        of {nok(budget)} budget
      </Stat>
    </div>
  </div>
</section>

<main>
  <div class="wrap section">
    <div class="table-wrap">
      <table class="ds-table" data-border data-zebra data-size="sm">
        <thead>
          <tr>
            <th>Repository</th><th>Status</th><th class="num">Criteria</th><th class="num">Reviewed, 7 days</th><th class="num">Fix rate</th><th class="num"
              >Dismissed</th
            ><th class="num">Projected cost</th><th>Last run</th><th>Data</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.repo)}
            <tr>
              <td class="path-cell"><a class="ds-link" href="#/{r.repo}">{r.repo}</a></td>
              <td>
                {#if r.status}
                  <span class="verdict {r.status}" title={STATUS[r.status][1]}><i class="led {LED[r.status]}"></i> {VERDICT[r.status]}</span>
                {:else}
                  <span class="verdict bad">FAULT</span>
                {/if}
              </td>
              <td class="num">{r.status ? `${r.met}/${r.criteria}` : '–'}</td>
              <td class="num">{r.status ? fmt(r.reviewedWeek) : '–'}</td>
              <td class="num">{r.status ? share(r.fixed) : '–'}</td>
              <td class="num">{r.status ? share(r.dismissed) : '–'}</td>
              <td class="num">{r.status ? `${nok(r.projected)} / ${fmt(r.budgetNok)}` : '–'}</td>
              <td>{#if r.lastRun}{stamp(r.lastRun)}{#if r.lastRunFailed}<span class="muted"> · failed</span>{/if}{:else}–{/if}</td>
              <td class="wrap-cell">{#if r.error}<span class="verdict bad">{r.error}</span>{:else if r.generatedAt}{stamp(r.generatedAt)}{/if}</td>
            </tr>
          {:else}
            <tr><td colspan="9" class="empty">No repositories yet. Add a settings file in repos/.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="hint">
      Status combines each repository's go/no-go criteria: GO when all are met, NO-GO when one is not, HOLD when something is missing, and STANDBY when it is
      too early to tell. Rates from fewer pull requests than the minimum are hidden.
    </p>
  </div>
</main>
