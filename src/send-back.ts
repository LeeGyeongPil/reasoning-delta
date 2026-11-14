import { resolveProfile } from './profiles.js';
import { TagSplitter } from './tag-splitter.js';
import type { MessageLike, ProfileName, ServerProfile } from './types.js';

const REASONING_KEYS = ['reasoning_content', 'reasoning', 'reasoning_details', 'reasoningDetails'] as const;

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

/** Remove a leading `<think>…</think>` block from text, returning both parts. */
function stripLeadingBlock(content: string): { content: string; reasoning: string } {
  const splitter = new TagSplitter({ mode: 'leading' });
  const segments = [...splitter.push(content), ...splitter.end()];
  let text = '';
  let reasoning = '';
  for (const s of segments) {
    if (s.kind === 'text') text += s.text;
    else reasoning += s.text;
  }
  return { content: text, reasoning };
}

/**
 * Prepare conversation history for the next request to a given server.
 * Reasoning fields are read from each assistant message, removed, and written back
 * the way the profile says. The input is not modified; a new array is returned.
 *
 * @param opts.hasTools Defaults to true when the history has tool calls or tool messages.
 */
export function toServerMessages<M extends MessageLike>(
  history: readonly M[],
  profile: ProfileName | ServerProfile,
  opts: { hasTools?: boolean } = {},
): M[] {
  const rule = resolveProfile(profile).sendBack;
  const hasTools =
    opts.hasTools ??
    history.some(
      (m) =>
        m.role === 'tool' || (Array.isArray(m.tool_calls) && (m.tool_calls as unknown[]).length > 0),
    );
  const writePlain = rule.field !== null && (rule.when === 'always' || (rule.when === 'with-tools' && hasTools));

  return history.map((message) => {
    if (message.role !== 'assistant') return message;

    let reasoning = firstString(message.reasoning_content, message.reasoning);
    let content = message.content;
    if (typeof content === 'string') {
      const stripped = stripLeadingBlock(content);
      content = stripped.content;
      reasoning ??= firstString(stripped.reasoning);
    }
    const details = message.reasoning_details ?? message.reasoningDetails ?? undefined;

    const copy: Record<string, unknown> = { ...message };
    for (const key of REASONING_KEYS) delete copy[key];
    if (message.content !== undefined) copy.content = content;

    if (writePlain && rule.field !== null) {
      if (reasoning !== undefined || rule.when === 'with-tools') copy[rule.field] = reasoning ?? '';
    }
    if (rule.details && Array.isArray(details) && details.length > 0) {
      copy.reasoning_details = details;
    }
    return copy as M;
  });
}
