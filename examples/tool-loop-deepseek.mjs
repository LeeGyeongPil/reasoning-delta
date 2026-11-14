// Tool loop without any network: collect a streamed turn, build the next request's messages
// for different servers, and print the difference. Uses the bundled practice-mock fixtures.
import { readFileSync } from 'node:fs';
import { collect, fromSSE, normalizeReasoning, toAssistantMessage, toServerMessages } from '../dist/index.js';

const text = readFileSync(new URL('../fixtures/tool-call-deepseek.sse', import.meta.url), 'utf8');

// 1) the model answered with reasoning + a tool call
const turn = await collect(normalizeReasoning(fromSSE([text])));

// 2) our history after running the tool
const history = [
  { role: 'user', content: 'Weather in Seoul?' },
  toAssistantMessage(turn),
  { role: 'tool', tool_call_id: turn.toolCalls[0].id, content: '{"temp_c": 18}' },
];

// 3) the same history, written for three different servers
for (const profile of ['deepseek', 'openrouter', 'strict']) {
  console.log(`--- ${profile}`);
  console.log(JSON.stringify(toServerMessages(history, profile)[1], null, 2));
}
