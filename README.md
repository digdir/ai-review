# ai-review

The dashboard for Digdir's AI code review experiment. It shows, for each repository that uses the review, whether it meets the criteria in the approved proposal: findings that lead to a change, noise, time to merge, rework and cost. [digdir/genki](https://github.com/digdir/genki) is the first.

Later this repository will also hold the reusable review workflow and its config, so other repositories can use the same review.

## How it works

A scheduled workflow runs every hour on weekdays:

1. `dashboard/collect.mjs` reads pull requests, review threads, run records, CI, the daily review snapshot (CodeQL alerts and shadow share) and Azure cost for each repository in `repos/`, and writes `data/repos/<owner>/<name>.json` and `data/index.json`. A repository that fails is marked on the overview and does not stop the others. It stores no logins.
2. `npm run build` builds the dashboard with Vite into `dist/`, with the data bundled in, so the result is a static site.
3. The workflow deploys `dist/` to Azure Static Web Apps. Only accounts in the tenant that holds the Static Web App can open it.

The dashboard opens on an overview of every repository (`#/`), and each repository has its own tabs (`#/<owner>/<name>/<tab>`). It is Svelte 5 and TypeScript, built with Vite, without SvelteKit. The metrics live in `src/lib/compute.ts`, one component per tab in `src/tabs/`. The text is in English. Styles come from Designsystemet (`@digdir/designsystemet-css` and the Digdir theme). See `AGENTS.md` for the layout and commands.

`inputs/<owner>/<name>/grading.json` and `pulse.json` are optional. When present, the dashboard shows hand grading and pulse survey results.

## Repositories

Each repository on the dashboard has one settings file, `repos/<owner>/<name>.json`:

```json
{
  "repo": "digdir/genki",
  "baselineFrom": "2026-10-19",
  "start": "2026-11-09",
  "workflows": { "review": "review.yml", "ci": "ci.yml" },
  "azure": { "subscription": "…", "resourceGroup": "…" },
  "experiment": { "weeks": 6, "budgetNok": 7500, "minCell": 5 }
}
```

`azure` is optional; without it, cost is taken from the run records. The repository must be public, since the workflow reads it with its own token. See [docs/platform.md](docs/platform.md) for where this is going.

## Run it locally

```sh
gh auth login
az login
npm ci
npm run collect
npm run dev
```

`npm run build` and `npm run preview` show the built site. Opening `dist/index.html` straight from disk does not work, since browsers block module scripts on `file://`.

Tick "Sample data" in the top bar to see it with sample data in the real shape.

`npm run check` runs svelte-check and the unit tests. The workflow runs it before each deploy.

## Setup

These are done once, by someone with rights in the digdir organisation and the Azure subscription.

**Azure.**

- A Static Web App on the Standard plan, which custom login needs. Store its name and resource group as the variables `SWA_NAME` and `SWA_RESOURCE_GROUP`.
- An Entra app registration for login, in the same tenant as the subscription, single tenant, with redirect URI `https://<host>/.auth/login/aad/callback`. Set the app settings `AAD_CLIENT_ID` and `AAD_CLIENT_SECRET` on the Static Web App. The secret lasts a year, so renew it before it runs out.
- An Entra identity for the workflow with a federated credential for the `production` environment of `digdir/ai-review` (GitHub sends the subject as `repo:digdir@<owner id>/ai-review@<repo id>:environment:production`). Give it Contributor on the Static Web App and Cost Management Reader on the review's resource group. Store `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` as variables.

No deployment token is stored: the workflow fetches it with its Azure login on each run.
