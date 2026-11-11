export type Severity = 'Important' | 'Nit' | 'Pre-existing' | (string & {});
export type Outcome = 'fixed' | 'resolved' | 'outdated' | 'dismissed' | 'discussed' | 'open' | (string & {});
export type Arm = 'treated' | 'shadow' | null;
export type AuthorKind = 'agent' | 'human_ai' | 'unknown' | null;

export interface Finding {
  posted: string;
  severity: Severity;
  category?: string | null;
  path: string;
  outcome: Outcome;
  replies: number;
  suggestion?: boolean;
  url: string;
  line?: number | null;
  title?: string;
  answered?: string | null;
}

export interface RecordedFinding {
  posted: string;
  severity: Severity;
  category?: string | null;
  title: string;
  path: string;
}

export interface HumanThread {
  posted: string;
  outcome: Outcome;
}

export interface Pr {
  n: number;
  title: string;
  state: string;
  draft: boolean;
  created: string;
  merged: string | null;
  lines: number;
  files: string[];
  bot: boolean;
  sensitive?: boolean;
  risk?: string | null;
  queued?: string | null;
  human_review: boolean;
  arm: Arm;
  author_kind: AuthorKind;
  findings: Finding[];
  human_threads?: HumanThread[];
  escaped?: boolean;
  head?: string | null;
  author_hash?: string | null;
  recorded?: RecordedFinding[];
}

export interface Run {
  run_id: string;
  pr_number?: number | null;
  job?: 'review' | 'follow-up';
  arm?: Arm;
  started_at: string;
  completed?: boolean;
  duration_s?: number | null;
  turns?: number | null;
  subagents?: number | null;
  model?: string | null;
  cost_usd?: number | null;
  author_kind?: AuthorKind;
  findings?: number | null;
  source?: 'record' | 'log';
  prompt_version?: string | null;
  review_again?: boolean;
  lines_changed?: number | null;
  tokens?: { input?: number | null; output?: number | null; cache_read?: number | null } | null;
  head_sha?: string | null;
  permission_denials?: number | null;
}

export interface CiRun {
  at: string;
  failed: boolean;
}

export interface CodeqlAlert {
  created: string;
  state: string;
  severity?: string;
}

export interface AzureDay {
  date: string;
  nok: number;
  currency?: string;
}

export type SweepPass = 'tenancy' | 'rights' | 'secrets' | 'coordinate';

export interface SweepRun {
  run_id: string;
  started_at: string;
  conclusion: string;
  passes: Record<SweepPass, string | null> | null;
  cost_usd: number | null;
  duration_s?: number | null;
  model?: string | null;
}

export interface Change {
  date: string;
  kind: 'rule' | 'model' | 'procedure' | 'workflow' | 'setup' | 'protocol';
  ref?: string;
  note: string;
  source?: 'auto' | 'manual';
  item?: string;
  because?: string;
  outcome?: Decision;
}

export type Decision = 'keep' | 'adjust' | 'stop';

export interface Grading {
  grades: { week?: number; severity: Severity; grade: 'right_worth' | 'right_not_worth' | 'wrong' | 'unclear' }[];
  followup: { correct: boolean }[];
  agreement?: number | null;
}

export interface Pulse {
  week: number;
  n: number;
  useful: number;
  noise: number;
}

export interface ExperimentConfig {
  weeks: number;
  budgetNok: number;
  usdNok: number;
  minCell: number;
  measureFromWeek: number;
  humanBand: [number, number];
  importantMin: number;
  dismissedMax: number;
  ciMissedMin: number;
  precisionMin: number;
  mergeMaxIncrease: number;
  reworkMaxIncrease: number;
  privacyConfirmed: boolean;
  gradersFound: boolean;
  sensitiveChannel: boolean;
}

export interface Data {
  schema: string;
  generatedAt: string;
  config: { repo: string; baselineFrom: string; start: string; experiment?: Partial<ExperimentConfig> };
  setup?: { shadowPercent?: number };
  prs: Pr[];
  runs: Run[];
  ci: CiRun[];
  codeql?: CodeqlAlert[];
  azure: AzureDay[];
  sweeps?: SweepRun[] | null;
  grading?: Grading | null;
  pulse?: Pulse[] | null;
  changes?: Change[] | null;
  now?: number;
}

export type Status = 'met' | 'notmet' | 'early';
export type Check = 'done' | 'todo' | 'later';
export type Phase = 'setup' | 'measuring' | 'after';
