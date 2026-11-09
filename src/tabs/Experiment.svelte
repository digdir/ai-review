<script lang="ts">
  import type { Metrics } from '../lib/compute';
  import { day, fmt } from '../lib/format';
  import { SETUP, SETUP_VERDICT, STATUS, VERDICT } from '../lib/labels';
  import { DAY } from '../lib/stats';
  import type { Data, ExperimentConfig } from '../lib/types';
  import StatusBoard from '../lib/ui/StatusBoard.svelte';

  let { data, m, config }: { data: Data; m: Metrics; config: ExperimentConfig } = $props();

  const facts = $derived([
    ['Repository', data.config.repo],
    ['Start', day(data.config.start + 'T12:00:00Z')],
    ['Baseline', `${day(data.config.baselineFrom + 'T12:00:00Z')} to ${day(m.startMs - DAY)}`],
    ['Decision', day(m.decisionMs)],
    ['Model', 'Claude Opus 5.5 through Azure AI Foundry, follow-up on Sonnet 5.5'],
    ['Budget', `NOK ${fmt(config.budgetNok)} a month`],
  ]);
  const catalogue = [
    ['Fix rate', 'Quality. Findings the follow-up confirmed fixed, divided by all findings on merged pull requests. By severity, finder, author and suggestion.'],
    ['Human fix rate', 'Quality. The same measure for human review comments, or published studies when the repository has too few.'],
    ['Precision', 'Quality. Share graded "right and worth it" in a hand-graded sample, with a 95% interval.'],
    ['Follow-up accuracy', 'Quality. Share of automatically resolved threads that really were fixed, from 40 checked by hand.'],
    ['Prompt versions', 'Quality. Fix rate and cost per version of the review instructions.'],
    ['Dismissed', 'Noise. Findings the author replied will not be fixed, divided by all findings.'],
    ['Ignored', 'Noise. Findings on merged pull requests with no reply and no fix.'],
    ['Findings per PR and per 100 lines', 'Noise. Mean and spread. High is not good in itself.'],
    ['Pre-existing', 'Noise. Findings about code the pull request did not change.'],
    ['Merged with open Important', 'Quality. Merged pull requests with an Important finding nobody fixed or dismissed.'],
    ['Time to first review', 'Delivery. From a pull request is opened to the first review posted.'],
    ['Time to merge', 'Delivery, guardrail. Median and p90, against the shadow group and the baseline.'],
    ['Merged without human review', 'Delivery, guardrail. Pull requests with no approval or comment from another person.'],
    ['Rework', 'Delivery, guardrail. Pull requests whose files a fix or revert pull request changes within 14 days.'],
    ['Failed CI on main', 'Delivery, guardrail. Share of CI runs on main that fail.'],
    ['Time in the merge queue', 'Delivery, guardrail. From queued to merged.'],
    ['Cost per reviewed PR and per fixed finding', 'Cost. NOK from Azure, with the model report until the invoice arrives.'],
    ['Projected month', 'Cost. Spent so far plus the daily average for the rest of the month, against the budget.'],
    ['Security findings and fix rate', 'Security. Findings from the security finder, and how many are confirmed fixed.'],
    ['Sensitive pull requests', 'Security. Changes to identity, guardrails, access, tenant separation, migrations, infrastructure or workflows, and whether a person and the review saw them.'],
    ['Risk section', 'Security. Pull requests with Risk filled in, and sensitive ones marked low.'],
    ['New CodeQL alerts', 'Security, guardrail. What the automated checks found, per week.'],
    ['Pulse', 'Experience. Two questions on a scale from 1 to 5, in weeks 2 and 6.'],
  ];
</script>

<div class="grid grid-2">
  <div class="ds-card panel" data-color="neutral">
    <div class="panel-head"><span>Go / no-go</span><span class="meta">{m.met}/{m.criteria.length} met · decision {day(m.decisionMs)}</span></div>
    <StatusBoard items={m.criteria} title={STATUS} verdict={VERDICT} />
  </div>
  <div class="ds-card panel" data-color="neutral">
    <div class="panel-head"><span>Setup</span><span class="meta">what must be in place</span></div>
    <StatusBoard items={m.setup} title={SETUP} verdict={SETUP_VERDICT} />
  </div>
</div>
<div class="grid grid-2">
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="xs">Hypothesis</h2>
    <p class="ds-paragraph">
      A model that reviews every pull request finds bugs that get fixed before they reach main, without slowing delivery or letting cost run away.
    </p>
    <h3 class="ds-heading" data-size="2xs">How it reviews</h3>
    <ol class="ds-list">
      <li>Five finders read the change at once: correctness, security, other paths to the same data, tests, and docs and rules.</li>
      <li>Each finding is checked by a separate agent that tries to prove it wrong.</li>
      <li>Everything that holds is posted together as one review with a summary.</li>
      <li>On each push, a follow-up job checks the open findings and resolves the ones that are fixed.</li>
    </ol>
  </div>
  <div class="ds-card" data-color="neutral">
    <h2 class="ds-heading" data-size="xs">Design</h2>
    <ul class="ds-list">
      <li><strong>Shadow group:</strong> a share of pull requests, chosen by number, get a review that runs without posting anything. That gives a real comparison.</li>
      <li><strong>Baseline:</strong> weekly numbers from three weeks before the start.</li>
      <li><strong>Novelty effect:</strong> weeks 1 and 2 against weeks 5 and 6.</li>
      <li><strong>Author kind:</strong> agent, human with AI or unknown, never per person.</li>
      <li><strong>Grading:</strong> about 35 findings a week, two people on 20% of them.</li>
      <li><strong>Pulse:</strong> two questions in weeks 2 and 6.</li>
    </ul>
    <dl class="defs" style="margin-top:var(--ds-size-4)">
      {#each facts as [k, v] (k)}<dt>{k}</dt><dd>{v}</dd>{/each}
    </dl>
  </div>
</div>
<details class="ds-details" data-color="neutral">
  <summary>Metric catalogue</summary>
  <div>
    <dl class="defs">
      {#each catalogue as [k, v] (k)}<dt>{k}</dt><dd>{v}</dd>{/each}
    </dl>
  </div>
</details>
<details class="ds-details" data-color="neutral">
  <summary>What we deliberately do not measure</summary>
  <div>
    <dl class="defs">
      <dt>Number of findings as success</dt><dd>Rewards noise. Shown only as a noise measure.</dd>
      <dt>"Time saved"</dt><dd>The model's own estimate, cannot be checked.</dd>
      <dt>"Bugs caught"</dt><dd>The model's claim, not a confirmed bug. Precision from grading replaces it.</dd>
      <dt>Coverage as a goal</dt><dd>Close to 100% when the review runs on every pull request. Shown as a health check.</dd>
      <dt>Numbers per person</dt><dd>Warned against in DORA, SPACE and DX, and may count as a control measure under chapter 9 of the Working Environment Act.</dd>
    </dl>
  </div>
</details>
<details class="ds-details" data-color="neutral">
  <summary>Privacy</summary>
  <div>
    <ul class="ds-list">
      <li>No usernames in the data, only the author kind.</li>
      <li>Only totals per repository and week. Cells with fewer than {config.minCell} pull requests are hidden.</li>
      <li>The text of the findings stays in GitHub. The dashboard links there.</li>
      <li>The assessment must be confirmed with the data protection officer.</li>
    </ul>
  </div>
</details>
