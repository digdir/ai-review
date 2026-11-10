<script lang="ts">
  import { compute, makeConfig } from '../lib/compute';
  import type { Screen } from '../lib/labels';
  import type { Data } from '../lib/types';
  import Findings from '../screens/Findings.svelte';
  import Operations from '../screens/Operations.svelte';
  import Overview from '../screens/Overview.svelte';
  import Repository from '../screens/Repository.svelte';

  let {
    data,
    screen,
    collected,
    ok,
    author,
    username,
    onusername,
    showStart,
    ondismiss,
  }: {
    data: Data;
    screen: Screen;
    collected: string;
    ok: boolean;
    author: string | null;
    username: string;
    onusername: (v: string) => void;
    showStart: boolean;
    ondismiss: () => void;
  } = $props();

  const config = $derived(makeConfig(data));
  const m = $derived(compute(data, config));
</script>

{#if screen === 'overview'}
  <Overview {data} {m} {config} {collected} {ok} {showStart} {ondismiss} />
{:else if screen === 'repository'}
  <Repository {data} {m} {author} {username} {onusername} />
{:else if screen === 'findings'}
  <Findings {data} {m} {author} {username} {onusername} />
{:else}
  <Operations {data} {m} {config} {collected} {ok} />
{/if}
