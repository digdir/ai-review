# Dashboard UI

The dashboard answers a few questions about the AI review for the people who work with it. This note says how it looks and why. It replaces the earlier "mission control" brief: a status board of coloured tiles, a "?" on every number, a sample-data switch and many panels on every page. People who saw it said it looked generated rather than designed, and we agreed.

## What we took from genki

The console and portal in genki use Designsystemet with the Digdir theme and Inter, and look calm. That comes from a few habits rather than from decoration:

- **One shell.** A dark neutral header with the brand and the few global controls, a left sidebar with grouped links, and the content in one column of at most 1200px. On narrow screens the sidebar becomes a menu button.
- **A page header.** A short context line (the organisation, here the repository), one large heading and one sentence of intro in subtle text. Nothing else above the content.
- **Numbers in a quiet row.** Four or so key figures as a definition list on a tinted background: label above, value below, no colour, no icons.
- **Tables for lists.** Designsystemet tables in a bordered region that scrolls on its own, never the page. Rows link onward.
- **Colour only for state.** Status is a Designsystemet tag (success, warning, danger, neutral) and exceptions are an alert at the top of the page. Everything else is neutral text with one accent colour for links and the current page.
- **Empty states and alerts** written as sentences.
- **Spacing from one scale** (the `--ds-size-*` steps), `data-size="md"` for text and `sm` for dense tables.

## What comparable dashboards do

We looked at GitHub Copilot metrics (including the new code review "addressed rate"), CodeRabbit's dashboard, Swarmia, Graphite Insights, LinearB, Sleuth, Google's Four Keys and how Anthropic reports on Claude Code review.

Worth copying:

- **One primary question per page.** Copilot has a dashboard per question; CodeRabbit splits quality from time.
- **Few headline numbers, each with its denominator or comparison.** Anthropic writes "16% to 54%" next to the baseline; Graphite and Sleuth compare with a control or the previous period. We always show n and the threshold.
- **A trend over time** rather than an all-time total (Swarmia and CodeRabbit use weekly lines).
- **From the number to the rows.** CodeRabbit opens the comment table from a stat; here every figure sits on the page that lists its rows.
- **Definitions in one place.** Every vendor keeps definitions on a separate page or section, not on each number. Copilot spells out exactly what "addressed" means.
- **Colour against a threshold only.** Four Keys and LinearB colour a figure only because a tier defines it.

To avoid: stat cards without a baseline, colour without a threshold, cost, quality and speed mixed on one page, rates without n, and means a single outlier skews.

## What made the old UI read as generated

- A status board of seven tiles, each with a coloured accent stripe, an uppercase eyebrow, a giant number and a "?" button.
- A "?" on every number (about 30 per page), so explanations competed with the figures.
- A "Start here" box of nine paragraphs above the content on the first visit, and a "What to do" grid of three cards at the bottom.
- Seven or eight panels per page, each with its own header style, meta text on the right and a different density.
- Jargon and mixed metaphors in headings ("Trust earned", "Cost sane", "Did it run", "Things to check out").
- Uppercase table headings, monospace dates, coloured left bars in the feed, meters with ticks inside a table row.
- The sample-data switch in the top bar of the real dashboard.
- At 390px the header wrapped into three lines and every page was a long column of boxes.

## Information architecture

| Page | The question it answers | What is on it |
| --- | --- | --- |
| Overview | Can we trust the AI review yet? | One sentence answer with the phase and what the decision rule says today, four figures, the weekly trend of fixed and dismissed findings, the seven criteria as a table, recent changes, and the comparison with published figures folded away |
| Pull requests | What did the review say on each pull request, and what waits on an answer? | Figures for the groups and open threads, the filter by username or number, the pull request table, merged with an Important thread open, reviewed against silent |
| Findings | Are the findings right, and do they get fixed? | Figures for fix rate, dismissed and response time, findings per week, by finder and by size, the findings table with filters, problems the review missed |
| Operations | Is the review running, and within budget? | Figures for collection, failed runs, review time and cost, runs per day, failed runs, cost this month, this week's checklist, setup, grading and CodeQL, run details |
| Repositories | Which repositories have the review, and how is each doing? | One table |
| Docs | How does it work? | Start here (the explainer and the words used), then the pages in `docs/` |

The repository picker sits in the sidebar above the repository pages. Old links (`#/<repo>/repository` and the older tab ids) still land on the page that took them over.

## Components

All in `src/lib/ui/`, built on Designsystemet CSS classes (`ds-table`, `ds-tag`, `ds-alert`, `ds-heading`, `ds-paragraph`, `ds-link`, `ds-button`, `ds-field`, `ds-input`, `ds-details`, `ds-skip-link`), the way genki uses the React components.

- `Shell`: skip link, header, sidebar navigation and main landmark.
- `PageHeader`: context line, heading, intro.
- `Section`: a heading, an optional one-line description and an optional link to the docs.
- `Stats`: a row of figures, each with a label, a value and a line of context (the denominator, a threshold or a comparison).
- `StatusTag`: Met, Not met, Too early, Done, To do, Later and the finding outcomes as Designsystemet tags.
- `TableRegion`: a labelled, focusable region that scrolls a wide table on its own; on narrow screens the main tables stack into labelled rows.
- `Definitions`: what each figure on the page means, where it comes from and the docs heading that explains it, in one folded section at the end of the page.
- `EmptyState`: one sentence in a dashed box.
- Charts: `Trend` (weekly lines with a threshold), `Columns` and `HBars`, all in neutral and accent colours, with the numbers in the accessible name.

## Removed, and why

- **The status board** (`Board`, `Tile`): its figures moved to the page that owns them (runs and collection to Operations, waiting threads and the queue to Pull requests, cost to the criteria and Operations).
- **The "?" explain buttons** (`Explain`, `ExplainBody`, `Stat`): each figure has a context line, and the meaning and source of every figure are in the Definitions section of its page and in the docs.
- **The Start here box and the What to do cards**: one Start here page under Docs, linked from the overview intro.
- **The phase strip and criteria meters**: the phase is one sentence; the criteria table shows the value, the threshold and the status.
- **The sample-data switch**: sample data stays for the tests and for `?sample=setup`, `?sample=measuring` or `?sample=after`, with a banner that says the numbers are made up.

## Before and after

Screenshots were taken at 1440 and 390 pixels, light and dark, against the week 5 sample. Before: a seven-tile board above a nine-paragraph box, coloured stripes, uppercase headings and question marks on every figure. After: the genki shell, one answer sentence and four figures at the top of the overview, tables for the lists, colour only in status tags and alerts, and the definitions folded at the end of each page.
