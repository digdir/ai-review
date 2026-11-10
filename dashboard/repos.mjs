import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NAME = /^[A-Za-z0-9_.-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Checks one settings file and returns the problems, empty when it is fine. */
export function problems(repo, file) {
  const out = [];
  const [owner, name, ...rest] = String(repo.repo ?? '').split('/');
  if (!owner || !name || rest.length || !NAME.test(owner) || !NAME.test(name)) out.push('repo must be owner/name');
  else if (file && file !== `${owner}/${name}.json`) out.push(`file must be repos/${owner}/${name}.json`);
  for (const k of ['start', 'baselineFrom']) if (!DATE.test(repo[k] ?? '')) out.push(`${k} must be a date (YYYY-MM-DD)`);
  if (DATE.test(repo.start ?? '') && DATE.test(repo.baselineFrom ?? '') && repo.baselineFrom > repo.start) out.push('baselineFrom must be before start');
  for (const k of ['review', 'ci']) if (!/^[\w.-]+\.ya?ml$/.test(repo.workflows?.[k] ?? '')) out.push(`workflows.${k} must be a workflow file name`);
  if (repo.azure && !(repo.azure.subscription && repo.azure.resourceGroup)) out.push('azure needs subscription and resourceGroup');
  for (const [kind, globs] of Object.entries(repo.changePaths ?? {}))
    if (!['rule', 'workflow', 'procedure'].includes(kind) || !Array.isArray(globs) || !globs.length || globs.some((g) => typeof g !== 'string' || !g))
      out.push(`changePaths.${kind} must be rule, workflow or procedure with a list of paths`);
  return out;
}

export function loadRepos(dir) {
  const files = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const repos = files.map((file) => {
    const repo = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const found = problems(repo, file.split('\\').join('/'));
    if (found.length) throw new Error(`repos/${file}: ${found.join('; ')}`);
    return repo;
  });
  if (!repos.length) throw new Error('No repositories in repos/');
  return repos;
}
