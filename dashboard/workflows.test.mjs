import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name) => readFileSync(join(import.meta.dirname, '../.github/workflows', name), 'utf8');
const block = (text, key) => {
  const m = new RegExp(`^${key}:\\n((?:  .*\\n)+)`, 'm').exec(text);
  return m ? m[1].trim().split('\n').map((l) => l.trim()) : [];
};
const runScripts = (text) => {
  const out = [];
  const lines = text.split('\n');
  lines.forEach((l, i) => {
    const m = /^(\s*)(?:- )?run: (.*)$/.exec(l);
    if (!m) return;
    if (m[2] !== '|') return out.push(m[2]);
    const indent = m[1].length;
    for (let j = i + 1; j < lines.length && (lines[j].trim() === '' || lines[j].search(/\S/) > indent); j++) out.push(lines[j]);
  });
  return out.join('\n');
};

describe('dashboard workflow', () => {
  const text = read('dashboard.yml');

  it('rebuilds every twenty minutes on weekday daytime and every hour otherwise, never on the hour', () => {
    const crons = block(text, 'on').filter((l) => l.startsWith('- cron:'));
    expect(crons).toEqual([
      "- cron: '7,27,47 5-17 * * 1-5'",
      "- cron: '37 0-4,18-23 * * 1-5'",
      "- cron: '37 * * * 0,6'",
    ]);
    for (const c of crons) expect(c).not.toMatch(/'0 /);
  });
});

describe('weekly workflow', () => {
  const text = read('weekly.yml');

  it('runs on Monday morning and by hand, never on pull request code', () => {
    expect(block(text, 'on')).toEqual(['schedule:', "- cron: '5 6 * * 1'", 'workflow_dispatch:']);
  });

  it('can read the repository, log in to Azure and write issues, nothing else', () => {
    expect(block(text, 'permissions').sort()).toEqual(['contents: read', 'id-token: write', 'issues: write']);
  });

  it('logs in to Azure through the production environment', () => {
    expect(text).toMatch(/^\s+environment: production$/m);
  });

  it('pins every action to a full commit', () => {
    const uses = [...text.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  it('passes values through the environment, not into the scripts', () => {
    expect(runScripts(text)).not.toMatch(/\$\{\{/);
  });

  it('uses the same pinned actions as the dashboard workflow', () => {
    const pins = (t) => new Set([...t.matchAll(/uses: (\S+)/g)].map((m) => m[1]));
    const dashboard = pins(read('dashboard.yml'));
    for (const u of pins(text)) expect(dashboard.has(u)).toBe(true);
  });
});
