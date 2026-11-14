import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../src/cli/main.js';
import { startMockServer } from './helpers/mock-server.js';

async function cli(argv: string[], env: Record<string, string | undefined> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, env, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('probe CLI in mock mode (AC-7)', () => {
  it('shows the dialect of all 10 fixtures with naive vs normalized issue counts', async () => {
    const r = await cli(['probe', '--fixture', 'all', '--compare', '--lang', 'en']);
    expect(r.code).toBe(0);
    const rows = r.out.split('\n').filter((l) => l.includes(' | dialect '));
    expect(rows).toHaveLength(10);
    for (const row of rows) expect(row).toContain('normalized: 0 issues');
    const legacy = rows.find((l) => l.startsWith('legacy-both'))!;
    expect(legacy).toContain('dialect legacy_both');
    const withNaiveIssues = rows.filter((l) => /naive: [1-9]\d* issues?/.test(l));
    expect(withNaiveIssues.length).toBeGreaterThanOrEqual(2);
    expect(withNaiveIssues.some((l) => l.startsWith('think-tag-split'))).toBe(true);
    expect(withNaiveIssues.some((l) => l.startsWith('legacy-both'))).toBe(true);
    expect(r.out).toContain('practice mock');
  });

  it('--raw shows the stray-close-tag warning and the recommendation', async () => {
    const r = await cli(['probe', '--fixture', 'think-open-omitted', '--raw', '--lang', 'en']);
    expect(r.out).toContain('stray-close-tag');
    expect(r.out).toContain('--start-in-reasoning');
  });

  it('--json prints parseable JSON', async () => {
    const r = await cli(['probe', '--fixture', 'legacy-both', '--json', '--compare']);
    const parsed = JSON.parse(r.out) as { dialect: string; reasoning: string; normalizedIssues: string[] };
    expect(parsed.dialect).toBe('legacy_both');
    expect(parsed.reasoning).toBe('Let me add 2 and 2.');
    expect(parsed.normalizedIssues).toEqual([]);
  });

  it('a .sse file path works', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rd-'));
    const file = join(dir, 'mine.sse');
    writeFileSync(file, 'data: {"choices":[{"delta":{"reasoning":"hm"}}]}\n\ndata: [DONE]\n\n');
    const r = await cli(['probe', '--fixture', file, '--lang', 'en']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('dialect: reasoning');
  });

  it('unknown fixture exits 1 with a fix hint', async () => {
    const r = await cli(['probe', '--fixture', 'nope', '--lang', 'en']);
    expect(r.code).toBe(1);
    expect(r.err).toContain('Available:');
  });

  it('bad arguments exit 2', async () => {
    for (const argv of [
      ['probe'],
      ['probe', '--bogus'],
      ['probe', '--fixture'],
      ['probe', '--base-url', 'http://x'],
      ['probe', '--fixture', 'all', '--base-url', 'http://x', '--model', 'm'],
      ['probe', '--fixture', 'all', '--timeout', 'abc'],
      ['probe', '--fixture', 'all', '--lang', 'fr'],
      ['frobnicate'],
    ]) {
      const r = await cli(argv, {});
      expect(r.code, argv.join(' ')).toBe(2);
      expect(r.err).not.toBe('');
    }
  });

  it('--version prints the package version', async () => {
    const r = await cli(['--version']);
    expect(r.out).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('probe CLI in real mode against a local server', () => {
  it('probes a 127.0.0.1 endpoint and reports latencies', async () => {
    const server = await startMockServer(40);
    try {
      const r = await cli(['probe', '--base-url', server.baseUrl('legacy-both'), '--model', 'm', '--lang', 'en']);
      expect(r.code).toBe(0);
      expect(r.out).toContain('dialect: legacy_both');
      expect(r.out).toContain('first reasoning:');
    } finally {
      await server.close();
    }
  });

  it('reports a connection failure with exit code 1', async () => {
    const r = await cli(['probe', '--base-url', 'http://127.0.0.1:9/v1', '--model', 'm', '--lang', 'en']);
    expect(r.code).toBe(1);
    expect(r.err).toContain('Could not reach');
  });

  it('a missing API key variable is a clear error', async () => {
    const r = await cli(
      ['probe', '--base-url', 'http://127.0.0.1:9/v1', '--model', 'm', '--api-key-env', 'NOPE_KEY', '--lang', 'en'],
      {},
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain('NOPE_KEY');
  });
});
