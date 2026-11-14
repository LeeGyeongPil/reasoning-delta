import OpenAI from 'openai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fromSSE } from '../src/index.js';
import type { ChunkLike } from '../src/index.js';
import { expected, run } from './helpers/fixtures.js';
import { startMockServer } from './helpers/mock-server.js';
import type { MockServer } from './helpers/mock-server.js';

let server: MockServer;

beforeAll(async () => {
  server = await startMockServer(3); // 3 bytes per write: tags and UTF-8 characters get cut
});

afterAll(async () => {
  await server.close();
});

describe('real openai client against a local mock server (AC-6)', () => {
  for (const name of Object.keys(expected)) {
    it(name + ': openai SDK stream equals fetch + fromSSE and the documented outcome', async () => {
      const options = expected[name]!.options;
      const baseURL = server.baseUrl(name);

      const client = new OpenAI({ apiKey: 'not-needed', baseURL, maxRetries: 0 });
      const stream = await client.chat.completions.create({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'What is 2 + 2?' }],
        stream: true,
      });
      const viaSdk = await run(stream as unknown as AsyncIterable<ChunkLike>, options);

      const res = await fetch(baseURL + '/chat/completions', { method: 'POST', body: '{}' });
      expect(res.ok).toBe(true);
      const viaFetch = await run(fromSSE(res.body!), options);

      expect(viaSdk.events).toEqual(viaFetch.events);
      expect(viaSdk.reasoning).toBe(expected[name]!.reasoning);
      expect(viaSdk.text).toBe(expected[name]!.text);
      expect(viaSdk.done.type === 'done' && viaSdk.done.dialect).toBe(expected[name]!.dialect);
    });
  }
});
