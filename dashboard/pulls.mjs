import { createHash } from 'node:crypto';

export const isBot = (a) => !a || a.__typename === 'Bot' || /\[bot\]$/.test(a.login) || a.login === 'github-actions';
export const REVIEW_BOT = (a) => a?.login === 'github-actions' || a?.login === 'github-actions[bot]';
const SEVERITY = /^\*\*(Important|Nit|Pre-existing)\*\*/;
const DISMISSED = /\b(not fixing|won't fix|wontfix|false positive|this is wrong|not a problem)\b/i;
const FIXED_REPLY = /^Fixed in `?([0-9a-f]{7,40})/;
const TITLE = /^\*\*(?:Important|Nit|Pre-existing)\*\*:?\s*(.*)/;
const RECORD_SEVERITY = { important: 'Important', nit: 'Nit', preexisting: 'Pre-existing' };

/** SHA-256 of the lowercased login, so the dashboard can match a username typed in the browser without storing any login. */
export const authorHash = (login) => (login ? createHash('sha256').update(String(login).trim().toLowerCase()).digest('hex') : null);

/** One review thread as a finding: severity, title (first line only), outcome and when the author first answered. */
export function finding(t) {
  const [first, ...replies] = t.comments.nodes;
  const sev = SEVERITY.exec(first.body)?.[1];
  if (!sev) return null;
  const followUp = replies.find((r) => REVIEW_BOT(r.author) && FIXED_REPLY.test(r.body));
  const human = replies.filter((r) => !isBot(r.author));
  const outcome = followUp
    ? 'fixed'
    : human.some((r) => DISMISSED.test(r.body))
      ? 'dismissed'
      : t.isResolved
        ? 'resolved'
        : t.isOutdated
          ? 'outdated'
          : human.length
            ? 'discussed'
            : 'open';
  const answered = [human[0]?.createdAt, followUp?.createdAt].filter(Boolean).sort()[0] ?? null;
  return {
    posted: first.createdAt,
    severity: sev,
    title: TITLE.exec(first.body)?.[1]?.split('\n')[0]?.trim().slice(0, 200) ?? '',
    path: t.path,
    line: t.line ?? null,
    outcome,
    replies: human.length,
    suggestion: first.body.includes('```suggestion'),
    url: first.url,
    answered,
  };
}

/** A run record as the dashboard reads it: the findings as a count, and permission denials when the record has them. */
export function fromRecord(r) {
  const denials = Array.isArray(r.permission_denials) ? r.permission_denials.length : Number.isFinite(r.permission_denials) ? r.permission_denials : null;
  const { findings, permission_denials: _, ...rest } = r;
  return { ...rest, findings: findings.length, permission_denials: denials, source: 'record' };
}

/** Findings from silent-group run records per pull request, once per path and title, at the first run that found them. */
export function recordedFindings(records) {
  const out = new Map();
  for (const r of [...records].filter((x) => x.arm === 'shadow').sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const list = out.get(r.pr_number) ?? [];
    for (const f of r.findings ?? []) {
      if (list.some((x) => x.path === f.path && x.title === f.title)) continue;
      list.push({ posted: r.started_at, severity: RECORD_SEVERITY[f.severity] ?? f.severity, category: f.category ?? null, title: String(f.title ?? '').slice(0, 200), path: f.path });
    }
    out.set(r.pr_number, list);
  }
  return out;
}
