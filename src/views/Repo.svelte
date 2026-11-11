<script lang="ts">
  import { compute, makeConfig } from '../lib/compute';
  import type { Screen } from '../lib/labels';
  import type { Data } from '../lib/types';
  import Findings from '../screens/Findings.svelte';
  import Operations from '../screens/Operations.svelte';
  import Overview from '../screens/Overview.svelte';
  import PullRequests from '../screens/PullRequests.svelte';

  let {
    data,
    screen,
    collected,
    ok,
    author,
    username,
    onusername,
  }: {
    data: Data;
    screen: Screen;
    collected: string;
    ok: boolean;
    author: string | null;
    username: string;
    onusername: (v: string) => void;
  } = $props();

  const config = $derived(makeConfig(data));
  const m = $derived(compute(data, config));
</script>

{#if screen === 'overview'}
  <Overview {data} {m} {config} />
{:else if screen === 'pull-requests'}
  <PullRequests {data} {m} {author} {username} {onusername} />
{:else if screen === 'findings'}
  <Findings {data} {m} {author} {username} {onusername} />
{:else}
  <Operations {data} {m} {config} {collected} {ok} />
{/if}
