// Writes a blind grading sheet for one experiment week: npm run grading-sample -- --repo digdir/genki --week 3 [--seed 3] [--max 15]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { drawSample, key, sheet, template, weekFindings } from './grading.mjs';

const ROOT = join(import.meta.dirname, '..');
const { values } = parseArgs({ options: { repo: { type: 'string' }, week: { type: 'string' }, seed: { type: 'string' }, max: { type: 'string' } } });
const repo = values.repo ?? '';
const week = Number(values.week);
if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !Number.isInteger(week) || week < 1) throw new Error('usage: --repo owner/name --week N [--seed S] [--max 15]');

const dataFile = join(ROOT, 'data', 'repos', `${repo}.json`);
const cache = join(ROOT, 'data', 'cache', repo);
if (!existsSync(dataFile) || !existsSync(cache)) throw new Error(`run npm run collect first: ${dataFile} or ${cache} is missing`);
const data = JSON.parse(readFileSync(dataFile, 'utf8'));
const records = readdirSync(cache)
  .filter((f) => f.startsWith('artifact-'))
  .map((f) => JSON.parse(readFileSync(join(cache, f), 'utf8')))
  .filter(Boolean);

const found = weekFindings(records, data, week);
const sample = drawSample(found, { week, seed: values.seed ? Number(values.seed) : week, max: values.max ? Number(values.max) : 15 });
const dir = join(ROOT, 'grading', repo, `week-${week}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'sheet.md'), sheet(sample, { repo, week }));
writeFileSync(join(dir, 'key.json'), JSON.stringify(key(sample), null, 2) + '\n');
writeFileSync(join(dir, 'grades-template.json'), JSON.stringify(template(sample), null, 2) + '\n');
console.log(`${repo} week ${week}: ${found.length} findings, ${sample.length} in the sample, written to ${dir}`);
