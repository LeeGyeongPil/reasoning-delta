import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  version: string;
  dependencies?: Record<string, string>;
};

let installDir = '';
let packedFiles: string[] = [];

function sh(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

beforeAll(() => {
  const dest = mkdtempSync(join(tmpdir(), 'rd-pack-'));
  const json = sh('npm', ['pack', '--json', '--pack-destination', dest], root);
  const info = (JSON.parse(json) as Array<{ filename: string; files: Array<{ path: string }> }>)[0]!;
  packedFiles = info.files.map((f) => f.path);

  installDir = mkdtempSync(join(tmpdir(), 'rd-install-'));
  writeFileSync(join(installDir, 'package.json'), '{"name":"consumer","version":"1.0.0","private":true}');
  sh('npm', ['install', join(dest, info.filename), '--no-audit', '--no-fund', '--offline'], installDir);
}, 180_000);

describe('packed tarball (AC-9)', () => {
  it('ESM import exposes normalizeReasoning', () => {
    const out = sh(
      'node',
      ['--input-type=module', '-e', "import { normalizeReasoning } from 'reasoning-delta'; console.log(typeof normalizeReasoning)"],
      installDir,
    );
    expect(out.trim()).toBe('function');
  });

  it('CJS require exposes normalizeReasoning', () => {
    const out = sh('node', ['-e', "console.log(typeof require('reasoning-delta').normalizeReasoning)"], installDir);
    expect(out.trim()).toBe('function');
  });

  it('npx reasoning-delta --version prints the package version', () => {
    const out = sh('npx', ['--no-install', 'reasoning-delta', '--version'], installDir);
    expect(out.trim()).toBe(pkg.version);
  });

  it('the installed CLI runs a probe', () => {
    const out = sh('npx', ['--no-install', 'reasoning-delta', 'probe', '--fixture', 'legacy-both', '--lang', 'en'], installDir);
    expect(out).toContain('dialect: legacy_both');
  });

  it('includes type declarations and fixtures', () => {
    expect(packedFiles).toContain('dist/index.d.ts');
    expect(packedFiles).toContain('dist/cli.js');
    expect(packedFiles).toContain('fixtures/legacy-both.sse');
    expect(packedFiles).toContain('fixtures/expected.json');
    expect(packedFiles.some((f) => f.startsWith('test/'))).toBe(false);
  });

  it('has no runtime dependencies', () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });
});
