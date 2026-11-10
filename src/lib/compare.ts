export interface Source {
  label: string;
  url: string;
}

export interface CompareRow {
  key: 'substantive' | 'bysize' | 'fix' | 'dismissed' | 'precision' | 'missed' | 'ttm' | 'rework' | 'latency' | 'cost';
  name: string;
  anthropic: string;
  published: string;
  caveat: string;
  sources: Source[];
}

const CR_BLOG = { label: 'Anthropic, Code Review', url: 'https://claude.com/blog/code-review' };

/** Published figures from the research note of 2026-11-10, quoted from the sources named on each row. */
export const COMPARE: CompareRow[] = [
  {
    key: 'substantive',
    name: 'Pull requests with at least one finding',
    anthropic: '54% of PRs (was 16% with human review only)',
    published: 'GitHub Copilot: 71% of reviews surface actionable feedback, 29% say nothing',
    caveat: 'Anthropic counts substantive comments on nearly every PR; ours counts reviewed-group PRs with one posted finding or more.',
    sources: [CR_BLOG, { label: 'GitHub, 60 million reviews', url: 'https://github.blog/ai-and-ml/github-copilot/60-million-copilot-code-reviews-and-counting/' }],
  },
  {
    key: 'bysize',
    name: 'Findings per PR by size',
    anthropic: 'Under 50 lines: 31% get findings, 0.5 each. Over 1,000 lines: 84%, 7.5 each',
    published: 'GitHub Copilot: about 5.1 comments per review',
    caveat: 'Same buckets as Anthropic. Ours counts posted findings only, and the reviewed group only.',
    sources: [CR_BLOG],
  },
  {
    key: 'fix',
    name: 'Findings acted on',
    anthropic: 'Not published as a rate; threads auto-resolve on a fix push',
    published: 'Atlassian Rovo Dev: 38.7% of AI comments led to code changes (humans 44.5%). CodeRabbit in the wild: 36.4% accepted. Qodo-based tool: 73.8% resolved',
    caveat: 'All published rates count every comment, nit included. Our Important fix rate counts Important findings only, a stricter bar on a smaller set. The all-severity rate is the closer match.',
    sources: [
      { label: 'arXiv 2601.01129', url: 'https://arxiv.org/abs/2601.01129' },
      { label: 'arXiv 2607.03316', url: 'https://arxiv.org/abs/2607.03316' },
      { label: 'arXiv 2412.18531', url: 'https://arxiv.org/abs/2412.18531' },
    ],
  },
  {
    key: 'dismissed',
    name: 'Findings not accepted',
    anthropic: 'Under 1% of findings marked incorrect',
    published: 'CodeRabbit in the wild: 56.3% rejected. Lychee audit: 28% not useful, 21% nitpicks',
    caveat: "Anthropic's figure is an active \"incorrect\" mark; ours is a passive dismissal that also catches \"not now\". Expect ours far above 1% and closer to the independent studies.",
    sources: [CR_BLOG, { label: 'Lychee audit', url: 'https://lycheeorg.dev/2025-09-13-code-rabbit/' }],
  },
  {
    key: 'precision',
    name: 'Precision',
    anthropic: 'Not published. A verify step filters false positives before posting',
    published: 'Google calibrated its comment model to 50% precision. GitHub ReviewBench (offline, 219 PRs): Copilot 87.8% in one column, mapping unverified',
    caveat: 'No vendor publishes production precision. Ours is human-graded on live PRs, the stricter and rarer kind.',
    sources: [
      { label: 'Google research', url: 'https://research.google/blog/resolving-code-review-comments-with-ml/' },
      { label: 'GitHub ReviewBench', url: 'https://github.blog/ai-and-ml/github-copilot/reviewbench-an-open-benchmark-for-ai-code-review/' },
    ],
  },
  {
    key: 'missed',
    name: 'Bugs the checks missed',
    anthropic: 'About a third of past incident bugs would have been caught; an RCE and an SSRF caught before merge',
    published: 'Atlassian: 2.8 times the share of bug comments compared with humans',
    caveat: 'Nobody publishes "bugs CI did not catch per period". Ours is an absolute count, so the list matters more than the rate.',
    sources: [
      { label: 'Anthropic, secure SDLC', url: 'https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle' },
      { label: 'Atlassian research', url: 'https://www.atlassian.com/blog/how-we-build/atlassian-rovo-dev-research-what-types-of-code-review-comments-do-developers-most-frequently-resolve' },
    ],
  },
  {
    key: 'ttm',
    name: 'Time to merge',
    anthropic: 'Not published. A review takes about 20 minutes',
    published: 'Cihan et al.: +42% PR closure time after AI review. Atlassian: median cycle time -30.8%. Microsoft: 10 to 20% faster. Meta: reviewers 5% slower when shown AI patches',
    caveat: 'Results go both ways; the sign depends on whether findings add round trips or replace human comments. Our +20% tolerance sits between them. Medians only.',
    sources: [
      { label: 'arXiv 2412.18531', url: 'https://arxiv.org/abs/2412.18531' },
      { label: 'arXiv 2601.01129', url: 'https://arxiv.org/abs/2601.01129' },
      { label: 'Microsoft', url: 'https://devblogs.microsoft.com/engineering-at-microsoft/enhancing-code-quality-at-scale-with-ai-powered-code-reviews/' },
    ],
  },
  {
    key: 'rework',
    name: 'Rework after merge',
    anthropic: 'Not published',
    published: 'DORA 2025: AI adoption still has a negative relationship with delivery stability. No published rework rate attributable to AI review',
    caveat: 'DORA is about AI-assisted coding, not review. Our silent group is the only fair comparison.',
    sources: [{ label: 'DORA 2025', url: 'https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report' }],
  },
  {
    key: 'latency',
    name: 'Time to first review',
    anthropic: 'About 20 minutes per review',
    published: 'CodeRabbit and Graphite both report time to first review as p50 and p90',
    caveat: "Anthropic's 20 minutes is review duration on large PRs; ours is from the pull request opening to the review being posted.",
    sources: [CR_BLOG, { label: 'CodeRabbit metrics', url: 'https://docs.coderabbit.ai/guides/dashboard-metrics' }],
  },
  {
    key: 'cost',
    name: 'Cost per review',
    anthropic: 'USD 15 to 25 on the managed service, scaling with PR size',
    published: 'GitHub Copilot: 13 premium requests, about USD 0.52 per review on overage. CodeRabbit Pro: about USD 24 per user a month (secondary, unverified)',
    caveat: 'We run our own action on Azure Foundry at API rates, so a review costs far less than the managed service. Compare per PR and per Important fix, not the monthly total.',
    sources: [CR_BLOG, { label: 'GitHub premium requests', url: 'https://docs.github.com/en/copilot/managing-copilot/monitoring-usage-and-entitlements/about-premium-requests' }],
  },
];

