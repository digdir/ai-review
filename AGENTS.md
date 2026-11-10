# Agent notes

## Commands

- `npm ci` installs exact versions from the lockfile.
- `npm run collect` writes `data/repos/<owner>/<name>.json` and `data/index.json` for each file in `repos/` (needs `gh auth login` and `az login`).
- `npm run dev` starts the dashboard with hot reload.
- `npm run build` writes the static site to `dist/`. It needs `data/repos/`.
- `npm run preview` serves `dist/`.
- `npm test` runs the Vitest tests.
- `npm run check` runs svelte-check (types and Svelte diagnostics) and the tests. Run it before handing work over.

## Layout

- `repos/<owner>/<name>.json`: one settings file per repository, checked by `dashboard/repos.mjs`.
- `dashboard/collect.mjs`: data collection, plain Node, not part of the frontend.
- `src/lib/compute.ts`: all metrics, pure and typed. Change numbers here and test them in `compute.test.ts`.
- `src/lib/sample.ts`: deterministic sample data in the real shape, behind "Sample data".
- `src/lib/format.ts`, `src/lib/stats.ts`, `src/lib/labels.ts`: formatting, statistics and labels.
- `src/lib/ui/`: shared pieces: the status board, criteria, meters, explain panels, the phase strip.
- `src/lib/compare.ts`: published figures for "How we compare", each with its source and caveat.
- `src/views/Fleet.svelte`: the Repositories screen. `src/views/Start.svelte`: Start here. `src/views/Repo.svelte`: one repository's screens.
- `src/screens/`: Overview, Repository, Findings and Operations. `src/App.svelte`: top bar and routing (`src/lib/route.ts`). `src/lib/fleet.ts`: one row per repository.
- `src/app.css`: page styles on top of Designsystemet (`@digdir/designsystemet-css` and the Digdir theme).
- `public/staticwebapp.config.json`: login and CSP for Azure Static Web Apps, copied to `dist/`.

## Rules

- Use Svelte 5 runes (`$state`, `$derived`, `$props`, `$bindable`, snippets, `onclick`). Never Svelte 4 syntax (`export let`, `$:`, `on:click`, slots, stores for local state).
- Run the `svelte-autofixer` tool from the Svelte MCP server (`.mcp.json`) on every component you write or change, until it reports no issues.
- Everything in English: identifiers, file names and the text shown to users. Use the plain technical term (finding, fix rate, rework), never a translation of it.
- Every number on screen says what it means: an explain panel (`means`, `source`, `doc`) on each `Stat` and tile, and a target or comparison in its subline.
- Keep the privacy rule: cells with fewer than `minCell` pull requests are hidden. No logins in the data, only `author_hash`; never show a login on screen.
- Use the protocol's words: Met, Not met, Too early; Keep, adjust, stop; reviewed and silent group. Never GO, NO-GO, HOLD or FAULT.
- Pin dependencies to exact versions, published at least two weeks earlier.
