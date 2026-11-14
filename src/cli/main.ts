import { readFileSync } from 'node:fs';
import { isLang, resolveLang, t } from '../i18n/index.js';
import type { Lang, MessageKey } from '../i18n/index.js';
import { fixtureNames } from './fixtures.js';
import { formatDetail, formatRow, toJson } from './format.js';
import { ProbeError, probeFixture, probeReal } from './probe.js';
import type { ProbeResult } from './probe.js';

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
}

class UsageError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params: Record<string, string | number> = {},
  ) {
    super(key);
  }
}

const BOOLEAN_FLAGS = new Set(['--compare', '--json', '--raw', '--start-in-reasoning', '--help', '-h', '--version', '-v']);
const VALUE_FLAGS = new Set([
  '--fixture',
  '--base-url',
  '--model',
  '--api-key-env',
  '--prompt',
  '--timeout',
  '--lang',
]);

interface Parsed {
  command?: string;
  flags: Set<string>;
  values: Map<string, string>;
}

function parseArgs(argv: readonly string[]): Parsed {
  const parsed: Parsed = { flags: new Set(), values: new Map() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('-')) {
      if (parsed.command === undefined) parsed.command = arg;
      else throw new UsageError('errUnknownOption', { flag: arg });
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (BOOLEAN_FLAGS.has(name)) {
      parsed.flags.add(name);
    } else if (VALUE_FLAGS.has(name)) {
      let value: string | undefined = eq === -1 ? argv[i + 1] : arg.slice(eq + 1);
      if (eq === -1) {
        if (value === undefined || value.startsWith('--')) value = undefined;
        else i++;
      }
      if (value === undefined) throw new UsageError('errMissingValue', { flag: name });
      parsed.values.set(name, value);
    } else {
      throw new UsageError('errUnknownOption', { flag: name });
    }
  }
  return parsed;
}

function version(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/** Look at `--lang` first so that even argument errors come out in the right language. */
function langFromArgv(argv: readonly string[], env: Record<string, string | undefined>): Lang {
  let flag: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--lang') flag = argv[i + 1];
    else if (a.startsWith('--lang=')) flag = a.slice(7);
  }
  return resolveLang(flag !== undefined && isLang(flag) ? flag : undefined, env);
}

function probeErrorMessage(lang: Lang, err: ProbeError): string {
  const key = {
    'unknown-fixture': 'errUnknownFixture',
    'fixture-read': 'errFixtureRead',
    'no-key': 'errNoKey',
    connect: 'errConnect',
    http: 'errHttp',
    timeout: 'errTimeout',
    stream: 'errStream',
  }[err.code] as MessageKey;
  return t(lang, key, err.params);
}

/**
 * CLI entry point. Returns the exit code: 0 ok, 1 run error, 2 bad arguments.
 * `env` and `io` are injected so tests can run it in-process.
 */
export async function main(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  io: Io,
): Promise<number> {
  const lang = langFromArgv(argv, env);
  try {
    const parsed = parseArgs(argv);
    const langValue = parsed.values.get('--lang');
    if (langValue !== undefined && !isLang(langValue)) {
      throw new UsageError('errBadLang', { value: langValue });
    }
    if (parsed.flags.has('--help') || parsed.flags.has('-h') || (argv.length === 0)) {
      io.out(t(lang, 'help').trimEnd());
      return 0;
    }
    if (parsed.flags.has('--version') || parsed.flags.has('-v')) {
      io.out(version());
      return 0;
    }
    if (parsed.command !== 'probe') {
      throw new UsageError('errUnknownCommand', { cmd: parsed.command ?? '' });
    }
    return await runProbe(parsed, lang, env, io);
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(t(lang, 'errBadArgs', { detail: t(lang, err.key, err.params) }));
      return 2;
    }
    if (err instanceof ProbeError) {
      io.err(probeErrorMessage(lang, err));
      return 1;
    }
    io.err(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

async function runProbe(
  parsed: Parsed,
  lang: Lang,
  env: Record<string, string | undefined>,
  io: Io,
): Promise<number> {
  const fixture = parsed.values.get('--fixture');
  const baseUrl = parsed.values.get('--base-url');
  const model = parsed.values.get('--model');
  if (fixture === undefined && baseUrl === undefined) throw new UsageError('errNoSource');
  if (fixture !== undefined && baseUrl !== undefined) throw new UsageError('errBothSources');
  if (baseUrl !== undefined && model === undefined) throw new UsageError('errNeedModel');

  const timeoutText = parsed.values.get('--timeout') ?? '60';
  const timeoutSeconds = Number(timeoutText);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new UsageError('errBadTimeout', { value: timeoutText });
  }

  const compare = parsed.flags.has('--compare');
  const asJson = parsed.flags.has('--json');
  const startInReasoning = parsed.flags.has('--start-in-reasoning');
  const results: ProbeResult[] = [];

  if (fixture !== undefined) {
    const names = fixture === 'all' ? fixtureNames() : [fixture];
    for (const name of names) {
      results.push(
        await probeFixture({ fixture: name, compare, raw: parsed.flags.has('--raw'), startInReasoning }),
      );
    }
    if (!asJson) io.out(t(lang, 'mockNote'));
  } else if (baseUrl !== undefined && model !== undefined) {
    if (!asJson) io.out(t(lang, 'realNote', { url: baseUrl }));
    results.push(
      await probeReal({
        baseUrl,
        model,
        apiKeyEnv: parsed.values.get('--api-key-env'),
        prompt: parsed.values.get('--prompt') ?? 'What is 2 + 2? Think it through, then answer briefly.',
        timeoutSeconds,
        compare,
        startInReasoning,
        env,
      }),
    );
  }

  if (asJson) {
    const rows = results.map(toJson);
    io.out(JSON.stringify(fixture === 'all' ? rows : rows[0], null, 2));
  } else if (fixture === 'all') {
    const width = Math.max(...results.map((r) => r.name.length));
    for (const r of results) io.out(formatRow(lang, r, width));
  } else {
    for (const r of results) io.out(formatDetail(lang, r));
  }
  return 0;
}
