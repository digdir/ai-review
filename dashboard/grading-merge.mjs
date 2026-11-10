// Adds two graders' grades for a week to inputs/<repo>/grading.json: npm run grading-merge -- --repo digdir/genki --week 3 --graders a.json b.json [--agreed agreed.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { intoGrading, mergeWeek } from './grading.mjs';

const ROOT = join(import.meta.dirname, '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { repo: { type: 'string' }, week: { type: 'string' }, graders: { type: 'string', multiple: true }, agreed: { type: 'string' } },
});
const repo = values.repo ?? '';
const week = Number(values.week);
const graderFiles = [...(values.graders ?? []), ...positionals];
if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !Number.isInteger(week) || week < 1) throw new Error('usage: --repo owner/name --week N --graders a.json b.json [--agreed agreed.json]');

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const keyFile = join(ROOT, 'grading', repo, `week-${week}`, 'key.json');
if (!existsSync(keyFile)) throw new Error(`no key for week ${week}: run npm run grading-sample first`);
const graded = mergeWeek({ week, key: read(keyFile), graders: graderFiles.map(read), agreed: values.agreed ? read(values.agreed) : [] });

const out = join(ROOT, 'inputs', repo, 'grading.json');
mkdirSync(join(ROOT, 'inputs', repo), { recursive: true });
const next = intoGrading(existsSync(out) ? read(out) : null, week, graded);
writeFileSync(out, JSON.stringify(next, null, 2) + '\n');
console.log(`${repo} week ${week}: ${graded.length} grades, ${next.grades.length} in total, agreement ${next.agreement == null ? 'n/a' : next.agreement.toFixed(2)}`);
