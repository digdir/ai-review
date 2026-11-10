// Opens this week's issue for each repository in the experiment, once: run after npm run collect, with GH_TOKEN and GITHUB_REPOSITORY set.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRepos } from './repos.mjs';
import { weeklyIssue } from './weekly.mjs';

const ROOT = join(import.meta.dirname, '..');
const dry = process.argv.includes('--dry-run');
const target = process.env.GITHUB_REPOSITORY;
if (!target && !dry) throw new Error('GITHUB_REPOSITORY must name the repository to open the issue in');
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' });
const dir = mkdtempSync(join(tmpdir(), 'weekly-'));

for (const repo of loadRepos(join(ROOT, 'repos')).filter((r) => r.experiment)) {
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'repos', `${repo.repo}.json`), 'utf8'));
  const { title, body } = weeklyIssue(data, Date.now());
  if (dry) {
    console.log(`# ${title}\n\n${body}`);
    continue;
  }
  const open = JSON.parse(gh('issue', 'list', '-R', target, '--label', 'weekly', '--state', 'all', '--limit', '100', '--json', 'title'));
  if (open.some((i) => i.title === title)) {
    console.log(`already open: ${title}`);
    continue;
  }
  const file = join(dir, `${repo.repo.replace('/', '__')}.md`);
  writeFileSync(file, body);
  console.log(gh('issue', 'create', '-R', target, '--title', title, '--label', 'weekly', '--body-file', file).trim());
}
