<script lang="ts">
  import { docHref } from '../lib/docs';
  import { PURPOSE } from '../lib/labels';
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Section from '../lib/ui/Section.svelte';

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

<div class="page">
  <PageHeader context="Docs" title="Start here">
    For teammates who did not design the experiment: what this is, why some pull requests get no comments, what the six weeks are, and the words used on every page.
  </PageHeader>

  <Section id="why" title="Why this exists">
    <div class="prose">
      <p>{PURPOSE} More of the code is written with AI agents, and the review is the check that lets a person merge with confidence.</p>
      <p>
        A model reads every pull request against rules the repository wrote itself (REVIEW.md and AGENTS.md) and posts one review with findings marked Important, Nit
        or Pre-existing. It comments; people decide and merge.
      </p>
    </div>
  </Section>

  <Section id="silent" title="Why some pull requests get nothing">
    <div class="prose">
      <p>
        One in four is in the silent group: reviewed and recorded, nothing posted. That is the control group, so the effect on the team can be measured. It is not a
        fault.
      </p>
    </div>
  </Section>

  <Section id="weeks" title="The six weeks" doc={['experiment', 'dates']}>
    <div class="prose">
      <p>
        Weeks 1 and 2, from {dates.start}, tighten the rules and do not count. Weeks 3 to 6, from {dates.measure}, are measured. The decision is made in the week of
        {dates.decision}; after that the review keeps running and the criteria stay on as health.
      </p>
      <p>
        The seven criteria measure whether the trust is earned: findings are right and get fixed, problems the checks miss get caught, speed does not drop and cost
        stays within budget. Each has a threshold and a read-when rule.
      </p>
    </div>
  </Section>

  <Section id="roles" title="What each role does">
    <dl class="facts">
      <dt>You open pull requests</dt>
      <dd>
        Answer every thread: fix and push, or reply "not fixing, because ...". Add the label <code>review again</code> for one more review after a large rework, and
        <code>escaped</code> on a fix for a bug the review could have seen. <a class="ds-link" href={docHref('working-with-the-review', 'answering-findings')}>Working with the review</a>
      </dd>
      <dt>You run the experiment</dt>
      <dd>
        The Monday checklist on Operations: changes, failed runs, cost, grading from week 3, the pulse survey in weeks 2 and 6.
        <a class="ds-link" href={docHref('runbook', 'every-monday')}>Runbook</a>
      </dd>
      <dt>You decide</dt>
      <dd>
        Read the seven criteria on the overview and what the rule says. Keep, adjust or stop in the week of {dates.decision}. Nothing to decide before {dates.measure}.
        A protocol change is only allowed to correct an error, and is logged with the reason.
      </dd>
    </dl>
  </Section>

  <Section id="words" title="The words used here">
    <dl class="facts">
      {#each words as [k, v] (k)}<dt>{k}</dt><dd>{v}</dd>{/each}
    </dl>
  </Section>
</div>
