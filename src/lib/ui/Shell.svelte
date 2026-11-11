<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DOCS, docHref } from '../docs';
  import { SCREENS } from '../labels';
  import type { Route } from '../route';

  let {
    route,
    names,
    repo,
    stamp,
    dark,
    ontheme,
    children,
  }: {
    route: Route;
    names: string[];
    repo: string | undefined;
    stamp: string | null;
    dark: boolean;
    ontheme: () => void;
    children: Snippet;
  } = $props();

  let menuOpen = $state(false);
  const current = (yes: boolean) => (yes ? 'page' : undefined);

  function pickRepo(ev: Event) {
    const v = (ev.currentTarget as HTMLSelectElement).value;
    location.hash = `/${v}/${route.screen ?? 'overview'}`;
  }
</script>

<div class="shell">
  <a class="ds-skip-link" href="#main">Skip to the content</a>
  <div class="top">
    <header class="header">
      <button type="button" class="header-button menu-toggle" aria-expanded={menuOpen} aria-controls="menu" onclick={() => (menuOpen = !menuOpen)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        Menu
      </button>
      <a class="brand" href="#/">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 25.1 24.93"
            ><path
              fill="currentColor"
              d="M12.67.1H.5A.5.5,0,0,0,0,.6V24.33a.5.5,0,0,0,.5.5H12.67A12.37,12.37,0,0,0,12.67.1m1.19,21A8.8,8.8,0,1,1,21,14a8.8,8.8,0,0,1-7.18,7.18"
            /></svg
          >
        </span>
        <span class="brand-text">
          <span class="brand-owner">Digdir Innovation Lab</span>
          <span class="brand-name">AI code review</span>
        </span>
      </a>
      <span class="spacer"></span>
      {#if stamp}<span class="stamp">Data from {stamp}</span>{/if}
      <button type="button" class="header-button" aria-pressed={dark} onclick={ontheme}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        <span class="theme-label">Dark mode</span>
      </button>
    </header>
  </div>
  <div class="body">
    <nav id="menu" class={['sidebar', menuOpen && 'open']} aria-label="Main">
      <div class="sidebar-inner">
        {#if repo}
          {#if names.length > 1}
            <div class="ds-field repo-field">
              <label class="ds-label" for="repo-pick">Repository</label>
              <select class="ds-input" id="repo-pick" data-size="sm" value={repo} onchange={pickRepo}>
                {#each names as n (n)}<option value={n}>{n}</option>{/each}
              </select>
            </div>
          {:else}
            <h2 class="group" id="nav-repo">{repo}</h2>
          {/if}
          <ul aria-labelledby={names.length > 1 ? 'repo-pick' : 'nav-repo'}>
            {#each SCREENS as [id, label] (id)}
              <li><a href="#/{repo}/{id}" aria-current={current(route.page === 'screen' && route.screen === id)} onclick={() => (menuOpen = false)}>{label}</a></li>
            {/each}
          </ul>
        {/if}
        <h2 class="group" id="nav-all">All repositories</h2>
        <ul aria-labelledby="nav-all">
          <li><a href="#/" aria-current={current(route.page === 'repositories')} onclick={() => (menuOpen = false)}>Repositories</a></li>
        </ul>
        <h2 class="group" id="nav-docs">Docs</h2>
        <ul aria-labelledby="nav-docs">
          <li><a href="#/start" aria-current={current(route.page === 'start')} onclick={() => (menuOpen = false)}>Start here</a></li>
          {#each DOCS as d (d.id)}
            <li><a href={docHref(d.id)} aria-current={current(route.page === 'docs' && route.doc === d.id)} onclick={() => (menuOpen = false)}>{d.title}</a></li>
          {/each}
        </ul>
      </div>
    </nav>
    <main id="main" class="main" tabindex="-1">
      <div class="content">
        {@render children()}
      </div>
    </main>
  </div>
  <footer class="footer">
    <span>Digdir Innovation Lab</span>
    <a class="ds-link" href="https://github.com/digdir/ai-review">github.com/digdir/ai-review</a>
  </footer>
</div>
