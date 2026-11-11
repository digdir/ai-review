import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fromSweepRecord, parseOutcomes, RUN_FILE, sweepRun, zipEntry } from './sweeps.mjs';

function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text, deflate] of entries) {
    const raw = Buffer.from(text);
    const data = deflate ? deflateRawSync(raw) : raw;
    const file = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(file.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(deflate ? 8 : 0, 10);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(raw.length, 24);
    head.writeUInt16LE(file.length, 28);
    head.writeUInt32LE(offset, 42);
    locals.push(local, file, data);
    central.push(head, file);
    offset += 30 + file.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const record = { schema: 'digdir.security-sweep.run/v1', run_id: '42', model: 'claude-opus-5-5', started_at: '2026-11-16T03:18:00Z', duration_s: 2400, turns: 180, cost_usd: 14.27 };

describe('security sweep artifact', () => {
  const archive = zip([
    ['security-sweep.sealed.json', '{"schema":"digdir.security-sweep.sealed/v1","data":"c2VhbGVk"}', true],
    [RUN_FILE, JSON.stringify(record), true],
  ]);

  it('reads the run record from the archive in memory and nothing else', () => {
    expect(JSON.parse(zipEntry(archive, RUN_FILE).toString('utf8'))).toEqual(record);
  });

  it('reads a stored entry as well as a compressed one', () => {
    expect(zipEntry(zip([[RUN_FILE, '{}', false]]), RUN_FILE).toString('utf8')).toBe('{}');
  });

  it('returns nothing when the run record is missing or the archive is not a zip', () => {
    expect(zipEntry(zip([['security-sweep.sealed.json', '{}', true]]), RUN_FILE)).toBeNull();
    expect(zipEntry(Buffer.from('not a zip'), RUN_FILE)).toBeNull();
  });
});

describe('security sweep run record', () => {
  it('keeps cost, duration and model', () => {
    expect(fromSweepRecord(record, 42)).toEqual({ cost_usd: 14.27, duration_s: 2400, model: 'claude-opus-5-5' });
  });

  it('ignores a record of another schema or another run', () => {
    expect(fromSweepRecord({ ...record, schema: 'digdir.security-sweep.sealed/v1' }, '42')).toBeNull();
    expect(fromSweepRecord(record, '43')).toBeNull();
  });

  it('drops a cost that is not a number', () => {
    expect(fromSweepRecord({ ...record, cost_usd: 'a lot' }, '42').cost_usd).toBeNull();
  });
});

describe('security sweep step outcomes', () => {
  it('reads the outcome of each pass from the seal step in the job log', () => {
    const log = '2026-11-16T04:01:02.1234567Z   OUTCOMES: tenancy=success rights=failure secrets=success coordinate=skipped\n';
    expect(parseOutcomes(log)).toEqual({ tenancy: 'success', rights: 'failure', secrets: 'success', coordinate: 'skipped' });
  });

  it('leaves a step it does not recognise unknown', () => {
    expect(parseOutcomes('  OUTCOMES: tenancy=success rights= secrets=odd coordinate=success')).toEqual({ tenancy: 'success', rights: null, secrets: null, coordinate: 'success' });
  });

  it('knows nothing when the run never reached the seal step', () => {
    expect(parseOutcomes('Error: no public key to seal the findings to')).toBeNull();
  });
});

describe('security sweep run', () => {
  const run = { databaseId: 42, createdAt: '2026-11-16T03:17:30Z', status: 'completed', conclusion: 'success' };

  it('joins the run with its record and step outcomes', () => {
    const passes = { tenancy: 'success', rights: 'success', secrets: 'success', coordinate: 'skipped' };
    expect(sweepRun(run, fromSweepRecord(record, 42), passes)).toEqual({
      run_id: '42', started_at: '2026-11-16T03:17:30Z', conclusion: 'success', passes, cost_usd: 14.27, duration_s: 2400, model: 'claude-opus-5-5',
    });
  });

  it('shows a failed run without a record as failed with no cost', () => {
    expect(sweepRun({ ...run, conclusion: 'failure' }, null, null)).toMatchObject({ conclusion: 'failure', passes: null, cost_usd: null });
  });

  it('shows a run still in progress as running', () => {
    expect(sweepRun({ ...run, status: 'in_progress', conclusion: '' }, null, null).conclusion).toBe('running');
  });
});
