// Plain fetch + fromSSE, no SDK. Uses the local practice mock (Korean fixture: multi-byte
// characters are cut in the middle by the 3-byte writes and still come out whole).
import { fromSSE, normalizeReasoning } from '../dist/index.js';
import { printEvent, startMock } from './mock-server.mjs';

const mock = await startMock('korean-reasoning', 3);
try {
  const res = await fetch(`${mock.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'mock-model', stream: true, messages: [{ role: 'user', content: '2 + 2?' }] }),
  });
  for await (const ev of normalizeReasoning(fromSSE(res.body))) printEvent(ev);
} finally {
  await mock.close();
}
