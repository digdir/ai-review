<script lang="ts">
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { hashLogin } from './lib/author';
  import { DOC_IDS, docHref } from './lib/docs';
  import { makeConfig, timing } from './lib/compute';
  import { fleet, type Index } from './lib/fleet';
  import { stamp, weekday } from './lib/format';
  import { parseRoute } from './lib/route';
  import { SAMPLE_STATES, sample, type SampleState } from './lib/sample';
  import type { Data } from './lib/types';
  import Shell from './lib/ui/Shell.svelte';
  import Docs from './views/Docs.svelte';
  import Fleet from './views/Fleet.svelte';
  import Repo from './views/Repo.svelte';
  import Start from './views/Start.svelte';

  let { repos, index, sampleState = null }: { repos: Data[]; index: Index | null; sampleState?: SampleState | null } = $props();

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

  const fake = $derived(sampleState ? sample(sampleState) : null);
  const shown = $derived(
    fake ? (repos.length ? repos : [fake]).map((d) => ({ ...fake, config: { ...fake.config, repo: d.config.repo } })) : repos,
  );
  const names = $derived(shown.map((d) => d.config.repo).sort());
  let hash = $state(location.hash);
  let theme = $state(store.get('theme') ?? 'auto');
  let username = $state(store.get('gh-user') ?? '');
  let author = $state<string | null>(null);
  const systemDark = new MediaQuery('prefers-color-scheme: dark');

  const route = $derived(parseRoute(hash, names, DOC_IDS));
  const current = $derived(route.repo ? shown.find((d) => d.config.repo === route.repo) : undefined);
  const entry = $derived(index?.repos.find((r) => r.repo === route.repo));
  const rows = $derived(fleet(shown, fake ? null : index));
  const fresh = $derived(current?.generatedAt ?? (fake ? fake.generatedAt : (index?.generatedAt ?? shown[0]?.generatedAt)));
  const failed = $derived(!fake && (index?.repos.some((r) => !r.ok) ?? false));
  const first = $derived(current ?? shown[0]);
  const dates = $derived.by(() => {
    if (!first) return { start: 'the start', measure: 'week 3', decision: 'week 7' };
    const t = timing(Date.parse(first.generatedAt), first.config.start, makeConfig(first));
    return { start: weekday(t.startMs), measure: weekday(t.measureMs), decision: weekday(t.decisionMs) };
  });
  const dark = $derived(theme === 'dark' || (theme === 'auto' && systemDark.current));

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
    void route.doc;
    tick().then(() => {
      const el = anchor && document.getElementById(anchor);
      if (el) el.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    });
  });

  function toggleTheme() {
    theme = dark ? 'light' : 'dark';
    store.set('theme', theme);
  }
</script>

<svelte:window onhashchange={() => (hash = location.hash)} />

<Shell {route} {names} repo={route.repo ?? names[0]} stamp={fresh ? stamp(fresh) : null} {dark} ontheme={toggleTheme}>
  {#if fake}
    <div class="ds-alert" data-color="warning" data-size="sm" role="note">
      Sample data at {SAMPLE_STATES.find(([id]) => id === sampleState)?.[1].toLowerCase()}: made-up numbers in the real shape. Nothing here is a real
      measurement. <a class="ds-link" href="./">Show the real data</a>
    </div>
  {:else if failed}
    <div class="ds-alert" data-color="danger" data-size="sm">
      The last collection failed for at least one repository. The numbers may be old. <a class="ds-link" href={docHref('runbook', 'when-the-dashboard-is-stale-or-down')}>When the dashboard is stale or down</a>
    </div>
  {/if}
  {#if route.page === 'start'}
    <Start {dates} />
  {:else if route.page === 'docs' && route.doc}
    <Docs page={route.doc} anchor={route.anchor} />
  {:else if current && route.screen}
    {#key current.config.repo + sampleState}
      <Repo data={current} screen={route.screen} collected={current.generatedAt} ok={!!fake || (entry?.ok ?? true)} {author} {username} onusername={setUsername} />
    {/key}
  {:else}
    <Fleet {rows} />
  {/if}
</Shell>
