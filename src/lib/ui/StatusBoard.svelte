<script lang="ts">
  import { LED } from '../labels';
  import type { Status } from '../types';

  let { items, title, verdict }: { items: { name: string; value: string; status: Status }[]; title: Record<Status, [string, string]>; verdict: Record<Status, string> } =
    $props();
</script>

<ul class="gonogo">
  {#each items as item (item.name)}
    <li>
      <i class="led {LED[item.status]}" title={title[item.status][1]}></i>
      <span>{item.name}<small>{item.value}</small></span>
      <span class="verdict {item.status}" title={title[item.status][1]}>{verdict[item.status]}</span>
    </li>
  {/each}
</ul>
