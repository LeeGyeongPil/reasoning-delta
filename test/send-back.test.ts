import { describe, expect, it } from 'vitest';
import { UnknownProfileError, defineProfile, profiles, toServerMessages } from '../src/index.js';
import type { MessageLike } from '../src/index.js';

const details = [
  { type: 'reasoning.text', text: 'Let me ', index: 0 },
  { type: 'reasoning.encrypted', data: 'abc', index: 1 },
];

const toolHistory = (): MessageLike[] => [
  { role: 'user', content: 'Weather in Seoul?' },
  {
    role: 'assistant',
    content: 'Checking.',
    reasoning_content: 'Need the weather.',
    reasoning_details: details,
    tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_weather', arguments: '{}' } }],
  },
  { role: 'tool', tool_call_id: 'c1', content: 'sunny' },
  { role: 'assistant', content: 'It is sunny.' },
];

const plainHistory = (): MessageLike[] => [
  { role: 'user', content: 'Hi' },
  { role: 'assistant', content: 'Hello.', reasoning_content: 'Greet.' },
];

describe('toServerMessages (AC-5)', () => {
  it('deepseek with tool history puts reasoning_content on every assistant message', () => {
    const out = toServerMessages(toolHistory(), 'deepseek');
    const assistants = out.filter((m) => m.role === 'assistant');
    expect(assistants).toHaveLength(2);
    expect(assistants[0]!.reasoning_content).toBe('Need the weather.');
    expect(assistants[1]!.reasoning_content).toBe('');
    expect(out.every((m) => m.reasoning_details === undefined)).toBe(true);
  });

  it('deepseek without tools has no reasoning field', () => {
    const out = toServerMessages(plainHistory(), 'deepseek');
    expect('reasoning_content' in out[1]!).toBe(false);
    expect('reasoning' in out[1]!).toBe(false);
  });

  it('hasTools overrides detection', () => {
    const out = toServerMessages(plainHistory(), 'deepseek', { hasTools: true });
    expect(out[1]!.reasoning_content).toBe('Greet.');
  });

  it('openrouter keeps reasoning_details unchanged and adds reasoning', () => {
    const out = toServerMessages(toolHistory(), 'openrouter');
    const first = out[1]!;
    expect(first.reasoning_details).toEqual(details);
    expect(first.reasoning).toBe('Need the weather.');
    expect('reasoning_content' in first).toBe(false);
  });

  for (const name of ['strict', 'vllm'] as const) {
    it(name + ' removes every reasoning field', () => {
      const out = toServerMessages(toolHistory(), name);
      for (const m of out) {
        expect('reasoning_content' in m).toBe(false);
        expect('reasoning' in m).toBe(false);
        expect('reasoning_details' in m).toBe(false);
      }
      expect(out[1]!.tool_calls).toBeDefined();
    });
  }

  it('removes a leading <think> block from assistant content and keeps it as reasoning', () => {
    const history: MessageLike[] = [
      { role: 'assistant', content: '<think>Plan it.</think>\n\nDone.' },
    ];
    expect(toServerMessages(history, 'strict')[0]!.content).toBe('Done.');
    const ds = toServerMessages(history, 'deepseek', { hasTools: true })[0]!;
    expect(ds.content).toBe('Done.');
    expect(ds.reasoning_content).toBe('Plan it.');
  });

  it('does not mutate the input', () => {
    const history = toolHistory();
    const snapshot = structuredClone(history);
    toServerMessages(history, 'strict');
    toServerMessages(history, 'deepseek');
    toServerMessages(history, 'openrouter');
    expect(history).toEqual(snapshot);
  });

  it('throws UnknownProfileError for an unknown profile name', () => {
    expect(() => toServerMessages([], 'nope' as never)).toThrow(UnknownProfileError);
    try {
      toServerMessages([], 'nope' as never);
    } catch (err) {
      expect((err as UnknownProfileError).profile).toBe('nope');
      expect((err as Error).message).toContain('deepseek');
    }
  });

  it('accepts a custom profile', () => {
    const custom = defineProfile({
      ...profiles.vllm,
      name: 'my-vllm',
      sendBack: { field: 'reasoning', when: 'always', details: false },
      verified: true,
    });
    expect(toServerMessages(plainHistory(), custom)[1]!.reasoning).toBe('Greet.');
  });

  it('every built-in profile names its checked date, and verified ones have a source', () => {
    expect(Object.keys(profiles)).toHaveLength(8);
    for (const p of Object.values(profiles)) {
      expect(p.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (p.verified && p.name !== 'strict') expect(p.sources.length).toBeGreaterThan(0);
    }
  });
});
