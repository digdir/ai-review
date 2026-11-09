const STATES = new Set(['open', 'fixed', 'dismissed']);
const time = (v) => v === null || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));

export function fromSnapshot(raw) {
  if (raw?.schema !== 'digdir.ai-review.snapshot/v1' || !Array.isArray(raw.codeql)) return undefined;
  const codeql = raw.codeql.filter(
    (a) => typeof a?.created === 'string' && time(a.created) && time(a.fixed ?? null) && time(a.dismissed ?? null) && STATES.has(a.state),
  ).map((a) => ({ created: a.created, fixed: a.fixed ?? null, dismissed: a.dismissed ?? null, state: a.state, severity: String(a.severity ?? '') }));
  const shadow = Number(raw.shadow_percent);
  return { codeql, shadowPercent: shadow >= 0 && shadow <= 100 ? shadow : 0, at: raw.generated_at ?? null };
}
