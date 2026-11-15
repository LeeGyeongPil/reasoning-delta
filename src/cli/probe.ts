import { readFileSync } from 'node:fs';
import { normalizeReasoning } from '../normalize.js';
import { fromSSE } from '../sse.js';
import type { ChunkLike, Dialect, NormalizeOptions, Warning } from '../types.js';
import { issuesOf, naiveRead } from './compare.js';
import type { IssueKind, Reading } from './compare.js';
import { expectedOutcomes, fixtureNames, readFixture } from './fixtures.js';
import type { FixtureInfo } from './fixtures.js';

export interface ProbeResult {
  name: string;
  /** `fixture` for the practice mock, `real` for a live endpoint. */
  mode: 'fixture' | 'real';
  dialect: Dialect;
  reasoning: string;
  text: string;
  warnings: Warning[];
  finishReason: string | null;
  options: NormalizeOptions;
  firstReasoningMs?: number;
  firstTextMs?: number;
  naiveIssues?: IssueKind[];
  normalizedIssues?: IssueKind[];
}

export class ProbeError extends Error {
  constructor(
    readonly code:
      | 'unknown-fixture'
      | 'fixture-read'
      | 'no-key'
      | 'connect'
      | 'http'
      | 'timeout'
      | 'stream',
    readonly params: Record<string, string | number>,
  ) {
    super(code);
    this.name = 'ProbeError';
  }
}

async function* items<T>(list: readonly T[]): AsyncGenerator<T> {
  for (const i of list) yield i;
}

/** Run one stream through the normalizer and measure it. `chunks` is filled as a side effect. */
async function measure(
  name: string,
  mode: 'fixture' | 'real',
  source: AsyncIterable<ChunkLike>,
  options: NormalizeOptions,
  expected: Reading | undefined,
  compare: boolean,
): Promise<ProbeResult> {
  const chunks: ChunkLike[] = [];
  async function* recorded(): AsyncGenerator<ChunkLike> {
    for await (const c of source) {
      chunks.push(c);
      yield c;
    }
  }
  const started = performance.now();
  const result: ProbeResult = {
    name,
    mode,
    dialect: 'none',
    reasoning: '',
    text: '',
    warnings: [],
    finishReason: null,
    options,
  };
  for await (const ev of normalizeReasoning(recorded(), options)) {
    if (ev.type === 'reasoning') {
      result.reasoning += ev.text;
      result.firstReasoningMs ??= Math.round(performance.now() - started);
    } else if (ev.type === 'text') {
      result.text += ev.text;
      result.firstTextMs ??= Math.round(performance.now() - started);
    } else if (ev.type === 'done') {
      result.dialect = ev.dialect;
      result.warnings = ev.warnings;
      result.finishReason = ev.finishReason;
    }
  }
  if (compare) {
    // Without a documented expectation the normalized reading is the reference.
    const reference = expected ?? { reasoning: result.reasoning, text: result.text };
    result.naiveIssues = issuesOf(naiveRead(chunks), reference);
    result.normalizedIssues = issuesOf({ reasoning: result.reasoning, text: result.text }, reference);
  }
  return result;
}

export interface FixtureRunOptions {
  /** A bundled name or a path to a .sse file. */
  fixture: string;
  compare: boolean;
  /** Ignore the options a bundled fixture declares. */
  raw: boolean;
  startInReasoning: boolean;
}

export async function probeFixture(opts: FixtureRunOptions): Promise<ProbeResult> {
  const known = expectedOutcomes();
  let text: string;
  let info: FixtureInfo | undefined;
  if (fixtureNames().includes(opts.fixture)) {
    text = readFixture(opts.fixture);
    info = known[opts.fixture];
  } else {
    info = undefined;
    try {
      text = readFileSync(opts.fixture, 'utf8');
    } catch (err) {
      const isPath = /[\\/]|\.sse$/.test(opts.fixture);
      if (!isPath) {
        throw new ProbeError('unknown-fixture', { name: opts.fixture, list: fixtureNames().join(', ') });
      }
      throw new ProbeError('fixture-read', {
        path: opts.fixture,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const options: NormalizeOptions = { ...(opts.raw ? {} : (info?.options ?? {})) };
  if (opts.startInReasoning) options.startInReasoning = true;
  const parsed: ChunkLike[] = [];
  for await (const c of fromSSE(items([text]))) parsed.push(c);
  const expected = info === undefined ? undefined : { reasoning: info.reasoning, text: info.text };
  return measure(opts.fixture, 'fixture', items(parsed), options, expected, opts.compare);
}

export interface RealRunOptions {
  baseUrl: string;
  model: string;
  apiKeyEnv?: string;
  prompt: string;
  timeoutSeconds: number;
  compare: boolean;
  startInReasoning: boolean;
  env: Record<string, string | undefined>;
}

/** Ask a live OpenAI-compatible endpoint a short question and report its dialect. */
export async function probeReal(opts: RealRunOptions): Promise<ProbeResult> {
  const keyName = opts.apiKeyEnv ?? 'OPENAI_API_KEY';
  const key = opts.env[keyName];
  if (opts.apiKeyEnv !== undefined && (key === undefined || key === '')) {
    throw new ProbeError('no-key', { name: keyName });
  }
  const url = opts.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.authorization = 'Bearer ' + key;
  const signal = AbortSignal.timeout(opts.timeoutSeconds * 1000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: opts.model,
        stream: true,
        max_tokens: 512,
        messages: [{ role: 'user', content: opts.prompt }],
      }),
    });
  } catch (err) {
    if (signal.aborted) throw new ProbeError('timeout', { seconds: opts.timeoutSeconds });
    throw new ProbeError('connect', {
      url: opts.baseUrl,
      detail: err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err),
    });
  }
  if (!res.ok || res.body === null) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new ProbeError('http', { status: res.status, detail });
  }
  const options: NormalizeOptions = opts.startInReasoning ? { startInReasoning: true } : {};
  try {
    return await measure(opts.model, 'real', fromSSE(res.body), options, undefined, opts.compare);
  } catch (err) {
    if (signal.aborted) throw new ProbeError('timeout', { seconds: opts.timeoutSeconds });
    const type = res.headers.get('content-type') ?? 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    throw new ProbeError('stream', { detail: '(content-type: ' + type + ') ' + message });
  }
}
