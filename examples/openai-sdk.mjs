// openai SDK stream -> one event shape.
//   node examples/openai-sdk.mjs                      (local practice mock, no key)
//   node examples/openai-sdk.mjs think-tag-split      (pick another bundled fixture)
//   node examples/openai-sdk.mjs --base-url http://localhost:11434/v1 --model qwen3
import OpenAI from 'openai';
import { normalizeReasoning } from '../dist/index.js';
import { printEvent, startMock } from './mock-server.mjs';

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const realUrl = flag('--base-url');
const fixture = args.find((a) => !a.startsWith('--') && a !== realUrl && a !== flag('--model')) ?? 'think-tag-split';

const mock = realUrl ? undefined : await startMock(fixture, 3);
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'not-needed',
  baseURL: realUrl ?? mock.baseUrl,
  maxRetries: 0,
});

try {
  if (mock) console.log(`(practice mock: fixture "${fixture}", sent 3 bytes at a time)\n`);
  const stream = await client.chat.completions.create({
    model: flag('--model') ?? 'mock-model',
    messages: [{ role: 'user', content: 'What is 2 + 2?' }],
    stream: true,
  });
  // The stream of raw chunks becomes reasoning / text / done events.
  for await (const ev of normalizeReasoning(stream)) printEvent(ev);
} finally {
  await mock?.close();
}
