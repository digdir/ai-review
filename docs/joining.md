# Joining the review

How another repository gets the AI code review and a page on the dashboard. genki is the first repository and the model for the rest. This describes the setup after the experiment's week-6 decision, when the review has moved here as a reusable workflow. Until then, a repository can only join the dashboard, with steps 5 and 10.

A repository must be public. Joining is a pull request in the repository and one here.

## What the repository writes itself

The review is only as good as the rules it reviews against, and those rules belong to the repository's own team.

1. **`AGENTS.md`** (and a `CLAUDE.md` that includes it): what the repository is, its commands, where things are, and the mistakes it has had to fix more than once. Coding agents read it; the review reads it too.
2. **`REVIEW.md`**: what counts as Important in this repository. Start from [the template](#reviewmd-template) and replace the list with the repository's own risks. Keep the caps and the evidence rule.
3. **`.github/review-security.md`**, if the repository has parts where a mistake is a security problem (auth, data access, infra, workflows): the paths that count as sensitive and what to check there.
4. **Pull request template** with **Risk** (low, or sensitive because of what it touches) and **Undo** (revert is enough, or the data or infra step it needs).

## What the repository adds

5. **`.github/workflows/review-snapshot.yml`**, copied from genki unchanged. It runs once a day with read access to code scanning only, and gives the dashboard the CodeQL alerts it cannot read itself.
6. **The caller workflow**, about fifteen lines, pinned to a commit of this repository. See [platform.md](platform.md#the-review-moves-here).
7. **A label `review again`**, which runs the review once more on a pull request.

## What the lab sets up

8. **A federated credential** on the review identity for the repository's pull requests, so the review can call the model without a stored key.
9. **A budget**, either the repository's own or its share of the lab's, with alerts at 80 and 100 percent.
10. **`repos/<owner>/<name>.json`** here, with the repository's start date, its CI workflow and, if it runs the experiment, the experiment settings.

## How it is used

- The review comments; it never approves, blocks or merges. People decide.
- Every finding gets an answer in its thread: fixed, or not fixed and why.
- When the review misses something or reports noise, change `REVIEW.md` or `AGENTS.md`, not the prompt. A mistake that comes back gets a rule, and a test if a test can hold it.
- At most three review rounds per pull request.

## `REVIEW.md` template

```markdown
# Review instructions

## What Important means here

Mark a finding Important only when the change would:

- <the repository's own risks, one line each>
- make a doc or decision record say something the code does not do

Everything else is Nit at most.

## Cap the nits

Report at most three Nits per review. Report Pre-existing problems in
lines the pull request did not touch only when they are Important, at
most two.

## Do not report

- Anything CI already enforces
- Lock files and generated files

## Always check

- Every new rule has a test whose name states it. A bug fix has the
  regression test that would have caught it.

## Evidence

A claim about behaviour cites the file and line it comes from. If you
cannot point to the line, ask a question instead of reporting a finding.
```
