import { StreamError } from './errors.js';
import { resolveProfile } from './profiles.js';
import { TagSplitter } from './tag-splitter.js';
import type {
  ChunkLike,
  DeltaLike,
  Dialect,
  MessageLike,
  NormalizeOptions,
  ReasoningEvent,
  Warning,
} from './types.js';

type DoneEvent = Extract<ReasoningEvent, { type: 'done' }>;

function nonEmpty(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Stateful core shared by the stream and the non-streaming helper. */
class Normalizer {
  private readonly splitter: TagSplitter;
  private field: 'reasoning_content' | 'reasoning' | null = null;
  private readonly warnings: Warning[] = [];
  finishReason: string | null = null;
  usage: unknown = undefined;

  constructor(options: NormalizeOptions) {
    const profile =
      options.profile === undefined || options.profile === 'auto'
        ? undefined
        : resolveProfile(options.profile);
    this.splitter = new TagSplitter({
      tags: options.tags ?? profile?.read.tags,
      mode: options.tagMode ?? profile?.read.tagMode,
      startInReasoning: options.startInReasoning ?? profile?.read.startInReasoning,
    });
  }

  private warn(w: Warning): void {
    if (!this.warnings.includes(w)) this.warnings.push(w);
  }

  private fromSegments(segments: ReturnType<TagSplitter['push']>): ReasoningEvent[] {
    const out: ReasoningEvent[] = [];
    for (const seg of segments) {
      if (seg.kind === 'text') {
        out.push({ type: 'text', text: seg.text });
      } else if (this.field === null) {
        out.push({ type: 'reasoning', text: seg.text, source: 'tag' });
      }
      // else: legacy servers repeat the field reasoning inside <think> tags; keep one copy.
    }
    return out;
  }

  feed(delta: DeltaLike): ReasoningEvent[] {
    const out: ReasoningEvent[] = [];

    const rc = nonEmpty(delta.reasoning_content);
    const rs = nonEmpty(delta.reasoning);
    let fieldText = '';
    if (rc && rs) {
      if (rc !== rs) this.warn('alias-mismatch');
      fieldText = rc;
      this.field ??= 'reasoning_content';
    } else if (rc) {
      fieldText = rc;
      this.field ??= 'reasoning_content';
    } else if (rs) {
      fieldText = rs;
      this.field ??= 'reasoning';
    }
    if (fieldText) this.splitter.cancelImplicitStart();
    if (fieldText) out.push({ type: 'reasoning', text: fieldText, source: 'field' });

    if (Array.isArray(delta.reasoning_details) && delta.reasoning_details.length > 0) {
      out.push({ type: 'reasoning_details', details: delta.reasoning_details });
    }

    const content = nonEmpty(delta.content);
    if (content) out.push(...this.fromSegments(this.splitter.push(content)));

    for (const tc of delta.tool_calls ?? []) {
      const ev: ReasoningEvent = { type: 'tool_call_delta', index: tc.index ?? 0 };
      if (typeof tc.id === 'string' && tc.id) ev.id = tc.id;
      if (typeof tc.function?.name === 'string' && tc.function.name) ev.name = tc.function.name;
      if (typeof tc.function?.arguments === 'string' && tc.function.arguments) {
        ev.arguments = tc.function.arguments;
      }
      out.push(ev);
    }
    return out;
  }

  finish(): { events: ReasoningEvent[]; done: DoneEvent } {
    const events = this.fromSegments(this.splitter.end());
    for (const w of this.splitter.warnings) this.warn(w);
    const tag = this.splitter.foundReasoning;
    let dialect: Dialect = 'none';
    if (this.field !== null && tag) dialect = 'legacy_both';
    else if (this.field !== null) dialect = this.field;
    else if (tag) dialect = 'think_tag';
    const done: DoneEvent = {
      type: 'done',
      dialect,
      finishReason: this.finishReason,
      warnings: [...this.warnings],
    };
    if (this.usage !== undefined) done.usage = this.usage;
    return { events, done };
  }
}

/**
 * Turn the chunks of an OpenAI-compatible chat stream into one event shape.
 * Accepts the openai SDK `Stream`, any async iterable of chunk objects, or `fromSSE(...)`.
 */
export async function* normalizeReasoning(
  source: AsyncIterable<ChunkLike>,
  options: NormalizeOptions = {},
): AsyncGenerator<ReasoningEvent, void, undefined> {
  const n = new Normalizer(options);
  const choiceIndex = options.choiceIndex ?? 0;
  for await (const chunk of source) {
    if (chunk === null || typeof chunk !== 'object') continue;
    if (chunk.error !== undefined && chunk.error !== null) throw new StreamError(chunk.error);
    if (chunk.usage !== undefined && chunk.usage !== null) n.usage = chunk.usage;
    const choice = chunk.choices?.find((c) => (c.index ?? 0) === choiceIndex);
    if (choice === undefined) continue;
    if (typeof choice.finish_reason === 'string') n.finishReason = choice.finish_reason;
    if (choice.delta) yield* n.feed(choice.delta);
  }
  const { events, done } = n.finish();
  yield* events;
  yield done;
}

/**
 * Normalize a complete (non-streaming) assistant message: split tags out of `content`
 * and report where the reasoning came from.
 */
export function normalizeMessage(
  message: Pick<MessageLike, 'content' | 'reasoning_content' | 'reasoning'>,
  options: NormalizeOptions = {},
): { content: string; reasoning: string; dialect: Dialect } {
  const n = new Normalizer(options);
  const delta: DeltaLike = {
    content: typeof message.content === 'string' ? message.content : null,
    reasoning_content: message.reasoning_content ?? null,
    reasoning: message.reasoning ?? null,
  };
  const events = [...n.feed(delta)];
  const fin = n.finish();
  events.push(...fin.events);
  let content = '';
  let reasoning = '';
  for (const ev of events) {
    if (ev.type === 'text') content += ev.text;
    else if (ev.type === 'reasoning') reasoning += ev.text;
  }
  return { content, reasoning, dialect: fin.done.dialect };
}
