import { readFileSync } from 'node:fs';
import { collect, fromSSE, normalizeReasoning } from '../../src/index.js';
import type { ChunkLike, NormalizeOptions, ReasoningEvent } from '../../src/index.js';

const dir = new URL('../../fixtures/', import.meta.url);

export interface Expected {
  reasoning: string;
  text: string;
  dialect: string;
  mimics: string;
  options?: NormalizeOptions;
}

export const expected: Record<string, Expected> = JSON.parse(
  readFileSync(new URL('expected.json', dir), 'utf8'),
);

export function fixtureText(name: string): string {
  return readFileSync(new URL(name + '.sse', dir), 'utf8');
}

export async function* bytesOf(data: Uint8Array, sizes: () => number): AsyncGenerator<Uint8Array> {
  let pos = 0;
  while (pos < data.length) {
    const n = Math.max(1, sizes());
    yield data.slice(pos, pos + n);
    pos += n;
  }
}

export async function chunksOf(name: string): Promise<ChunkLike[]> {
  const bytes = new TextEncoder().encode(fixtureText(name));
  const out: ChunkLike[] = [];
  for await (const c of fromSSE(bytesOf(bytes, () => 1_000_000))) out.push(c);
  return out;
}

export async function* iter<T>(items: readonly T[]): AsyncGenerator<T> {
  for (const i of items) yield i;
}

export async function run(source: AsyncIterable<ChunkLike>, options?: NormalizeOptions) {
  const events: ReasoningEvent[] = [];
  for await (const ev of normalizeReasoning(source, options)) events.push(ev);
  let reasoning = '';
  let text = '';
  for (const ev of events) {
    if (ev.type === 'reasoning') reasoning += ev.text;
    if (ev.type === 'text') text += ev.text;
  }
  const done = events.at(-1);
  if (done?.type !== 'done') throw new Error('stream did not end with done');
  return { events, reasoning, text, done };
}

export async function runFixture(name: string, options?: NormalizeOptions) {
  return run(iter(await chunksOf(name)), options ?? expected[name]?.options);
}

export async function collectFixture(name: string, options?: NormalizeOptions) {
  return collect(normalizeReasoning(iter(await chunksOf(name)), options ?? expected[name]?.options));
}

/** Small seeded generator (mulberry32) so fuzz runs are reproducible. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
