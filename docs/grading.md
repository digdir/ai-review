# Grading findings

Fix rates say what authors did with a finding, not whether it was right. Grading checks that: two people read a sample of findings without knowing which group they came from or how they were answered, and say whether each was right and worth fixing. It answers the precision criterion in [the protocol](experiment.md#hand-grading).

## Who and when

- Two graders, the same two for weeks 3 to 6. They are named in the change log when they start.
- On the Monday after each of weeks 3 to 6, the lab draws a sample of up to 15 findings from that week. The weekly issue gives the command. Grading one takes a few minutes; a week's sample, under an hour each.
- Grade on your own, then compare.

## Draw the sample

```sh
npm run collect
npm run grading-sample -- --repo digdir/genki --week 3
```

This writes `grading/digdir/genki/week-3/`:

- `sheet.md`: the findings to grade, each with an id, its severity, the file and line, the text and a link to the diff. No group, no outcome, no thread.
- `grades-template.json`: one row per id with an empty grade. Each grader copies it to `grades-<initials>.json`.
- `key.json`: which pull request, group and outcome each id belongs to. Graders do not open it.

`grading/` is not committed, since the key would show graders the groups. Send each grader the sheet and the template directly.

Every Important finding of the week is in the sample, and the rest are drawn at random from both groups. Findings come from the run records, which hold the silent group's findings too, and the sheet shows only each finding's title so a posted comment cannot give its group away. The draw is seeded, so running it again gives the same sample.

## How to grade

Read the finding, then the lines it points to and the diff around them. Do not open the pull request's conversation: the replies and the outcome would decide for you.

| Grade             | When                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `right_worth`     | The claim holds, and a careful reviewer would want it changed before merge.                                              |
| `right_not_worth` | The claim holds, but changing it is not worth the time: taste, a corner that cannot happen, a cost higher than the gain. |
| `wrong`           | The claim does not hold. The code does not do what the finding says, or the rule it cites does not apply.                |
| `unclear`         | You cannot tell from the diff and the code. Use it rarely.                                                               |

Judge the claim, not the wording. A right finding with a poor suggestion is still right. Severity is not graded; a right Nit is `right_worth` if you would want it fixed.

**Examples from genki.**

- "This route takes the tenant from the path instead of the verified token": check the route. If it does, `right_worth`.
- "Rename this variable for clarity": `right_not_worth` unless the name is actually misleading.
- "This test depends on today's date": check the test. If it uses a fixed clock, `wrong`.

## Merge the grades

When both have graded, compare. Where you disagree, agree on one grade together and write it in `agreed.json` (same shape, only the ids you disagreed on).

```sh
npm run grading-merge -- --repo digdir/genki --week 3 \
  --graders grading/digdir/genki/week-3/grades-ab.json grading/digdir/genki/week-3/grades-cd.json \
  --agreed grading/digdir/genki/week-3/agreed.json
```

This computes the agreement between the two graders (Cohen's kappa), takes the agreed grade where they differed, and writes the week into `inputs/digdir/genki/grading.json`. Running it again for the same week replaces that week. Commit `inputs/digdir/genki/grading.json`; the `grading/` folder stays local.

A kappa under 0.4 means the grades are not reliable yet: talk through the disagreements and tighten your shared reading of the grades before the next week.
