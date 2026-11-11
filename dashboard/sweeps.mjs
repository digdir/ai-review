import { inflateRawSync } from 'node:zlib';

export const RUN_FILE = 'security-sweep-run.json';
export const PASSES = ['tenancy', 'rights', 'secrets', 'coordinate'];
const OUTCOMES = new Set(['success', 'failure', 'cancelled', 'skipped']);

/** Returns one named file from a zip archive in memory, without extracting or reading any other entry. */
export function zipEntry(zip, name) {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) return null;
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count && zip.readUInt32LE(at) === 0x02014b50; i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const next = at + 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    if (zip.toString('utf8', at + 46, at + 46 + nameLength) === name) {
      const local = zip.readUInt32LE(at + 42);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return method === 0 ? Buffer.from(data) : method === 8 ? inflateRawSync(data) : null;
    }
    at = next;
  }
  return null;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

export function fromSweepRecord(raw, runId) {
  if (raw?.schema !== 'digdir.security-sweep.run/v1' || String(raw.run_id) !== String(runId)) return null;
  return { cost_usd: num(raw.cost_usd), duration_s: num(raw.duration_s), model: typeof raw.model === 'string' ? raw.model : null };
}

/** Reads the step outcomes the sweep hands its seal step, as printed in the job log. */
export function parseOutcomes(log) {
  const line = /^.*?\bOUTCOMES: (.*)$/m.exec(log ?? '')?.[1];
  if (!line) return null;
  const pairs = Object.fromEntries(line.trim().split(/\s+/).map((p) => p.split('=')));
  return Object.fromEntries(PASSES.map((p) => [p, OUTCOMES.has(pairs[p]) ? pairs[p] : null]));
}

export function sweepRun(run, record, passes) {
  return {
    run_id: String(run.databaseId),
    started_at: run.createdAt,
    conclusion: run.status === 'completed' ? run.conclusion || 'unknown' : 'running',
    passes: passes ?? null,
    cost_usd: record?.cost_usd ?? null,
    duration_s: record?.duration_s ?? null,
    model: record?.model ?? null,
  };
}
