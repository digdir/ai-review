export const KINDS = ['rule', 'model', 'procedure', 'workflow', 'setup', 'protocol'];

export const DEFAULT_PATHS = {
  rule: ['REVIEW.md', '**/AGENTS.md', '**/CLAUDE.md', '.github/review-security.md'],
  workflow: ['.github/workflows/review.yml', '.github/workflows/review-*.yml', 'scripts/review-*'],
  procedure: ['.claude/skills/review-change/**'],
};

const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** Turns a path pattern into a regex: `**` spans folders, `*` stays within one, a leading `**\/` also matches the root. */
export function pattern(glob) {
  const body = glob
    .split(/(\*\*\/|\*\*|\*)/)
    .map((part) => (part === '**/' ? '(?:.*/)?' : part === '**' ? '.*' : part === '*' ? '[^/]*' : escape(part)))
    .join('');
  return new RegExp(`^${body}$`);
}

/** One change per merged pull request and kind, for pull requests merged on or after `start` that touch the review setup. */
export function autoChanges(prs, { repo, start, paths = DEFAULT_PATHS }) {
  const kinds = Object.entries({ ...DEFAULT_PATHS, ...paths }).map(([kind, globs]) => [kind, globs.map(pattern)]);
  const out = [];
  for (const p of [...prs].sort((a, b) => a.n - b.n)) {
    if (!p.merged || p.merged.slice(0, 10) < start) continue;
    for (const [kind, res] of kinds)
      if (p.files.some((f) => res.some((re) => re.test(f))))
        out.push({ date: p.merged.slice(0, 10), kind, ref: `${repo}#${p.n}`, note: p.title, source: 'auto' });
  }
  return out;
}

/** Joins the found changes with the hand-written ones; a hand-written entry for the same pull request and kind wins. */
export function mergeChanges(auto, manual) {
  const hand = (manual ?? []).map((c) => ({ ...c, source: 'manual' }));
  const taken = new Set(hand.filter((c) => c.ref).map((c) => `${c.ref}|${c.kind}`));
  return [...hand, ...auto.filter((c) => !taken.has(`${c.ref}|${c.kind}`))].sort((a, b) => a.date.localeCompare(b.date) || (a.ref ?? '').localeCompare(b.ref ?? ''));
}

/** Problems in a hand-written change log, empty when it is fine. */
export function changeProblems(list) {
  if (!Array.isArray(list)) return ['changes.json must be a list'];
  const out = [];
  list.forEach((c, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c?.date ?? '')) out.push(`entry ${i + 1}: date must be YYYY-MM-DD`);
    if (!KINDS.includes(c?.kind)) out.push(`entry ${i + 1}: kind must be one of ${KINDS.join(', ')}`);
    if (!c?.note) out.push(`entry ${i + 1}: note is missing`);
    if (c?.ref != null && !/^[\w.-]+\/[\w.-]+#\d+$/.test(c.ref)) out.push(`entry ${i + 1}: ref must be owner/name#number`);
  });
  return out;
}
