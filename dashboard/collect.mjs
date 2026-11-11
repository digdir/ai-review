// Collects raw review events from GitHub and Azure into data/repos/<owner>/<name>.json, one file per repository in repos/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { autoChanges, changeProblems, mergeChanges } from './changes.mjs';
import { artifactKind, authorHash, CROSS_FILE, finding, fromCrossRecord, fromRecord, isBot, recordedFindings, REVIEW_BOT, touchesSensitive } from './pulls.mjs';
import { loadRepos } from './repos.mjs';
import { fromSnapshot } from './snapshot.mjs';
import { fromSweepRecord, parseOutcomes, RUN_FILE, sweepRun, zipEntry } from './sweeps.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'data');
let CONFIG;
let CACHE;

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const gh = (...a) => JSON.parse(sh('gh', a));
const graphql = (query, vars) =>
  gh('api', 'graphql', '-f', `query=${query}`, ...Object.entries(vars).flatMap(([k, v]) => ['-F', `${k}=${v}`])).data;
function risk(body) {
  const m = /##\s*Risk\s*\n([\s\S]*?)(\n##\s|$)/i.exec(body ?? '');
  const text = (m?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!text) return null;
  return /sensitiv/i.test(text) ? 'sensitive' : /^(low|lav)\b/i.test(text) ? 'low' : 'other';
}

