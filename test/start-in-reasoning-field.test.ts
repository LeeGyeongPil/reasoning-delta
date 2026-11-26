import { describe, expect, it } from 'vitest';
import { main } from '../src/cli/main.js';
import type { ChunkLike } from '../src/index.js';
import { iter, run } from './helpers/fixtures.js';

const delta = (d: Record<string, string>): ChunkLike => ({
  choices: [{ index: 0, delta: d, finish_reason: null }],
});

describe('startInReasoning with field reasoning (regression)', () => {
  it('keeps the answer when reasoning arrives in reasoning_content first', async () => {
    const r = await run(iter([delta({ reasoning_content: 'abc' }), delta({ content: 'ANS' })]), {
      startInReasoning: true,
    });
    expect(r.text).toBe('ANS');
    expect(r.reasoning).toBe('abc');
    expect(r.done.type === 'done' && r.done.dialect).toBe('reasoning_content');
    expect(r.done.type === 'done' && r.done.warnings).toEqual([]);
  });

  it('still recognises a legacy <think> copy after field reasoning', async () => {
    const r = await run(
      iter([delta({ reasoning_content: 'abc' }), delta({ content: '<think>abc</think>ANS' })]),
      { startInReasoning: true },
    );
    expect(r.text).toBe('ANS');
    expect(r.reasoning).toBe('abc');
    expect(r.done.type === 'done' && r.done.dialect).toBe('legacy_both');
  });

  it('probe --start-in-reasoning on the reasoning-content fixture keeps the text', async () => {
    const out: string[] = [];
    const code = await main(
      ['probe', '--fixture', 'reasoning-content', '--start-in-reasoning', '--lang', 'en'],
      {},
      { out: (l) => out.push(l), err: () => {} },
    );
    const text = out.join('\n');
    expect(code).toBe(0);
    expect(text).toContain('dialect: reasoning_content');
    expect(text).toContain('text: 16 chars');
    expect(text).not.toContain('unclosed-tag');
  });
});
