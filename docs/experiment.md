# The experiment

The protocol for the six-week AI code review experiment in [digdir/genki](https://github.com/digdir/genki). It is written before the results, so the decision after week 6 follows rules set in advance and not ones chosen after seeing the numbers. A change to this file after the start is logged in [the change log](#the-change-log) with the reason.

## Question

We want to speed up development without getting lost in AI-generated code; the review exists so we can trust pull requests more without introducing bad code.

Does an AI review against rules the repository writes itself make changes safer without making the team slower, at a cost worth paying?

|     | Hypothesis                                                                                   | Answered by                                                                     |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| H1  | The review finds problems the automated checks miss, often enough to be worth the cost.      | Fix rate, dismissed rate, hand-graded precision, Important findings fixed, cost |
| H2  | When the rules are in files the agents read, the agents repeat the same mistakes less often. | Recurrence after a rule is added, early against late fix rate                   |
| H3  | This works without required human approval and without slowing the team down.                | Time to merge and rework, silent group against reviewed group                   |

## Dates

| Period        | Dates                    | What counts                                                                 |
| ------------- | ------------------------ | --------------------------------------------------------------------------- |
| Baseline      | 2026-10-19 to 2026-11-08 | Pull requests merged before the review, for rework and the weekly trend     |
| Weeks 1 and 2 | 2026-11-09 to 2026-11-22 | Setting up and tightening the rules. Reported, but not part of the decision |
| Weeks 3 to 6  | 2026-11-23 to 2026-12-20 | The measurement. The decision rests on these weeks                          |
| Decision      | Week of 2026-12-21       | Keep, adjust or stop                                                        |

Rework needs 14 days after a merge, so the rework numbers for week 6 are read on 2027-01-04.

## Design

**Unit.** One pull request in digdir/genki, opened by a person or an agent on a person's behalf. Pull requests from Renovate and other bots, from forks, and drafts are not reviewed and are left out.

**Groups.** When a pull request opens, its number decides its group: `(number × 37) mod 100 < REVIEW_SHADOW_PERCENT` puts it in the silent group. The share is 25 percent. The silent group is reviewed and recorded the same way, but nothing is posted. The others get the review on the pull request. Multiplying by 37 spreads the silent group evenly over time, so the two groups come from the same weeks.

**What is compared.**

- Effect on the team (H3): reviewed against silent pull requests from the same weeks. The baseline is only a fallback when the silent group has fewer than 10 merged pull requests.
- Quality of the findings (H1): the findings themselves, from both groups. Findings from the silent group were never seen, so their grading is not affected by the answer.

**Crossing over.** Adding the `review again` label always posts. A silent pull request that gets the label is counted in the group it started in, and the number of crossovers is reported.

**What cannot be hidden.** Authors see whether their pull request got comments, so they know their group. Anyone may run the same review locally before opening a pull request, in both groups. Both are reported, not controlled.

## Measures and thresholds

The thresholds are the defaults in [`src/lib/compute.ts`](../src/lib/compute.ts). The dashboard shows each as early, met or not met.

| Measure              | Definition                                                                                                             | Continue if                     | Read when                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------- |
| Important fix rate   | Share of Important findings on merged pull requests answered as fixed                                                  | At least 50 %                   | At least 10 findings        |
| Dismissed            | Share of posted findings answered as not fixed                                                                         | Under 50 %                      | At least 20 findings        |
| Precision            | Share of graded findings graded right and worth fixing                                                                 | At least 70 %                   | At least 50 graded          |
| Missed by the checks | Important findings answered as fixed on merged pull requests. A merge needs green CI, so the checks did not catch them | At least 3                      | From week 3                 |
| Time to merge        | Median hours from opened to merged, reviewed against silent                                                            | At most 20 % higher             | At least 20 reviewed merged |
| Rework               | Share of merged pull requests whose files a fix pull request changes within 14 days                                    | At most 5 points above baseline | At least 20 settled         |
| Cost                 | Azure cost of the review resource group, projected to the month                                                        | At most NOK 7,500               | From day 5                  |

The approved proposal says to stop if more than half the findings are dismissed even after the rules are tightened, if the review only finds what CI finds, if time to merge rises noticeably without better quality, or if the cost goes over the cap and cannot be brought down. The thresholds above are those rules made measurable.

**Decision.**

- **Keep**: all criteria met at week 6.
- **Adjust**: a criterion is missed, but the change log points to a fix that has not yet had time (a rule, a cheaper model, fewer runs). Run four more weeks with that one change.
- **Stop**: precision or the dismissed rate misses its threshold after the rules were tightened, or the cost cannot be brought under the cap.

**After the decision.** The review keeps running and the seven criteria stay on as health, read over the last four weeks with the same thresholds. A criterion outside its threshold goes to the lab's Monday checklist, not to a new decision. Grading stops after week 6 unless the change log says it continues.

**H2** has no threshold, because six weeks is too short to show it with confidence. It is reported as a description: for each rule added to `REVIEW.md` or `AGENTS.md`, the number of findings of the same kind in the two weeks before and after, plus the fix rate in weeks 1 and 2 against weeks 5 and 6.

## What may change during the experiment

| Change                                                       | Allowed                                      | How it is recorded                                                                          |
| ------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A rule in `REVIEW.md`, `AGENTS.md` or the security checklist | Yes, this is part of the method              | In the change log, kind `rule`                                                              |
| The model, the review procedure or the workflow              | Only to fix a fault or to stay under the cap | Kind `model`, `procedure` or `workflow`. The weeks before and after are reported separately |
| The silent share                                             | No                                           |                                                                                             |
| The thresholds in this file                                  | No, except to correct an error               | Kind `protocol`, with the reason                                                            |

## The change log

Changes made by a merged pull request in genki are found automatically: `REVIEW.md`, `AGENTS.md`, `CLAUDE.md` and `.github/review-security.md` as kind `rule`, the review workflows and scripts as `workflow`, and the review skill as `procedure`. Everything else, such as the model deployment, a repository variable or the graders, goes in `inputs/digdir/genki/changes.json` in this repository, one entry for each change, added in the same week:

```json
[
  {
    "date": "2026-11-09",
    "kind": "workflow",
    "ref": "digdir/genki#424",
    "note": "Daily snapshot of code scanning for the dashboard. The review is unchanged."
  }
]
```

`kind` is one of `rule`, `model`, `procedure`, `workflow`, `setup` or `protocol`. `ref` is the pull request that made the change. Three optional fields:

- `because`: why the change was made, in one sentence. The dashboard shows it with the change.
- `item`: which setup step an entry completes, one of `silent-share`, `protocol`, `graders`, `privacy`, `channel` and `sign-in`. The dashboard's setup list reads these. After the decision, an entry of kind `protocol` with item `grading` says grading continues.
- `outcome`: on the entry of kind `protocol` that records the decision, `keep`, `adjust` or `stop`.

## Hand grading

From week 3, two graders each grade the same sample, without knowing which group a finding came from or how it was answered.

- **Sample.** Each Monday, up to 15 findings from the week before, drawn at random from both groups, with every Important finding included. About 50 over weeks 3 to 6.
- **What a grader sees.** The finding, the lines it points to and the diff of the pull request at the time. Not the thread, not the outcome, not the group.
- **Grades.** `right_worth` (correct and worth changing), `right_not_worth` (correct but not worth the time), `wrong` (the claim does not hold) and `unclear` (cannot tell from the diff).
- **Agreement.** Cohen's kappa between the two graders. Where they disagree, they agree on one grade together, and that grade counts.
- **Follow-up checks.** For a sample of findings the cheaper model marked fixed after a push, whether they were fixed.

How to draw the sample, grade and merge the grades is in [grading.md](grading.md). The results go in `inputs/digdir/genki/grading.json`. The graders are named in the change log when they start.

## Pulse survey

At the end of weeks 2 and 6, three questions to everyone who opened a pull request in the period: was the review useful, was it noise, did it change how you work. The answers go in `inputs/digdir/genki/pulse.json`, with no names.

## Problems the review missed

When a merged change turns out to have a bug, the pull request that fixes it gets the label `escaped` in genki if the review had a chance to see the bug. This is the other side of "finds problems the checks miss", and it is reported with the findings.

## Records

- The review uploads a run record for every run, kept 90 days in genki.
- Each dashboard run uploads the collected data as an artifact, kept 90 days.
- At the decision, the final data is committed under `records/digdir/genki/` together with the report, so the result can be checked after the artifacts expire.

## Privacy

- No GitHub logins are stored. Each pull request carries a SHA-256 hash of its author's login, lowercased, computed by the collector. The dashboard's username filter hashes what the viewer types in the browser and compares the two; the username never leaves the browser and is not shown on any pull request.
- The hash is a pseudonym, not anonymous: anyone who knows a login can compute its hash and find that person's pull requests. The repository is public, so the same is already visible on GitHub; the hash keeps logins out of the collected data and the dashboard.
- Only totals per repository and week are shown. Cells with fewer than `minCell` pull requests are hidden.
- The text of each finding stays in GitHub. The dashboard shows its title, the first line, and links to the thread.
- The pulse survey is stored with no names.
- The assessment is confirmed with the data protection officer before week 3.

## Report

A short report in Norwegian to the lab after week 6, and the outcome on the approved proposal in Confluence:

1. The decision and the criteria behind it.
2. Each measure, for weeks 3 to 6 and for weeks 1 and 2.
3. The change log, and what each rule change did.
4. H2, as a description.
5. What the review missed.
6. What it cost, per review and per month.
7. What another repository needs to start, if the review stays.
