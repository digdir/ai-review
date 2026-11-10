# From one repository to many

A proposal for turning the genki review and its dashboard into something any Digdir repository can join. It can be reworked.

## What a repository gets

1. **The review**, as a reusable workflow in this repository. The repository adds one short caller workflow and a `REVIEW.md` with its own rules.
2. **A page on the dashboard**, with the same screens as genki has today, and a row on the Repositories screen.
3. **Its own settings**, in one file in this repository: when it started, which CI workflow counts, its budget, and whether it runs the experiment with a silent group.

Joining is config, not code: one pull request here and one in the repository. No admin screen until the config proves too hard.

## The review moves here

Today `review.yml`, `scripts/review-run.ts`, `scripts/review-summary.ts` and the review skill live in genki. They move to this repository:

- `.github/workflows/review.yml` becomes `workflow_call`, with inputs for the model, the shadow share and the path to the repository's `REVIEW.md`.
- The scripts and the review procedure are checked out from this repository at the pinned commit, so a pull request can never change the code that runs with the review's token. This replaces the base-branch workaround in genki.
- A repository pins the workflow to a full commit SHA. Renovate proposes updates, so each repository chooses when a new review version reaches it.
- genki becomes the first caller, and its run records must keep the same shape so the dashboard's history stays whole.

The caller in a repository:

```yaml
name: review
on:
  pull_request:
    types: [opened, ready_for_review, synchronize, labeled]
permissions:
  contents: read
jobs:
  review:
    uses: digdir/ai-review/.github/workflows/review.yml@<sha>
    permissions:
      contents: read
      pull-requests: write
      id-token: write
```

## Settings per repository

`repos/<owner>/<name>.json` replaces `config.json`:

```json
{
  "repo": "digdir/genki",
  "start": "2026-11-09",
  "baselineFrom": "2026-10-19",
  "ci": "ci.yml",
  "budgetNok": 7500,
  "experiment": { "weeks": 6, "minCell": 5 }
}
```

A repository without `experiment` gets the review and the plain numbers (findings, fixes, noise, time to merge, cost), without arms and significance. `npm run add-repo digdir/<name>` writes the file, checks that the repository is public, and prints the caller to paste.

## Collecting

- `collect.mjs` loops over `repos/`, writes `data/<owner>/<name>.json` and an `index.json`, and keeps its cache per repository. One repository that fails is reported on the overview and does not stop the others.
- The workflow reads each repository with its own token, so a repository must be public. That token cannot read a repository's code-scanning alerts, so each repository runs a small `review-snapshot` workflow once a day that writes its CodeQL alerts and shadow share to an artifact, and the collector reads that. Without a snapshot, code scanning shows as not available.
- **Cost.** Azure cost per resource group only works for genki, which has its own. For the rest, cost comes from the tokens in each run record times the model price, with the Azure total for the shared Foundry resource as a check.

## The dashboard

- **Oversikt** (new first page): one row per repository with its status (GO, NO-GO, STANDBY, HOLD), pull requests reviewed this week, the share of findings that led to a change, noise, cost against budget, and the last run. Click a row to open it.
- **One repository**: the same screens, at `#/<owner>/<name>/<screen>`.
- The privacy rule stays per repository: cells with fewer than `minCell` pull requests are hidden. Small repositories will show little until they have volume, and the page says so.

## Who sees what

The data holds pull request titles and file paths. That is fine for public repositories, but for a private one it shows its titles to everyone who can open the dashboard. Two ways:

- **Public repositories only** for now. Simple, and the login stays as it is.
- **Private repositories too**, with a role per repository in the Static Web App, given from Entra groups, and the data split so a viewer downloads only the repositories they may see. This needs an API in front of the data, not a static file.

Proposed: public repositories only until a private one asks.

## Order

1. Settings per repository and the overview page, with genki as the only entry. No change in what genki sees. Done.
2. Code scanning through a daily snapshot in each repository, so no GitHub App is needed.
3. After the experiment's week-6 decision, if the review stays: move it here as a reusable workflow and switch genki to call it. Not before, so the setup being measured does not change halfway.
4. A second repository, chosen together with its team, joins as [joining.md](joining.md) says. Whatever was hard there goes into the README.
5. Cost from run records, so repositories without their own resource group get a cost.

## Open questions

- Which repositories come second and third, and who owns them.
- Whether the model and the Foundry resource are shared, or each team brings its own.
- Who may change `repos/`: the lab only, or each team for its own file (CODEOWNERS).
- Whether a repository that is not in the experiment counts toward the experiment's report.
