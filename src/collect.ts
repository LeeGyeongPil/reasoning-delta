import type { AssistantTurn, MessageLike, ReasoningEvent, ToolCallTurn } from './types.js';

/** Gather a normalized event stream into one assistant turn. */
export async function collect(events: AsyncIterable<ReasoningEvent>): Promise<AssistantTurn> {
  const turn: AssistantTurn = {
    content: '',
    reasoning: '',
    toolCalls: [],
    finishReason: null,
    dialect: 'none',
    warnings: [],
  };
  const calls = new Map<number, ToolCallTurn>();
  const details: unknown[] = [];
  let sawDetails = false;

  for await (const ev of events) {
    switch (ev.type) {
      case 'text':
        turn.content += ev.text;
        break;
      case 'reasoning':
        turn.reasoning += ev.text;
        break;
      case 'reasoning_details':
        sawDetails = true;
        details.push(...ev.details);
        break;
      case 'tool_call_delta': {
        let call = calls.get(ev.index);
        if (call === undefined) {
          call = { index: ev.index, id: '', name: '', arguments: '' };
          calls.set(ev.index, call);
        }
        if (ev.id !== undefined) call.id = ev.id;
        if (ev.name !== undefined) call.name += ev.name;
        if (ev.arguments !== undefined) call.arguments += ev.arguments;
        break;
      }
      case 'done':
        turn.dialect = ev.dialect;
        turn.finishReason = ev.finishReason;
        turn.warnings = ev.warnings;
        if (ev.usage !== undefined) turn.usage = ev.usage;
        break;
    }
  }
  turn.toolCalls = [...calls.values()].sort((a, b) => a.index - b.index);
  if (sawDetails) turn.reasoningDetails = details;
  return turn;
}

/**
 * Convert a collected turn into an assistant message for your history.
 * Reasoning is stored in `reasoning_content` / `reasoning_details`; `toServerMessages`
 * then rewrites them for the server you send the history to.
 */
export function toAssistantMessage(turn: AssistantTurn): MessageLike {
  const message: MessageLike = { role: 'assistant', content: turn.content };
  if (turn.reasoning) message.reasoning_content = turn.reasoning;
  if (turn.reasoningDetails) message.reasoning_details = turn.reasoningDetails;
  if (turn.toolCalls.length > 0) {
    message.tool_calls = turn.toolCalls.map((c) => ({
      id: c.id,
      type: 'function',
      function: { name: c.name, arguments: c.arguments },
    }));
  }
  return message;
}
