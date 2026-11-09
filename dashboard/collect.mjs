// Collects raw review events from GitHub and Azure into data/repos/<owner>/<name>.json, one file per repository in repos/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRepos } from './repos.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'data');
let CONFIG;
let CACHE;

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const gh = (...a) => JSON.parse(sh('gh', a));
const graphql = (query, vars) =>
  gh('api', 'graphql', '-f', `query=${query}`, ...Object.entries(vars).flatMap(([k, v]) => ['-F', `${k}=${v}`])).data;
const isBot = (a) => !a || a.__typename === 'Bot' || /\[bot\]$/.test(a.login) || a.login === 'github-actions';
const REVIEW_BOT = (a) => a?.login === 'github-actions' || a?.login === 'github-actions[bot]';
const SEVERITY = /^\*\*(Important|Nit|Pre-existing)\*\*/;
const DISMISSED = /\b(not fixing|won't fix|wontfix|false positive|this is wrong|not a problem)\b/i;
const FIXED_REPLY = /^Fixed in `?([0-9a-f]{7,40})/;
const SENSITIVE = /^(packages\/identity|packages\/guardrails|infra\/|\.github\/)|Dockerfile|\/migrations?\/|\/(auth|tenan|gate|principal|rights|audit|secrets?)[^/]*($|\/)/i;
const TITLE = /^\*\*(?:Important|Nit|Pre-existing)\*\*:?\s*(.*)/;

function risk(body) {
  const m = /##\s*Risk\s*\n([\s\S]*?)(\n##\s|$)/i.exec(body ?? '');
  const text = (m?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!text) return null;
  return /sensitiv/i.test(text) ? 'sensitive' : /^(low|lav)\b/i.test(text) ? 'low' : 'other';
}

const PR_QUERY = `query($q:String!,$after:String){search(query:$q,type:ISSUE,first:25,after:$after){pageInfo{hasNextPage endCursor}nodes{...on PullRequest{
  number title body state isDraft createdAt mergedAt additions deletions author{login __typename}
  timelineItems(itemTypes:[ADDED_TO_MERGE_QUEUE_EVENT],last:1){nodes{...on AddedToMergeQueueEvent{createdAt}}}
  files(first:100){nodes{path}}
  reviews(first:50){nodes{author{login __typename} state}}
  comments(first:50){nodes{author{login __typename}}}
  reviewThreads(first:100){nodes{isResolved isOutdated path line resolvedBy{login __typename}
    comments(first:30){nodes{author{login __typename} body createdAt url}}}}}}}}`;

function pullRequests() {
  const out = [];
  let after = null;
  do {
    const vars = { q: `repo:${CONFIG.repo} is:pr updated:>=${CONFIG.baselineFrom}` };
    if (after) vars.after = after;
    const page = graphql(PR_QUERY, vars).search;
    out.push(...page.nodes.filter((n) => n.number));
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return out;
}

function finding(t) {
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
  return {
    posted: first.createdAt,
    severity: sev,
    title: TITLE.exec(first.body)?.[1]?.split('\n')[0]?.trim() ?? '',
    path: t.path,
    outcome,
    replies: human.length,
    suggestion: first.body.includes('```suggestion'),
    url: first.url,
  };
}

function humanThread(t, prAuthor) {
  const first = t.comments.nodes[0];
  if (!first || isBot(first.author) || first.author.login === prAuthor) return null;
  return { posted: first.createdAt, outcome: t.isResolved ? 'resolved' : t.isOutdated ? 'outdated' : 'open' };
}

let categories = new Map();

