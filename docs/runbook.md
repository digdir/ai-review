# Runbook

For the lab members who run the review and the experiment: the weekly routine, what to do when something breaks, and everything that was set up and where.

## Every Monday

A workflow opens an issue **Experiment week N of 6** in this repository each Monday morning, with last week's numbers and this checklist. Work through it and close the issue.

1. **Changes.** The issue lists the review setup that changed last week. Changes to `REVIEW.md`, `AGENTS.md`, `CLAUDE.md`, the security checklist, the review workflows and the review skill are found automatically from merged pull requests. Check that the kind is right. Add anything changed outside the repository (the model deployment, a repository variable, the budget) to `inputs/<owner>/<name>/changes.json`. See [the change log](experiment.md#the-change-log).
2. **Failed runs.** Open Operations on the dashboard. A failed review means a pull request got no review; see [When a review fails](#when-a-review-fails).
3. **Cost.** Compare the month's projection with the cap under Operations.
4. **Grading**, weeks 3 to 6. Draw the sample and give it to the two graders; see [grading.md](grading.md).
5. **Pulse survey**, end of weeks 2 and 6. Send the three questions and enter the answers in `inputs/<owner>/<name>/pulse.json`.
6. **Missed problems.** The issue lists pull requests labelled `escaped`. Check that each was a problem the review had a chance to see.
7. **Week 6.** Book the decision meeting and start the report, as [the protocol](experiment.md#report) says.

## When a review fails

| What you see                    | Likely cause                                               | What to do                                                                                               |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The run fails at Azure login    | The federated credential or a repository variable is wrong | Check `AZURE_REVIEW_*` in the repository's variables and the federated credential on the review identity |
| The run fails calling the model | Quota, a removed deployment, or the model name changed     | Check the deployment in the Foundry resource. A model change is logged as kind `model`                   |
| The run times out               | A very large pull request                                  | Add `review again` once. If it fails again, review locally and say so in the pull request                |
| No run at all                   | Draft, Renovate, a fork, or the workflow was edited        | Expected for the first three. Otherwise check the Actions tab                                            |

A failed run does not block the pull request. It is recorded and shows on the dashboard.

## When the budget alerts

The budget `budget-genki-review` alerts at 80 and 100 percent of NOK 7,500 a month, and when the forecast passes 100.

1. Look at Operations on the dashboard: is it more pull requests, larger pull requests or more `review again`?
2. If the month will go over, in this order: limit `review again`, use a cheaper model for the review, or pause the review by disabling the workflow. Log each as a change.
3. Tell the approvers if the cap will be passed.

## When the dashboard is stale or down

- **Numbers are old.** The dashboard rebuilds every twenty minutes on weekdays, 05 to 17 UTC, and every hour otherwise. Run the `dashboard` workflow by hand to rebuild now.
- **Code scanning shows "–".** The repository's `review snapshot` workflow has not run, or its artifact is older than 7 days. Run it by hand in that repository.
- **Sign-in fails.** Check that the app registration has admin consent and that its secret has not expired. The secret runs out on **2027-11-09**; renew it before then and update `AAD_CLIENT_SECRET` on the Static Web App.
- **Deploy fails.** Usually the workflow identity lost its role on the Static Web App.

## What is set up

All in the lab's Azure subscription and its tenant, resource group `rg-genki-review-swc`, Sweden Central unless noted.

| Resource                  | What it does                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `genki-review-ai`         | Foundry resource with the review models. Key login is off                                                                                                                             |
| `id-genki-review`         | Identity the review workflow signs in as. Cognitive Services User on `genki-review-ai`, federated to genki's pull requests                                                            |
| `budget-genki-review`     | NOK 7,500 a month, alerts at 80 and 100 percent and on forecast                                                                                                                       |
| `swa-ai-review`           | Static Web App (Standard, West Europe) that serves the dashboard                                                                                                                      |
| `id-ai-review-dashboard`  | Identity the dashboard workflow signs in as. Contributor on the Static Web App, Cost Management Reader on the resource group, federated to this repository's `production` environment |
| `ai-review-dashboard-sso` | App registration for sign-in to the dashboard. Its secret is in the Static Web App's app settings                                                                                     |
| `ai-review.digdir.cloud`  | DNS zone for the dashboard's own address, delegated from `digdir.cloud`                                                                                                               |

**In genki.**

| Setting                                                                                   | Value                                                                |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Variables `AZURE_REVIEW_CLIENT_ID`, `_TENANT_ID`, `_SUBSCRIPTION_ID`, `_FOUNDRY_RESOURCE` | The review identity and the Foundry resource                         |
| Variable `REVIEW_SHADOW_PERCENT`                                                          | 25. Never change it during the experiment                            |
| Workflows `review.yml`, `review-snapshot.yml`                                             | The review, and the daily code scanning snapshot                     |
| Labels `review again`, `escaped`                                                          | Run the review once more; mark a fix for a problem the review missed |
| `REVIEW.md`, `.github/review-security.md`, `.claude/skills/review-change`                 | The rules and the procedure                                          |

**In this repository.**

| Setting                                 | Value                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Environment `production`                | Variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `SWA_NAME`, `SWA_RESOURCE_GROUP` |
| Workflows `dashboard.yml`, `weekly.yml` | The scheduled rebuild, and the Monday issue                                                               |
| `repos/`, `inputs/`                     | Settings per repository, and the hand-entered experiment data                                             |

How each piece was set up, if it has to be done again, is in the [README](../README.md#setup).

## Records

- Run records: an artifact on every review run in the repository, kept 90 days.
- Dashboard data: an artifact on every dashboard run here, kept 90 days.
- At the decision the final data is committed under `records/`, with the report.
