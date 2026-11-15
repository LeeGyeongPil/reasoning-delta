import { describe, expect, it } from 'vitest';
import { SSEParseError, fromSSE } from '../src/index.js';

async function all(body: Parameters<typeof fromSSE>[0]) {
  const out: unknown[] = [];
  for await (const c of fromSSE(body)) out.push(c);
  return out;
}

describe('fromSSE', () => {
  it('rejects bodies that contain no SSE data events', async () => {
    await expect(all('<html>502 Bad Gateway</html>')).rejects.toBeInstanceOf(SSEParseError);
    await expect(all('{"object":"chat.completion","choices":[]}')).rejects.toBeInstanceOf(SSEParseError);
    await expect(all('<html>502 Bad Gateway</html>')).rejects.toThrow(/502 Bad Gateway/);
  });

  it('keeps empty, comment-only and [DONE]-only bodies as empty streams', async () => {
    expect(await all('')).toEqual([]);
    expect(await all(': keep-alive\n\n  \n')).toEqual([]);
    expect(await all('data: [DONE]\n\n')).toEqual([]);
  });

  it('handles CRLF, comments, multi-line data and [DONE]', async () => {
    const text =
      ': comment\r\n\r\ndata: {"a":\r\ndata: 1}\r\n\r\nevent: x\r\ndata: {"b":2}\r\n\r\ndata: [DONE]\r\n\r\ndata: {"c":3}\r\n\r\n';
    expect(await all(text)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('handles a CRLF split between two chunks', async () => {
    expect(await all(['data: {"a":1}\r', '\n\r', '\ndata: {"b":2}\n\n'])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('accepts a ReadableStream', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"a":1}\n\n'));
        c.close();
      },
    });
    expect(await all(body)).toEqual([{ a: 1 }]);
  });

  it('dispatches a final event that has no blank line after it', async () => {
    expect(await all('data: {"a":1}')).toEqual([{ a: 1 }]);
  });

  it('keeps multi-byte characters whole when bytes are cut', async () => {
    const bytes = new TextEncoder().encode('data: {"t":"정답"}\n\n');
    const parts = Array.from(bytes, (b) => Uint8Array.of(b));
    expect(await all(parts)).toEqual([{ t: '정답' }]);
  });

  it('throws SSEParseError with the offending data and a fix hint', async () => {
    await expect(all('data: <html>oops</html>\n\n')).rejects.toBeInstanceOf(SSEParseError);
    try {
      await all('data: not json\n\n');
    } catch (err) {
      expect((err as SSEParseError).line).toBe('not json');
      expect((err as Error).message).toContain('stream: true');
    }
  });
});
