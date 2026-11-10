<script lang="ts">
  import { docHref } from '../lib/docs';
  import StartHere from '../lib/ui/StartHere.svelte';

  let { dates }: { dates: { start: string; measure: string; decision: string } } = $props();

  const words: [string, string][] = [
    ['Finding', 'One comment the review posted on one line, with a severity.'],
    ['Important', 'Breaks something REVIEW.md lists as Important: tenant isolation, the model gate, personal data, a public contract.'],
    ['Nit', 'Worth knowing, never a blocker. At most three per review.'],
    ['Pre-existing', 'An Important problem in lines the pull request did not touch.'],
    ['Fixed', 'The author answered fixed and the follow-up run confirmed the problem is gone.'],
    ['Dismissed', 'The author replied that it will not be fixed and resolved the thread.'],
    ['Reviewed group', 'Pull requests that got the review posted.'],
    ['Silent group', 'Reviewed and recorded, nothing posted. The control group.'],
    ['Finder', 'One of five focused agents in a review: Correctness, Security, Other paths, Tests, Docs and rules.'],
    ['Follow-up', 'A cheaper run after each push that resolves fixed findings. It never adds new ones.'],
    ['Missed by the checks', 'An Important finding fixed before merge; CI was green, so the checks did not catch it.'],
    ['Escaped', 'A bug the review had a chance to see and did not report; the fix carries the label.'],
    ['Precision', 'Share of hand-graded findings that were right and worth fixing.'],
    ['Rework', 'A merged pull request whose files a fix pull request changes within 14 days.'],
    ['Met, Not met, Too early', 'How a criterion reads. Too early means its read-when rule is not reached yet.'],
    ['Keep, adjust, stop', 'The three outcomes of the decision rule in the protocol.'],
  ];
</script>

<div class="head">
  <h1>Start here</h1>
  <p>For teammates who did not design the experiment: what this is, why there is a silent group, what the six weeks are, what each role does, and the words used on every screen.</p>
</div>
<StartHere {dates} full />
<section class="panel">
  <header><h2>The words used here</h2><a class="meta" href={docHref('working-with-the-review', 'answering-findings')}>Working with the review</a></header>
  <div class="body">
    <dl class="glossary">
      {#each words as [k, v] (k)}<dt>{k}</dt><dd>{v}</dd>{/each}
    </dl>
  </div>
</section>