const PR_QUERY = `query($q:String!,$after:String){search(query:$q,type:ISSUE,first:25,after:$after){pageInfo{hasNextPage endCursor}nodes{...on PullRequest{
  number title body state isDraft createdAt mergedAt additions deletions headRefOid author{login __typename}
  labels(first:20){nodes{name}}
  timelineItems(itemTypes:[ADDED_TO_MERGE_QUEUE_EVENT],last:1){nodes{...on AddedToMergeQueueEvent{createdAt}}}
  files(first:100){totalCount nodes{path}}
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
  for (const p of out.filter((p) => p.files.totalCount > p.files.nodes.length))
    p.files.nodes = sh('gh', ['api', `repos/${CONFIG.repo}/pulls/${Number(p.number)}/files?per_page=100`, '--paginate', '--jq', '.[].filename'])
      .split('\n')
      .filter(Boolean)
      .map((path) => ({ path }));
  return out;
}

function humanThread(t, prAuthor) {
  const first = t.comments.nodes[0];
  if (!first || isBot(first.author) || first.author.login === prAuthor) return null;
  return { posted: first.createdAt, outcome: t.isResolved ? 'resolved' : t.isOutdated ? 'outdated' : 'open' };
}

let categories = new Map();
let recorded = new Map();

function artifacts() {
  return sh('gh', ['api', `repos/${CONFIG.repo}/actions/artifacts?per_page=100`, '--paginate', '--jq', '.artifacts[]|select(.expired|not)|{id,name}|tojson'])
    .split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((a) => artifactKind(a.name));
}

function runRecords(arts) {
  const out = [];
  const raw = [];
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
      raw.push(r);
      out.push(fromRecord(r));
    }
  }
  recorded = recordedFindings(raw);
  return out;
}

function crossRuns(arts) {
  const out = [];
  for (const a of arts) {
    const file = join(CACHE, `cross-${Number(a.id)}.json`);
    let run = readCache(file);
    if (run === null && !existsSync(file)) {
      try {
        const zip = execFileSync('gh', ['api', `repos/${CONFIG.repo}/actions/artifacts/${Number(a.id)}/zip`], { maxBuffer: 64 * 1024 * 1024 });
        const json = zipEntry(zip, CROSS_FILE);
        run = json ? fromCrossRecord(JSON.parse(json.toString('utf8'))) : null;
        writeFileSync(file, JSON.stringify(run));
      } catch (e) {
        console.warn(`cross-model run ${a.name} unreadable:`, String(e.message ?? e).split('\n')[0].slice(0, 200));
      }
    }
    if (run) out.push(run);
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

function snapshot() {
  const id = sh('gh', ['api', `repos/${CONFIG.repo}/actions/artifacts?name=review-snapshot&per_page=1`, '--jq', '.artifacts[]|select(.expired|not)|.id']).trim();
  if (!id) {
    console.warn('no review snapshot: code scanning unknown');
    return undefined;
  }
  const tmp = join(CACHE, `snapshot-${Number(id)}`);
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(join(tmp, 'a.zip'), execFileSync('gh', ['api', `repos/${CONFIG.repo}/actions/artifacts/${Number(id)}/zip`], { maxBuffer: 64 * 1024 * 1024 }));
    execFileSync('unzip', ['-o', '-q', join(tmp, 'a.zip'), '-d', tmp]);
    return fromSnapshot(JSON.parse(readFileSync(join(tmp, 'review-snapshot.json'), 'utf8')));
  } catch (e) {
    console.warn('review snapshot unreadable:', String(e).slice(0, 200));
    return undefined;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function sweepDetails(id) {
  const name = `security-sweep-${id}`;
  const artifact = sh('gh', ['api', `repos/${CONFIG.repo}/actions/runs/${id}/artifacts`, '--jq', `.artifacts[]|select(.name=="${name}")|select(.expired|not)|.id`]).trim().split('\n')[0];
  let record = null;
  if (artifact) {
    const zip = execFileSync('gh', ['api', `repos/${CONFIG.repo}/actions/artifacts/${Number(artifact)}/zip`], { maxBuffer: 64 * 1024 * 1024 });
    const file = zipEntry(zip, RUN_FILE);
    record = file ? fromSweepRecord(JSON.parse(file.toString('utf8')), id) : null;
  }
  const jobs = gh('api', `repos/${CONFIG.repo}/actions/runs/${id}/jobs`).jobs ?? [];
  const passes = jobs.length === 1 ? parseOutcomes(sh('gh', ['api', `repos/${CONFIG.repo}/actions/jobs/${Number(jobs[0].id)}/logs`])) : null;
  return { record, passes };
}

function readCache(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function sweeps() {
  if (!CONFIG.workflows.sweep) return undefined;
  try {
    const runs = gh('run', 'list', '-R', CONFIG.repo, '--workflow', CONFIG.workflows.sweep, '--limit', '200', '--created', `>=${CONFIG.start}`, '--json', 'databaseId,conclusion,createdAt,status');
    return runs.map((r) => {
      const id = Number(r.databaseId);
      const file = join(CACHE, `sweep-${id}.json`);
      const cached = readCache(file);
      if (cached) return sweepRun(r, ...cached);
      let details = { record: null, passes: null };
      try {
        details = sweepDetails(id);
        if (r.status === 'completed') writeFileSync(file, JSON.stringify([details.record, details.passes]));
      } catch (e) {
        console.warn(`security sweep run ${id} unreadable:`, String(e.message ?? e).split('\n')[0].slice(0, 200));
      }
      return sweepRun(r, details.record, details.passes);
    });
  } catch (e) {
    console.warn('security sweep runs unavailable:', String(e.message ?? e).split('\n')[0].slice(0, 200));
    return null;
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
  const arts = artifacts();
  const records = runRecords(arts.filter((a) => artifactKind(a.name) === 'main'));
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
      author_hash: authorHash(login),
      findings: threads
        .filter((t) => REVIEW_BOT(t.comments.nodes[0].author))
        .map(finding)
        .filter(Boolean)
        .map((f) => ({ ...f, category: categories.get(`${p.number}|${f.title}`) ?? null })),
      recorded: recorded.get(p.number) ?? [],
      sensitive: touchesSensitive(p.files.nodes.map((f) => f.path)),
      risk: risk(p.body),
      queued: p.timelineItems.nodes[0]?.createdAt ?? null,
      human_threads: threads.map((t) => humanThread(t, login)).filter(Boolean),
      escaped: p.labels.nodes.some((l) => l.name === 'escaped'),
      head: p.headRefOid ?? null,
    };
  });

  const optional = (file) => {
    const path = join(ROOT, 'inputs', CONFIG.repo, file);
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  };
  const snap = snapshot();
  const manual = optional('changes.json');
  const wrong = manual ? changeProblems(manual) : [];
  if (wrong.length) throw new Error(`inputs/${CONFIG.repo}/changes.json: ${wrong.join('; ')}`);

  const data = {
    schema: 'digdir.ai-review.dashboard/v1',
    generatedAt: new Date().toISOString(),
    config: { repo: CONFIG.repo, baselineFrom: CONFIG.baselineFrom, start: CONFIG.start, experiment: CONFIG.experiment },
    setup: { shadowPercent: snap?.shadowPercent ?? 0 },
    prs,
    runs,
    ci: mainCi(),
    codeql: snap?.codeql,
    azure: azureCost(),
    sweeps: sweeps(),
    cross: crossRuns(arts.filter((a) => artifactKind(a.name) === 'cross-model')),
    grading: optional('grading.json'),
    pulse: optional('pulse.json'),
    changes: mergeChanges(autoChanges(prs, { repo: CONFIG.repo, start: CONFIG.start, paths: CONFIG.changePaths }), manual),
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
  recorded = new Map();
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