export const HOW_ANTHROPIC = {
  does: 'Find, verify, rank, post: several agents read the diff and the code around it in parallel, a verification step checks every candidate against the code and drops false positives, findings are deduplicated and ranked, then posted as inline comments plus a summary and a neutral check run that never fails. Three severities: Important, Nit, Pre-existing. A later review resolves its earlier thread when it judges the issue fixed; resolving a thread yourself is the dismissal. New reviewers start in shadow mode, posting for human approval until trusted.',
  copied: [
    'The three severities with a written definition of Important per repository (REVIEW.md)',
    'Verify before posting, with the reasoning kept',
    '"Do not report what CI already enforces", lock files and generated files',
    'A cap on Nits per review',
    'Auto-resolve on a fix push; manual resolve counts as dismissed',
    'Shadow mode as the pattern behind our silent group',
    'Findings per PR by size bucket',
  ],
  differs: [
    'Our own action on Azure Foundry, so we own the model choice and the cost per PR',
    'A silent control group and a missed-by-the-checks criterion, which Anthropic does not report',
    'Hand-graded precision on live PRs',
    'Anthropic\'s "incorrect" is an active mark; our dismissal is passive, so our rate will read higher',
  ],
  source: { label: 'Code Review docs', url: 'https://code.claude.com/docs/en/code-review' },
};
