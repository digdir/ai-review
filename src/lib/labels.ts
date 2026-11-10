import type { Check, Decision, Phase, Status } from './types';

export const SEVS = ['Important', 'Nit', 'Pre-existing'] as const;
export const CATS = ['correctness', 'security', 'other-paths', 'tests', 'docs'] as const;

export const CAT: Record<string, string> = { security: 'Security', correctness: 'Correctness', 'other-paths': 'Other paths', tests: 'Tests', docs: 'Docs and rules' };
export const JOB: Record<string, string> = { review: 'Review', 'follow-up': 'Follow-up' };

export const OUT: Record<string, [string, string]> = {
  fixed: ['Fixed', 'The author answered fixed and the follow-up confirmed the problem is gone'],
  resolved: ['Resolved', 'A person resolved the thread without a confirmed fix'],
  outdated: ['Outdated', 'The lines changed, fix not confirmed'],
  dismissed: ['Dismissed', 'The author replied that it will not be fixed'],
  discussed: ['Discussed', 'Replies in the thread, not settled'],
  open: ['Open', 'No reply yet'],
  recorded: ['Recorded, not posted', 'A silent-group finding that was never posted'],
};

export const STATUS: Record<Status, string> = { met: 'Met', notmet: 'Not met', early: 'Too early' };
export const CHECK: Record<Check, string> = { done: 'Done', todo: 'To do', later: 'Later' };
export const DECISION: Record<Decision, string> = { keep: 'Keep', adjust: 'Adjust', stop: 'Stop' };
export const PHASE: Record<Phase, string> = { setup: 'Setup', measuring: 'Measuring', after: 'After the experiment' };

export const QUESTION = {
  right: 'Are the findings right, and do they get fixed?',
  checks: 'Does it catch what the checks miss?',
  slow: 'Is it slowing us down?',
  cost: 'Is the cost sane?',
  trust: 'Can we trust the review?',
} as const;

export const PURPOSE =
  'We want to speed up development without getting lost in AI-generated code; the review exists so we can trust pull requests more without introducing bad code.';

export type CriterionKey = 'fix' | 'dismissed' | 'precision' | 'missed' | 'ttm' | 'rework' | 'cost';

export interface CriterionDef {
  key: CriterionKey;
  question?: string;
  name: string;
  rule: string;
  read: string;
  means: string;
  source: string;
  doc: [string, string];
}

export const CRITERIA: CriterionDef[] = [
  {
    key: 'fix',
    question: QUESTION.right,
    name: 'Important fix rate',
    rule: 'At least 50%',
    read: 'At least 10 findings',
    means: 'Share of Important findings on merged pull requests that the author answered as fixed and the follow-up confirmed.',
    source: 'Review threads in GitHub, joined with the follow-up run records.',
    doc: ['experiment', 'measures-and-thresholds'],
  },
  {
    key: 'dismissed',
    name: 'Dismissed',
    rule: 'Under 50%',
    read: 'At least 20 findings',
    means: 'Share of posted findings the author answered as not fixed. The main sign of noise.',
    source: 'Review threads in GitHub, reviewed group only.',
    doc: ['experiment', 'measures-and-thresholds'],
  },
  {
    key: 'precision',
    name: 'Precision',
    rule: 'At least 70%',
    read: 'At least 50 graded',
    means: 'Share of hand-graded findings graded right and worth fixing, by two graders who do not see the group or the outcome.',
    source: 'inputs/<owner>/<name>/grading.json, written by npm run grading-merge each Monday from week 3.',
    doc: ['experiment', 'hand-grading'],
  },
  {
    key: 'missed',
    question: QUESTION.checks,
    name: 'Missed by the checks',
    rule: 'At least 3',
    read: 'From week 3, judged in week 6',
    means: 'Important findings answered as fixed on merged pull requests. A merge needs green CI, so the automated checks did not catch them.',
    source: 'The same threads as the fix rate; the count rather than the share.',
    doc: ['experiment', 'measures-and-thresholds'],
  },
  {
    key: 'ttm',
    question: QUESTION.slow,
    name: 'Time to merge',
    rule: 'At most 20% higher',
    read: 'At least 20 reviewed merged',
    means: 'Median hours from opened to merged, reviewed group against the silent group from the same weeks. The baseline is only a fallback when the silent group has fewer than 10 merged.',
    source: 'Pull request timestamps from GitHub; the group from the run record.',
    doc: ['experiment', 'design'],
  },
  {
    key: 'rework',
    name: 'Rework',
    rule: 'At most 5 points above baseline',
    read: 'At least 20 settled',
    means: 'Share of merged pull requests whose files a fix pull request changes within 14 days. A pull request is settled 14 days after merge.',
    source: 'Merged pull requests and their file lists from GitHub, against the baseline weeks.',
    doc: ['experiment', 'measures-and-thresholds'],
  },
  {
    key: 'cost',
    question: QUESTION.cost,
    name: 'Cost',
    rule: 'At most NOK 7,500 a month',
    read: 'From day 5',
    means: 'Azure cost of the review resource group this month, projected to the end of the month from the daily average.',
    source: 'Azure Cost Management, about a day behind. Until it arrives, the run records in USD.',
    doc: ['runbook', 'when-the-budget-alerts'],
  },
];

export const RULE: [Decision, string][] = [
  ['keep', 'all seven criteria met at week 6.'],
  ['adjust', 'a criterion is missed, but the change log points to a fix that has not yet had time. Four more weeks with that one change.'],
  ['stop', 'precision or the dismissed rate misses after the rules were tightened, or the cost cannot be brought under the cap.'],
];

export const SETUP_ITEMS: [string, string, string][] = [
  ['silent-share', 'Silent share in place', 'REVIEW_SHADOW_PERCENT, never changed during the experiment'],
  ['protocol', 'Protocol written', 'docs/experiment.md before the first results'],
  ['graders', 'Two graders named', 'Needed before week 3'],
  ['privacy', 'Privacy confirmed', 'The assessment goes to the data protection officer'],
  ['channel', 'Channel for sensitive changes', 'From the approved proposal'],
  ['sign-in', 'Dashboard sign-in', 'Admin consent on the app registration'],
];

export const SCREENS = [
  ['overview', 'Overview'],
  ['repository', 'Repository'],
  ['findings', 'Findings'],
  ['operations', 'Operations'],
] as const;

export type Screen = (typeof SCREENS)[number][0];

export const OLD_SCREENS: Record<string, Screen> = {
  quality: 'repository',
  noise: 'repository',
  delivery: 'repository',
  security: 'findings',
  cost: 'operations',
  runs: 'operations',
  experiment: 'overview',
  oversikt: 'overview',
  kvalitet: 'repository',
  sikkerhet: 'findings',
  stoy: 'repository',
  vakt: 'repository',
  kostnad: 'operations',
  kjoringer: 'operations',
  om: 'overview',
};
