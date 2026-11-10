<script lang="ts">
  import { tick } from 'svelte';
  import { hashLogin } from './lib/author';
  import { makeConfig, timing } from './lib/compute';
  import { fleet, type Index } from './lib/fleet';
  import { stamp, weekday } from './lib/format';
  import { SCREENS } from './lib/labels';
  import { parseRoute } from './lib/route';
  import { SAMPLE_STATES, sample, type SampleState } from './lib/sample';
  import type { Data } from './lib/types';
  import Fleet from './views/Fleet.svelte';
  import Repo from './views/Repo.svelte';
  import Start from './views/Start.svelte';

  let { repos, index }: { repos: Data[]; index: Index | null } = $props();

  const store = {
    get: (k: string) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k: string, v: string) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        return;
      }
    },
  };

  const names = $derived(repos.map((d) => d.config.repo).sort());
  let hash = $state(location.hash);
  let sampleState = $state<SampleState | 'off'>((store.get('sample') as SampleState | null) ?? 'off');
  let theme = $state(store.get('theme') ?? 'auto');
  let username = $state(store.get('gh-user') ?? '');
  let author = $state<string | null>(null);
  let startDismissed = $state(store.get('start-dismissed') === '1');

  const route = $derived(parseRoute(hash, names));
  const fake = $derived(sampleState === 'off' ? null : sample(sampleState));
  const shown = $derived(repos.map((d) => (fake ? { ...fake, config: { ...fake.config, repo: d.config.repo } } : d)));
  const current = $derived(route.repo ? shown.find((d) => d.config.repo === route.repo) : undefined);
  const entry = $derived(index?.repos.find((r) => r.repo === route.repo));
  const rows = $derived(fleet(shown, sampleState === 'off' ? index : null));
  const fresh = $derived(current?.generatedAt ?? index?.generatedAt ?? shown[0]?.generatedAt);
  const failed = $derived(sampleState === 'off' && (index?.repos.some((r) => !r.ok) ?? false));
  const first = $derived(current ?? shown[0]);
  const dates = $derived.by(() => {
    if (!first) return { start: 'the start', measure: 'week 3', decision: 'week 7' };
    const t = timing(Date.parse(first.generatedAt), first.config.start, makeConfig(first));
    return { start: weekday(t.startMs), measure: weekday(t.measureMs), decision: weekday(t.decisionMs) };
  });
  const repoForNav = $derived(route.repo ?? names[0]);

  $effect(() => {
    document.documentElement.dataset.colorScheme = theme;
  });

  async function setUsername(value: string) {
    username = value;
    const u = value.trim();
    store.set('gh-user', u);
    const h = u ? await hashLogin(u) : null;
    if (username.trim() === u) author = h;
  }
  setUsername(store.get('gh-user') ?? '');

  $effect(() => {
    if (route.canonical !== hash.replace(/^#/, '')) history.replaceState(null, '', '#' + route.canonical);
  });

  $effect(() => {
    const anchor = route.anchor;
    void route.screen;
    void route.page;
    tick().then(() => {
      const el = anchor && document.getElementById(anchor);
      if (el) el.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    });
  });

  function toggleTheme() {
    const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    theme = dark ? 'light' : 'dark';
    store.set('theme', theme);
  }

  function dismiss() {
    startDismissed = true;
    store.set('start-dismissed', '1');
  }

  function pickRepo(ev: Event) {
    const v = (ev.currentTarget as HTMLSelectElement).value;
    location.hash = `/${v}/${route.screen ?? 'overview'}`;
  }
</script>

<svelte:window onhashchange={() => (hash = location.hash)} />

<header class="top">
  <div class="wrap">
    <a class="brand" href="#/" aria-label="ai-review, Digdir Innovation Lab">
      <svg class="mark" viewBox="0 0 25.1 24.93" aria-hidden="true"
        ><path
          fill="currentColor"
          d="M12.67.1H.5A.5.5,0,0,0,0,.6V24.33a.5.5,0,0,0,.5.5H12.67A12.37,12.37,0,0,0,12.67.1m1.19,21A8.8,8.8,0,1,1,21,14a8.8,8.8,0,0,1-7.18,7.18"
        /></svg
      >
      <span class="t"><b>ai-review</b><small>Digdir Innovation Lab</small></span>
    </a>
    <span class="divider" aria-hidden="true"></span>
    {#if names.length > 1}
      <select class="repo" aria-label="Repository" onchange={pickRepo} value={repoForNav}>
        {#each names as n (n)}<option value={n}>{n}</option>{/each}
      </select>
    {:else if repoForNav}
      <span class="repo">{repoForNav}</span>
    {/if}
    <nav class="main" aria-label="Screens">
      {#if repoForNav}
        {#each SCREENS as [id, label] (id)}
          <a href="#/{repoForNav}/{id}" aria-current={route.page === 'screen' && route.screen === id ? 'page' : undefined}>{label}</a>
        {/each}
      {/if}
      <a href="#/" aria-current={route.page === 'repositories' ? 'page' : undefined}>Repositories</a>
      <a href="#/start" class="start" aria-current={route.page === 'start' ? 'page' : undefined}>Start here</a>
    </nav>
    <div class="tools">
      <label class="seg-label" for="sample">Sample data</label>
      <select id="sample" class="sample" bind:value={sampleState} onchange={() => store.set('sample', sampleState)}>
        <option value="off">Off</option>
        {#each SAMPLE_STATES as [id, label] (id)}<option value={id}>{label}</option>{/each}
      </select>
      {#if fresh}
        <span class="stamp" title={failed ? 'The last collection failed for at least one repository' : 'When the data was collected'}
          ><i class={['dot', failed && 'bad']}></i>data {stamp(fresh)}</span
        >
      {/if}
      <button type="button" class="icon" aria-label="Switch between light and dark" onclick={toggleTheme}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      </button>
    </div>
  </div>
</header>

<main>
  <div class="wrap">
    {#if sampleState !== 'off'}
      <p class="banner" role="note">Sample data: made-up numbers in the real shape, to judge the layout at {SAMPLE_STATES.find(([id]) => id === sampleState)?.[1].toLowerCase()}. Nothing here is a real measurement.</p>
    {/if}
    {#if route.page === 'start'}
      <Start {dates} />
    {:else if current && route.screen}
      {#key current.config.repo + sampleState}
        <Repo
          data={current}
          screen={route.screen}
          collected={current.generatedAt}
          ok={sampleState !== 'off' || (entry?.ok ?? true)}
          {author}
          {username}
          onusername={setUsername}
          showStart={!startDismissed}
          ondismiss={dismiss}
        />
      {/key}
    {:else}
      <Fleet {rows} />
    {/if}
  </div>
</main>

<footer>
  <div class="wrap">
    <span>Digdir Innovation Lab, AI code review</span>
    <a href="https://github.com/digdir/ai-review">github.com/digdir/ai-review</a>
  </div>
</footer>
