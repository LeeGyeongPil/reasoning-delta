import { describe, expect, it } from 'vitest';
import { fromSSE } from '../src/index.js';
import type { ChunkLike } from '../src/index.js';
import { bytesOf, expected, fixtureText, iter, run, seeded } from './helpers/fixtures.js';

const RUNS = 2000;
const FIXTURES = ['think-tag-split', 'think-open-omitted', 'korean-reasoning'] as const;

/** Re-cut the fixture's `content` into chunk objects of the sizes `next()` returns (in UTF-16 units). */
function recut(name: string, full: string, next: () => number): ChunkLike[] {
  const chunks: ChunkLike[] = [];
  let pos = 0;
  while (pos < full.length) {
    const n = Math.max(1, next());
    chunks.push({ choices: [{ index: 0, delta: { content: full.slice(pos, pos + n) }, finish_reason: null }] });
    pos += n;
  }
  chunks.push({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
  void name;
  return chunks;
}

function fullContent(name: string): string {
  let full = '';
  for (const block of fixtureText(name).split('\n\n')) {
    const line = block.split('\n').find((l) => l.startsWith('data: {'));
    if (!line) continue;
    const delta = (JSON.parse(line.slice(6)) as ChunkLike).choices?.[0]?.delta;
    if (typeof delta?.content === 'string') full += delta.content;
  }
  return full;
}

function assertClean(name: string, r: { reasoning: string; text: string }) {
  const want = expected[name]!;
  expect(r.reasoning).toBe(want.reasoning);
  expect(r.text).toBe(want.text);
  // No partial tag fragment may leak into either part.
  expect(r.text).not.toMatch(/<\/?t?h?i?n?k?>?|<\/?$/);
  expect(r.reasoning).not.toMatch(/<\/?t?h?i?n?k?>?|<\/?$/);
}

describe('chunk-boundary fuzz (AC-2)', () => {
  for (const name of FIXTURES) {
    const options = expected[name]!.options;
    const full = fullContent(name);

    it(name + ': ' + RUNS + ' seeded random 1-6 char chunk splits', async () => {
      const rand = seeded(1234 + name.length);
      let runs = 0;
      for (let i = 0; i < RUNS; i++) {
        runs++;
        const chunks = recut(name, full, () => 1 + Math.floor(rand() * 6));
        assertClean(name, await run(iter(chunks), options));
      }
      expect(runs).toBeGreaterThanOrEqual(2000);
      console.log('fuzz ' + name + ': chunk-object level, ' + RUNS + ' random runs, 0 failures');
    });

    it(name + ': 1-char splits at chunk-object level', async () => {
      assertClean(name, await run(iter(recut(name, full, () => 1)), options));
    });

    it(name + ': ' + RUNS + ' seeded random 1-6 byte splits at SSE byte level', async () => {
      const rand = seeded(99 + name.length);
      const bytes = new TextEncoder().encode(fixtureText(name));
      let runs = 0;
      for (let i = 0; i < RUNS; i++) {
        runs++;
        const source = fromSSE(bytesOf(bytes, () => 1 + Math.floor(rand() * 6)));
        assertClean(name, await run(source, options));
      }
      expect(runs).toBeGreaterThanOrEqual(2000);
      console.log('fuzz ' + name + ': SSE byte level, ' + RUNS + ' random runs, 0 failures');
    });

    it(name + ': 1-byte SSE splits (cuts inside multi-byte characters)', async () => {
      const bytes = new TextEncoder().encode(fixtureText(name));
      assertClean(name, await run(fromSSE(bytesOf(bytes, () => 1)), options));
    });
  }

  it('the Korean fixture really has multi-byte characters to cut', () => {
    const bytes = new TextEncoder().encode(fixtureText('korean-reasoning'));
    expect(bytes.length).toBeGreaterThan(fixtureText('korean-reasoning').length);
  });
});
