import { SSEParseError } from './errors.js';
import type { ChunkLike } from './types.js';

type ByteSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array | string>
  | Iterable<Uint8Array | string>
  | string;

async function* pieces(body: ByteSource): AsyncGenerator<Uint8Array | string> {
  if (typeof body === 'string') {
    yield body;
    return;
  }
  if (typeof (body as AsyncIterable<Uint8Array | string>)[Symbol.asyncIterator] === 'function') {
    yield* body as AsyncIterable<Uint8Array | string>;
    return;
  }
  if (typeof (body as Iterable<Uint8Array | string>)[Symbol.iterator] === 'function') {
    yield* body as Iterable<Uint8Array | string>;
    return;
  }
  // Older ReadableStream implementations are not async iterable.
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a Server-Sent Events body into chat completion chunk objects.
 * Handles `\n`, `\r\n` and `\r` line ends, comment lines, multi-line `data:`,
 * the `[DONE]` sentinel, and UTF-8 characters split across byte chunks.
 */
export async function* fromSSE(body: ByteSource): AsyncGenerator<ChunkLike, void, undefined> {
  const decoder = new TextDecoder('utf-8');
  let text = '';
  let data: string[] = [];
  let sawData = false;
  // Start of any non-comment content, kept to describe a body that is not SSE.
  let stray = '';

  // Returns the parsed chunk, `null` for [DONE], or `undefined` when there is no data.
  const dispatch = (): ChunkLike | null | undefined => {
    if (data.length === 0) return undefined;
    const payload = data.join('\n');
    data = [];
    if (payload.trim() === '[DONE]') return null;
    try {
      return JSON.parse(payload) as ChunkLike;
    } catch (err) {
      throw new SSEParseError(payload, err);
    }
  };

  const handleLine = (line: string): ChunkLike | null | undefined => {
    if (line === '') return dispatch();
    if (line.startsWith(':')) return undefined;
    if (stray.length < 120 && line.trim() !== '') stray += (stray === '' ? '' : '\n') + line;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== 'data') return undefined;
    sawData = true;
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    data.push(value);
    return undefined;
  };

  for await (const part of pieces(body)) {
    text += typeof part === 'string' ? part : decoder.decode(part, { stream: true });
    for (;;) {
      const m = /\r\n|\n|\r/.exec(text);
      if (m === null) break;
      // A trailing "\r" may be the first half of "\r\n": wait for more input.
      if (m[0] === '\r' && m.index === text.length - 1) break;
      const line = text.slice(0, m.index);
      text = text.slice(m.index + m[0].length);
      const result = handleLine(line);
      if (result === null) return;
      if (result !== undefined) yield result;
    }
  }
  text += decoder.decode();
  if (text.length > 0) {
    const result = handleLine(text.replace(/\r$/, ''));
    if (result === null) return;
    if (result !== undefined) yield result;
  }
  const last = dispatch();
  if (last !== undefined && last !== null) yield last;
  // Content but no data field at all: an HTML error page or a non-streamed JSON reply.
  if (!sawData && stray !== '') throw new SSEParseError(stray, undefined, true);
}
