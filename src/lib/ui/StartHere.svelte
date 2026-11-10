<script lang="ts">
  import { docHref } from '../docs';
  import { PURPOSE } from '../labels';

  let {
    dates,
    ondismiss,
    full = false,
  }: { dates: { start: string; measure: string; decision: string }; ondismiss?: () => void; full?: boolean } = $props();
</script>

{#snippet how()}
  <div class="grid">
    <div><b>Why this exists</b><p>{PURPOSE} More of the code is written with AI agents, and the review is the check that lets a person merge with confidence.</p></div>
    <div><b>What the review is</b><p>A model reads every pull request against rules the repository wrote itself (REVIEW.md, AGENTS.md) and posts one review with findings marked Important, Nit or Pre-existing. It comments; people decide and merge.</p></div>
    <div><b>Why some pull requests get nothing</b><p>One in four is in the silent group: reviewed and recorded, nothing posted. That is the control group, so the effect on the team can be measured. Not a fault.</p></div>
    <div><b>The six weeks</b><p>Weeks 1 and 2 (from {dates.start}) tighten the rules and do not count. Weeks 3 to 6 (from {dates.measure}) are measured. Decision in the week of {dates.decision}; after that the review keeps running and the criteria stay on as health.</p></div>
    <div><b>What the criteria measure</b><p>Whether the trust is earned: findings are right and get fixed, problems the checks miss get caught, speed does not drop, cost stays sane. Each has a threshold and a read-when rule. Too early means not enough data yet, not a problem. Met and Not met appear only from week 3.</p></div>
  </div>
{/snippet}

{#snippet roles()}
  <div class="grid">
    <div><b>You open pull requests</b><p>Answer every thread (fix, or "not fixing, because ..."). Label <code>review again</code> for one more review, <code>escaped</code> on a fix for a bug the review could have seen.</p></div>
    <div><b>You run the experiment (the lab)</b><p>The Monday checklist on Operations: changes, failed runs, cost, grading from week 3, the pulse survey in weeks 2 and 6.</p></div>
    <div><b>You decide (approvers)</b><p>Read the seven criteria and what the rule says. Keep, adjust or stop in the week of {dates.decision}. Nothing to decide before {dates.measure}.</p></div>
  </div>
{/snippet}

{#if full}
  <section class="start" aria-label="Why and what">{@render how()}</section>
  <section class="panel">
    <header><h2>What each role does</h2></header>
    <div class="body start-body">{@render roles()}</div>
  </section>
{:else}
  <section class="start" id="start-panel" aria-labelledby="start-heading">
    <h2 id="start-heading">Start here</h2>
    {@render how()}
    {@render roles()}
    <div class="actions">
      <button type="button" class="btn primary" onclick={ondismiss}>Got it, hide this</button>
      <a href="#/start" class="small">The full explainer with the words used here</a>
      <a href={docHref('working-with-the-review')} class="small">Working with the review</a>
    </div>
  </section>
{/if}