function runRecords() {
  const arts = sh('gh', ['api', `repos/${CONFIG.repo}/actions/artifacts?per_page=100`, '--paginate', '--jq', '.artifacts[]|select(.name|startswith("review-run-"))|select(.expired|not)|{id,name}|tojson'])
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const out = [];
  for (const a of arts) {
    const file = join(CACHE, `artifact-${a.id}.json`);
    if (!existsSync(file)) {
      const tmp = join(CACHE, `a-${a.id}`);
      mkdirSync(tmp, { recursive: true });
      writeFileSync(join(tmp, 'a.zip'), execFileSync('gh', ['api', `repos/${CONFIG.repo}/actions/artifacts/${Number(a.id)}/zip`], { maxBuffer: 512 * 1024 * 1024 }));
      execFileSync('unzip', ['-o', '-q', join(tmp, 'a.zip'), '-d', tmp]);
      const json = readdirSync(tmp).find((f) => f.endsWith('.json'));
      writeFileSync(file, json ? readFileSync(join(tmp, json)) : 'null');
      rmSync(tmp, { recursive: true, force: true });
    }
    const r = JSON.parse(readFileSync(file, 'utf8'));
    if (r?.schema === 'digdir.ai-review.run/v1') {
      for (const f of r.findings) if (f.category) categories.set(`${r.pr_number}|${f.title}`, f.category);
      out.push({ ...r, findings: r.findings.length, source: 'record' });
    }
  }
  return out;
}

