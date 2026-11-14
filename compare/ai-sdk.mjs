// Reproduces the comparison table in the README (not part of `npm test`).
//   npm run compare:ai-sdk
// Replays practice-mock fixtures through the Vercel AI SDK (ai 7.0.173 + @ai-sdk/openai-compatible 3.0.92,
// with and without extractReasoningMiddleware) and through reasoning-delta, and prints:
//   (1) what the reasoning looks like when a server sends it twice (field + tags)
//   (2) which field each side writes into the next request when an assistant message has reasoning
// The AI SDK reads both `reasoning_content` and `reasoning`; this script only shows the two gaps above.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { generateText, streamText, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { fromSSE, normalizeReasoning, toServerMessages } from '../dist/index.js';

const fixtureDir = new URL('../fixtures/', import.meta.url);
let lastRequestBody;

const server = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    lastRequestBody = body;
    const name = req.url.split('/')[1];
    if (name === 'echo') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model: 'm',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(readFileSync(new URL(name + '.sse', fixtureDir)));
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = (name) => `http://127.0.0.1:${server.address().port}/${name}/v1`;

async function viaAiSdk(fixture, withMiddleware) {
  let model = createOpenAICompatible({ name: 'm', baseURL: base(fixture), apiKey: 'x' }).chatModel('m');
  if (withMiddleware) {
    model = wrapLanguageModel({ model, middleware: extractReasoningMiddleware({ tagName: 'think' }) });
  }
  let reasoning = '';
  let text = '';
  for await (const p of streamText({ model, prompt: 'q' }).fullStream) {
    if (p.type === 'reasoning-delta') reasoning += p.text;
    if (p.type === 'text-delta') text += p.text;
  }
  return { reasoning, text };
}

async function viaReasoningDelta(fixture) {
  const res = await fetch(base(fixture) + '/chat/completions', { method: 'POST', body: '{}' });
  let reasoning = '';
  let text = '';
  for await (const ev of normalizeReasoning(fromSSE(res.body))) {
    if (ev.type === 'reasoning') reasoning += ev.text;
    if (ev.type === 'text') text += ev.text;
  }
  return { reasoning, text };
}

try {
  console.log('(1) Reasoning sent twice (llama.cpp deepseek-legacy shape, practice-mock fixture "legacy-both")');
  console.log('  AI SDK              ', JSON.stringify(await viaAiSdk('legacy-both', false)));
  console.log('  AI SDK + middleware ', JSON.stringify(await viaAiSdk('legacy-both', true)));
  console.log('  reasoning-delta     ', JSON.stringify(await viaReasoningDelta('legacy-both')));

  console.log('\n(2) Field written into the next request for an assistant message with reasoning');
  const model = createOpenAICompatible({ name: 'm', baseURL: base('echo') + '', apiKey: 'x' }).chatModel('m');
  await generateText({
    model,
    messages: [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: [{ type: 'reasoning', text: 'Need the weather.' }, { type: 'text', text: 'Checking.' }] },
      { role: 'user', content: 'go on' },
    ],
  });
  const sent = JSON.parse(lastRequestBody).messages.find((m) => m.role === 'assistant');
  console.log('  AI SDK request      ', JSON.stringify(sent));
  const history = [{ role: 'assistant', content: 'Checking.', reasoning_content: 'Need the weather.' }];
  for (const profile of ['deepseek', 'openrouter', 'strict']) {
    const out = toServerMessages(history, profile, { hasTools: true })[0];
    console.log(`  reasoning-delta ${profile.padEnd(10)}`, JSON.stringify(out));
  }
} finally {
  server.closeAllConnections();
  server.close();
}
