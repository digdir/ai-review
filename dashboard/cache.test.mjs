import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readCache } from './cache.mjs';

const dir = mkdtempSync(join(tmpdir(), 'cache-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('cache files', () => {
  it('reads a missing cache file as empty without checking it first', () => {
    expect(readCache(join(dir, 'missing.json'))).toBeUndefined();
  });

  it('tells a cached null apart from a missing file', () => {
    const file = join(dir, 'null.json');
    writeFileSync(file, 'null');
    expect(readCache(file)).toBeNull();
  });

  it('reads a cached value', () => {
    const file = join(dir, 'value.json');
    writeFileSync(file, '{"a":1}');
    expect(readCache(file)).toEqual({ a: 1 });
  });

  it('does not hide a file that cannot be parsed', () => {
    const file = join(dir, 'bad.json');
    writeFileSync(file, '{');
    expect(() => readCache(file)).toThrow();
  });
});