function legacyRuns(recorded) {
  const runs = gh('run', 'list', '-R', CONFIG.repo, '--workflow', CONFIG.workflows.review, '--limit', '1000', '--json', 'databaseId,conclusion,createdAt,status');
  const out = [];
  for (const r of runs.filter((r) => r.status === 'completed' && !recorded.has(String(r.databaseId)))) {
    const file = join(CACHE, `run-${r.databaseId}.json`);
    if (!existsSync(file)) {
      let log = '';
      try {
        log = sh('gh', ['run', 'view', String(r.databaseId), '-R', CONFIG.repo, '--log']);
      } catch {
        log = '';
      }
      const num = (k) => {
        const m = new RegExp(`"${k}": ([0-9.]+)`).exec(log);
        return m ? Number(m[1]) : null;
      };
      writeFileSync(file, JSON.stringify({
        run_id: String(r.databaseId),
        started_at: r.createdAt,
        pr_number: Number(/pull request \S+#(\d+)/i.exec(log)?.[1]) || null,
        model: /--model (\S+)/.exec(log)?.[1] ?? null,
        cost_usd: num('total_cost_usd'),
        turns: num('num_turns'),
        duration_s: num('duration_ms') != null ? Math.round(num('duration_ms') / 1000) : null,
        job: /Find nothing new/.test(log) ? 'follow-up' : 'review',
        conclusion: r.conclusion,
      }));
    }
    const x = JSON.parse(readFileSync(file, 'utf8'));
    if (x.turns == null) continue;
    out.push({ ...x, arm: 'treated', completed: x.conclusion === 'success', subagents: null, author_kind: null, findings: null, source: 'log' });
  }
  return out;
}

function mainCi() {
  return gh('run', 'list', '-R', CONFIG.repo, '--workflow', CONFIG.workflows.ci, '--branch', 'main', '--limit', '2000', '--created', `>=${CONFIG.baselineFrom}`, '--json', 'conclusion,createdAt,event')
    .filter((r) => r.event === 'push' && r.conclusion)
    .map((r) => ({ at: r.createdAt, failed: r.conclusion === 'failure' }));
}

function codeScanning() {
  try {
    return sh('gh', ['api', `repos/${CONFIG.repo}/code-scanning/alerts?per_page=100`, '--paginate', '--jq', '.[]|select(.tool.name=="CodeQL")|{created:.created_at,fixed:.fixed_at,dismissed:.dismissed_at,state,severity:(.rule.security_severity_level // .rule.severity)}|tojson'])
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (e) {
    console.warn('code scanning unavailable:', String(e).slice(0, 200));
    return undefined;
  }
}

function azureCost() {
  if (!CONFIG.azure) return [];
  const { subscription, resourceGroup } = CONFIG.azure;
  for (let attempt = 1; ; attempt++) try {
    const p = JSON.parse(sh('az', ['rest', '--method', 'post',
      '--url', `https://management.azure.com/subscriptions/${subscription}/resourceGroups/${resourceGroup}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
      '--body', JSON.stringify({ type: 'ActualCost', timeframe: 'Custom', timePeriod: { from: CONFIG.start, to: new Date().toISOString().slice(0, 10) },
        dataset: { granularity: 'Daily', aggregation: { cost: { name: 'Cost', function: 'Sum' } } } })])).properties;
    const i = Object.fromEntries(p.columns.map((c, k) => [c.name, k]));
    return p.rows.map((r) => { const d = String(r[i.UsageDate]); return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, nok: r[i.Cost], currency: r[i.Currency] }; });
  } catch (e) {
    if (/429|Too Many Requests/i.test(String(e)) && attempt < 5) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15000 * attempt); continue; }
    console.warn('azure cost unavailable:', String(e).slice(0, 200));
    return [];
  }
}

function collect() {
  const records = runRecords();
  const runs = [...records, ...legacyRuns(new Set(records.map((r) => String(r.run_id))))];
  const armByPr = new Map();
  for (const r of [...runs].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    if (r.pr_number && !armByPr.has(r.pr_number)) armByPr.set(r.pr_number, { arm: r.arm, author_kind: r.author_kind });
  }

  const prs = pullRequests().map((p) => {
    const login = p.author?.login;
    const people = [...p.reviews.nodes, ...p.comments.nodes].filter((x) => !isBot(x.author) && x.author.login !== login);
    const threads = p.reviewThreads.nodes.filter((t) => t.comments.nodes.length);
    return {
      n: p.number,
      title: p.title,
      state: p.state,
      draft: p.isDraft,
      created: p.createdAt,
      merged: p.mergedAt,
      lines: p.additions + p.deletions,
      files: p.files.nodes.map((f) => f.path),
      bot: isBot(p.author),
      human_review: people.length > 0 || threads.some((t) => humanThread(t, login)),
      arm: armByPr.get(p.number)?.arm ?? null,
      author_kind: armByPr.get(p.number)?.author_kind ?? null,
      findings: threads
        .filter((t) => REVIEW_BOT(t.comments.nodes[0].author))
        .map(finding)
        .filter(Boolean)
        .map(({ title, ...f }) => ({ ...f, category: categories.get(`${p.number}|${title}`) ?? null })),
      sensitive: p.files.nodes.some((f) => SENSITIVE.test(f.path)),
      risk: risk(p.body),
      queued: p.timelineItems.nodes[0]?.createdAt ?? null,
      human_threads: threads.map((t) => humanThread(t, login)).filter(Boolean),
    };
  });

  const optional = (file) => {
    const path = join(ROOT, 'inputs', CONFIG.repo, file);
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  };
  let shadowPercent = 0;
  try {
    shadowPercent = Number(sh('gh', ['variable', 'get', 'REVIEW_SHADOW_PERCENT', '-R', CONFIG.repo]).trim()) || 0;
  } catch {
    shadowPercent = 0;
  }

  const data = {
    schema: 'digdir.ai-review.dashboard/v1',
    generatedAt: new Date().toISOString(),
    config: { repo: CONFIG.repo, baselineFrom: CONFIG.baselineFrom, start: CONFIG.start, experiment: CONFIG.experiment },
    setup: { shadowPercent },
    prs,
    runs,
    ci: mainCi(),
    codeql: codeScanning(),
    azure: azureCost(),
    grading: optional('grading.json'),
    pulse: optional('pulse.json'),
  };
  mkdirSync(join(OUT, 'repos', CONFIG.repo.split('/')[0]), { recursive: true });
  writeFileSync(join(OUT, 'repos', `${CONFIG.repo}.json`), JSON.stringify(data));
  console.log(`${CONFIG.repo}: prs ${prs.length}, runs ${runs.length} (${records.length} records), findings ${prs.reduce((s, p) => s + p.findings.length, 0)}, human threads ${prs.reduce((s, p) => s + p.human_threads.length, 0)}`);
}

const index = [];
for (const repo of loadRepos(join(ROOT, 'repos'))) {
  CONFIG = repo;
  CACHE = join(OUT, 'cache', repo.repo);
  mkdirSync(CACHE, { recursive: true });
  categories = new Map();
  try {
    collect();
    index.push({ repo: repo.repo, ok: true, at: new Date().toISOString() });
  } catch (e) {
    console.error(`${repo.repo} failed:`, String(e).slice(0, 500));
    index.push({ repo: repo.repo, ok: false, at: new Date().toISOString(), error: String(e.message ?? e).split('\n')[0].slice(0, 200) });
  }
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ schema: 'digdir.ai-review.index/v1', generatedAt: new Date().toISOString(), repos: index }));
if (index.every((r) => !r.ok)) process.exit(1);
