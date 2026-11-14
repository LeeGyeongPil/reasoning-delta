import { describe, expect, it } from 'vitest';
import { TagSplitter } from '../src/index.js';
import type { ChunkLike } from '../src/index.js';
import { iter, run, runFixture } from './helpers/fixtures.js';

const contentChunks = (...parts: string[]): ChunkLike[] =>
  parts.map((content) => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] }));

describe('edge cases (AC-3)', () => {
  it('legacy-both yields reasoning once and tag-free text', async () => {
    const r = await runFixture('legacy-both');
    expect(r.reasoning).toBe('Let me add 2 and 2.');
    expect(r.text).toBe('The answer is 4.');
    expect(r.done.type === 'done' && r.done.dialect).toBe('legacy_both');
    expect(r.events.filter((e) => e.type === 'reasoning' && e.source === 'tag')).toEqual([]);
  });

  it('a literal <think> inside the answer stays text under the default tagMode', async () => {
    const r = await runFixture('literal-tag-in-answer');
    expect(r.text).toBe('Wrap reasoning in a <think> tag.');
    expect(r.reasoning).toBe('Explain the tag.');
  });

  it('tagMode "anywhere" does split a later <think> block', async () => {
    const r = await run(iter(contentChunks('Hello <thi', 'nk>hidden</think> world')), {
      tagMode: 'anywhere',
    });
    expect(r.text).toBe('Hello world');
    expect(r.reasoning).toBe('hidden');
  });

  it('tagMode "off" leaves tags in the text', async () => {
    const r = await run(iter(contentChunks('<think>a</think>b')), { tagMode: 'off' });
    expect(r.text).toBe('<think>a</think>b');
    expect(r.reasoning).toBe('');
  });

  it('a stray </think> without startInReasoning warns and keeps the text', async () => {
    const r = await runFixture('think-open-omitted', { startInReasoning: false });
    expect(r.done.type === 'done' && r.done.warnings).toContain('stray-close-tag');
    expect(r.reasoning).toBe('');
    expect(r.text).toContain('</think>');
  });

  it('startInReasoning removes the warning and splits correctly', async () => {
    const r = await runFixture('think-open-omitted', { startInReasoning: true });
    expect(r.done.type === 'done' && r.done.warnings).toEqual([]);
    expect(r.reasoning).toBe('Let me add 2 and 2.');
    expect(r.text).toBe('The answer is 4.');
  });

  it('an unclosed tag warns and flushes the held fragment as reasoning', async () => {
    const r = await run(iter(contentChunks('<think>Let me think</thi')));
    expect(r.done.type === 'done' && r.done.warnings).toContain('unclosed-tag');
    expect(r.reasoning).toBe('Let me think</thi');
    expect(r.text).toBe('');
  });

  it('a partial opening tag at the end of the stream is returned as text', async () => {
    const r = await run(iter(contentChunks('<thi')));
    expect(r.text).toBe('<thi');
    expect(r.done.type === 'done' && r.done.warnings).toEqual([]);
  });

  it('differing alias fields warn alias-mismatch', async () => {
    const r = await run(
      iter<ChunkLike>([
        { choices: [{ delta: { reasoning_content: 'a', reasoning: 'b' } }] },
        { choices: [{ delta: { content: 'x' }, finish_reason: 'stop' }] },
      ]),
    );
    expect(r.reasoning).toBe('a');
    expect(r.done.type === 'done' && r.done.warnings).toEqual(['alias-mismatch']);
  });

  it('only follows the requested choice index', async () => {
    const chunks: ChunkLike[] = [
      { choices: [{ index: 1, delta: { content: 'other' } }, { index: 0, delta: { content: 'mine' } }] },
    ];
    expect((await run(iter(chunks))).text).toBe('mine');
    expect((await run(iter(chunks), { choiceIndex: 1 })).text).toBe('other');
  });

  it('throws a readable error when the stream carries an error object', async () => {
    await expect(run(iter<ChunkLike>([{ error: { message: 'boom' } }]))).rejects.toThrow(/boom/);
  });

  it('a custom tag list works', async () => {
    const r = await run(iter(contentChunks('<scratch>x</scratch>y')), { tags: ['scratch'] });
    expect(r.reasoning).toBe('x');
    expect(r.text).toBe('y');
  });

  it('TagSplitter drops whitespace around tags but nothing else', () => {
    const s = new TagSplitter();
    const segs = [...s.push('  <think>\n a b \n</think>\n\n answer '), ...s.end()];
    expect(segs).toEqual([
      { kind: 'reasoning', text: 'a b \n' },
      { kind: 'text', text: 'answer ' },
    ]);
  });
});
