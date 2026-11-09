<script lang="ts">
  import { compute, makeConfig } from '../lib/compute';
  import { day } from '../lib/format';
  import { VIEWS, VERDICT, type View } from '../lib/labels';
  import { sample } from '../lib/sample';
  import { DAY } from '../lib/stats';
  import type { Data } from '../lib/types';
  import Cost from '../tabs/Cost.svelte';
  import Delivery from '../tabs/Delivery.svelte';
  import Experiment from '../tabs/Experiment.svelte';
  import Findings from '../tabs/Findings.svelte';
  import Noise from '../tabs/Noise.svelte';
  import Overview from '../tabs/Overview.svelte';
  import Quality from '../tabs/Quality.svelte';
  import Runs from '../tabs/Runs.svelte';
  import Security from '../tabs/Security.svelte';

  let { real, view, showSample }: { real: Data; view: View; showSample: boolean } = $props();

  let severity = $state('All');
  let outcome = $state('All');

  const config = $derived(makeConfig(real));
  const data = $derived(showSample ? sample() : real);
  const m = $derived(compute(data, config));
  const repo = $derived(real.config.repo);
  const [owner, name] = $derived(repo.split('/'));
  const verdict = $derived(m.met === m.criteria.length ? 'ok' : m.criteria.some((c) => c.status === 'bad') ? 'bad' : 'wait');
  const daysLeft = $derived(Math.max(0, Math.ceil((m.decisionMs - m.now) / DAY)));
</script>

<section class="repo-head">
  <div class="wrap">
    <div class="repo-title">
      <h1><span><span class="owner">{owner}/</span>{name}</span></h1>
      <div class="chips">
        <a class="chip" href="https://github.com/{repo}/pulls">Pull requests ↗</a>
        <a class="chip" href="https://github.com/{repo}/actions">Actions ↗</a>
        <a class="chip" href="#/{repo}/experiment" title="Go/no-go for the six-week experiment">
          <i class="led {m.running ? 'live' : ''}"></i>Experiment week {m.week}/{config.weeks}
        </a>
        <a class="chip" href="#/{repo}/experiment"><span class="verdict {verdict}">{VERDICT[verdict]}</span> {m.met}/{m.criteria.length} criteria</a>
        <span class="chip" title="Go/no-go decision on {day(m.decisionMs)}">Decision in {daysLeft} days</span>
      </div>
    </div>
    {#if showSample}
      <div class="ds-alert" data-color="warning" data-size="sm">
        <p class="ds-paragraph" data-size="sm">Sample data: six made-up weeks with a shadow group, grading and pulse, to judge the layout. The numbers are not real.</p>
      </div>
    {/if}
    <nav class="nav" aria-label="Views">
      {#each VIEWS as [id, label] (id)}
        <a href="#/{repo}/{id}" aria-current={id === view ? 'page' : undefined}>{label}</a>
      {/each}
    </nav>
  </div>
</section>

<main>
  <div class="wrap section">
    {#if view === 'overview'}
      <Overview {data} {m} {config} />
    {:else if view === 'findings'}
      <Findings {m} bind:severity bind:outcome />
    {:else if view === 'quality'}
      <Quality {data} {m} {config} />
    {:else if view === 'noise'}
      <Noise {m} />
    {:else if view === 'security'}
      <Security {m} {config} />
    {:else if view === 'delivery'}
      <Delivery {data} {m} {config} />
    {:else if view === 'cost'}
      <Cost {m} {config} />
    {:else if view === 'runs'}
      <Runs {m} {config} />
    {:else}
      <Experiment {data} {m} {config} />
    {/if}
  </div>
</main>
