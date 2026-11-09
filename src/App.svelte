<script lang="ts">
  import { fleet, type Index } from './lib/fleet';
  import { stamp } from './lib/format';
  import { parseRoute } from './lib/route';
  import type { Data } from './lib/types';
  import Fleet from './views/Fleet.svelte';
  import Repo from './views/Repo.svelte';

  let { repos, index }: { repos: Data[]; index: Index | null } = $props();

  const names = $derived(repos.map((d) => d.config.repo).sort());
  let hash = $state(location.hash);
  let showSample = $state(false);
  let theme = $state(read());

  const route = $derived(parseRoute(hash, names));
  const current = $derived(route.repo ? repos.find((d) => d.config.repo === route.repo) : undefined);
  const rows = $derived(fleet(repos, index));
  const fresh = $derived(current?.generatedAt ?? index?.generatedAt ?? repos[0]?.generatedAt);
  const failed = $derived(index?.repos.some((r) => !r.ok) ?? false);

  function read(): 'dark' | 'light' {
    try {
      return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  $effect(() => {
    document.body.dataset.colorScheme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* storage blocked */
    }
  });

  $effect(() => {
    if (route.canonical !== hash.replace(/^#/, '')) history.replaceState(null, '', '#' + route.canonical);
  });

  function pick(ev: Event) {
    const v = (ev.currentTarget as HTMLSelectElement).value;
    location.hash = v ? `/${v}/${route.view ?? 'overview'}` : '/';
  }
</script>

<svelte:window onhashchange={() => (hash = location.hash)} />

<header class="topbar">
  <div class="wrap">
    <a class="org" href="https://www.digdir.no" aria-label="Digitaliseringsdirektoratet">
      <svg viewBox="0 0 25.1 24.93" aria-hidden="true"
        ><path
          fill="currentColor"
          d="M12.67.1H.5A.5.5,0,0,0,0,.6V24.33a.5.5,0,0,0,.5.5H12.67A12.37,12.37,0,0,0,12.67.1m1.19,21A8.8,8.8,0,1,1,21,14a8.8,8.8,0,0,1-7.18,7.18"
        /></svg
      >
      <span><b>Digdir</b><small>Innovation Lab</small></span>
    </a>
    <span class="divider" aria-hidden="true"></span>
    <a class="product" href="#/">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        ><path d="M8 6 2 12l6 6" /><path d="m16 6 6 6-6 6" /><path d="m9.5 12.5 2 2 3.5-4.5" /></svg
      >
      ai-review <small>dashboard</small>
    </a>
    <select class="ds-input repo-switch" data-size="sm" aria-label="Repository" onchange={pick} value={route.repo ?? ''}>
      <option value="">All repositories ({names.length})</option>
      {#each names as n (n)}<option value={n}>{n}</option>{/each}
    </select>
    <span class="spacer"></span>
    <div class="tools">
      {#if route.repo}
        <label class="sample-switch"><input type="checkbox" class="ds-input" data-size="sm" bind:checked={showSample} /> Sample data</label>
      {/if}
      {#if fresh}
        <span class="fresh" title={failed ? 'The last collection failed for at least one repository' : 'When the data was collected'}
          ><i class="led {failed ? 'bad' : 'ok'}"></i>data {stamp(fresh)}</span
        >
      {/if}
      <button class="icon-btn" type="button" aria-label="Switch to {theme === 'dark' ? 'light' : 'dark'} mode" onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}>
        {#if theme === 'dark'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            /></svg
          >
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        {/if}
      </button>
    </div>
  </div>
</header>

{#if current && route.view}
  {#key current.config.repo}
    <Repo real={current} view={route.view} {showSample} />
  {/key}
{:else}
  <Fleet {rows} />
{/if}

<footer class="footer">
  <div class="wrap">
    <span>Digdir Innovation Lab · AI code review experiment</span>
    <a href="https://github.com/digdir/ai-review">github.com/digdir/ai-review</a>
  </div>
</footer>
