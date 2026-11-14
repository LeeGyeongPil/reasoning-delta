import { describe, expect, it } from 'vitest';
import { toAssistantMessage } from '../src/index.js';
import { chunksOf, collectFixture, runFixture } from './helpers/fixtures.js';

describe('events and collect (AC-4)', () => {
  it('tool-call-deepseek keeps index, id, name and arguments', async () => {
    const r = await runFixture('tool-call-deepseek');
    const calls = r.events.filter((e) => e.type === 'tool_call_delta');
    expect(calls).toEqual([
      { type: 'tool_call_delta', index: 0, id: 'call_1', name: 'get_weather' },
      { type: 'tool_call_delta', index: 0, arguments: '{"city":' },
      { type: 'tool_call_delta', index: 0, arguments: '"Seoul"}' },
    ]);
  });

  it('a chunk with reasoning and content emits reasoning, then text', async () => {
    const r = await runFixture('tool-call-deepseek');
    const types = r.events.map((e) => e.type);
    const i = r.events.findIndex((e) => e.type === 'text');
    expect(types[i - 1]).toBe('reasoning');
    expect(r.events[i - 1]).toMatchObject({ type: 'reasoning', text: ' Call the tool.' });
    expect(r.events[i]).toEqual({ type: 'text', text: 'Checking.' });
  });

  it('collect joins tool arguments into valid JSON with finishReason tool_calls', async () => {
    const turn = await collectFixture('tool-call-deepseek');
    expect(turn.finishReason).toBe('tool_calls');
    expect(turn.toolCalls).toHaveLength(1);
    expect(JSON.parse(turn.toolCalls[0]!.arguments)).toEqual({ city: 'Seoul' });
    expect(turn.toolCalls[0]).toMatchObject({ id: 'call_1', name: 'get_weather' });
    expect(turn.reasoning).toBe('I need the weather. Call the tool.');
  });

  it('openrouter-details emits reasoning_details in order and collect keeps them unchanged', async () => {
    const source = await chunksOf('openrouter-details');
    const original = source.flatMap((c) => c.choices?.[0]?.delta?.reasoning_details ?? []);
    const r = await runFixture('openrouter-details');
    const emitted = r.events.flatMap((e) => (e.type === 'reasoning_details' ? e.details : []));
    expect(emitted).toEqual(original);
    expect(original).toHaveLength(3);
    const turn = await collectFixture('openrouter-details');
    expect(turn.reasoningDetails).toEqual(original);
  });

  it('done is the last event and carries finish reason', async () => {
    const r = await runFixture('reasoning-content');
    expect(r.events.at(-1)).toMatchObject({ type: 'done', finishReason: 'stop' });
  });

  it('toAssistantMessage turns a collected turn into a history message', async () => {
    const turn = await collectFixture('tool-call-deepseek');
    const msg = toAssistantMessage(turn);
    expect(msg).toMatchObject({
      role: 'assistant',
      content: 'Checking.',
      reasoning_content: 'I need the weather. Call the tool.',
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather' } }],
    });
  });
});
