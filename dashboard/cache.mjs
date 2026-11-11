import { readFileSync } from 'node:fs';

export function readCache(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
}
