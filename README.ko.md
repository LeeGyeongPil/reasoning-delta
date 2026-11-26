# reasoning-delta

[English](README.md) | **한국어**

OpenAI 호환 서버 뒤의 추론 모델은 "생각"을 서버마다 다른 곳에 담아 보냅니다: `delta.reasoning_content`, `delta.reasoning`, `content` 안의 `<think>` 태그, 또는 이 중 둘을 동시에. `reasoning-delta` 는 Chat Completions 스트림에서 어느 쪽이든 읽어 내고, 태그가 두 청크 사이에서 잘려 와도 새지 않게 처리해서 하나의 이벤트 형태(`reasoning`, `text`, `tool_call_delta`, `reasoning_details`, `done`)로 돌려줍니다. 다음 요청에 보낼 대화 기록도 서버별 추론 규칙에 맞게 고쳐 줍니다. TypeScript, 런타임 의존성 0개, Node 22 이상.

![번들 픽스처 10개에 대한 단순 읽기와 정규화 읽기 비교](docs/images/compare.ko.png)

*번들 연습용 픽스처 10개. "단순 읽기"는 `delta.reasoning_content` 만 보고 청크마다 `<think>` 정규식을 적용하는 읽기이고, "정규화"가 `reasoning-delta` 입니다. 픽스처는 합성 데이터입니다([픽스처는 합성입니다](#픽스처는-합성입니다) 참고).*

## 설치

```bash
npm install reasoning-delta
```

Node 22 이상이 필요합니다(`brew install node`, `apt install nodejs`, 또는 [nodejs.org](https://nodejs.org)). 런타임 의존성은 없습니다. ESM 기본이고, `require(esm)` 을 지원하는 Node 에서는 `require()` 로도 불러옵니다.

패키지가 npm 에 게시되기 전에는 `npm install reasoning-delta` 가 404 로 실패합니다. 그럴 때는 아래 소스 설치를 쓰세요.

현재 소스를 써 보려면:

```bash
git clone https://github.com/LeeGyeongPil/reasoning-delta.git
cd reasoning-delta
npm install
npm run build
```

## 빠르게 시작하기

서버도 키도 필요 없습니다:

```js
import { normalizeReasoning } from 'reasoning-delta';

// A <think> tag cut in half between two chunks, as a real network would do.
const chunk = (content) => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] });
async function* stream() {
  for (const piece of ['<thi', 'nk>Let me add 2 and 2.</th', 'ink>\n\nThe answer is 4.']) yield chunk(piece);
}

for await (const ev of normalizeReasoning(stream())) console.log(ev);
```

```text
{ type: 'reasoning', text: 'Let me add 2 and 2.', source: 'tag' }
{ type: 'text', text: 'The answer is 4.' }
{
  type: 'done',
  dialect: 'think_tag',
  finishReason: null,
  warnings: []
}
```

태그 조각이 답에 새지 않았고 추론이 따로 나뉘었습니다. 코드를 쓰지 않고 명령줄로도 해 볼 수 있습니다(번들 픽스처를 재생하므로 키가 필요 없습니다):

```bash
npx reasoning-delta probe --fixture all --compare
```

## 핵심 개념

```mermaid
flowchart LR
  A["서버 스트림<br/>(openai SDK, fetch)"] --> B["fromSSE<br/>바이트를 청크로"]
  B --> C["normalizeReasoning<br/>방언 감지, 태그 분리"]
  C --> D["이벤트:<br/>reasoning / text /<br/>tool_call_delta / done"]
  D --> E["collect<br/>assistant 한 턴"]
  E --> F["toServerMessages<br/>다음 요청용 기록"]
```

1. **방언(dialect).** 서버가 추론 텍스트를 싣는 곳. `reasoning-delta` 는 `reasoning_content`(필드), `reasoning`(필드), `think_tag`(`content` 안 태그), `legacy_both`(필드와 태그에 같은 글), `none` 을 구분합니다. 감지된 값은 `done` 이벤트에 들어 있습니다.
2. **청크 경계에 안전한 태그 분리기.** 청크 끝이 태그의 앞부분일 수 있으면(`<`, `<th`, `</thi`) 그 부분만 쥐고 있다가 다음 청크가 와야 판단합니다. 스트림이 끝났을 때 쥐고 있던 조각은 태그가 열려 있었다면 추론으로, 아니면 본문으로 내보냅니다. 시드 고정 퍼즈 테스트가 픽스처 3개를 청크 수준과 SSE 바이트 수준(한글 같은 멀티바이트 글자 한가운데 포함)에서 각각 2000번 무작위로 잘라 실패 0건을 확인합니다.
   예: 스트림이 `<thi` + `nk>Let me…` 로 나뉘어 옵니다.

   | 청크 | 쥐고 있는 것 | 내보내는 것 |
   |---|---|---|
   | `<thi` | `<thi`(태그의 앞부분일 수 있음) | 아직 없음 |
   | `nk>Let me…` | 없음(`<think>` 가 완성돼 추론 시작) | `reasoning: "Let me…"` |
3. **중복 방지.** 어떤 서버는 같은 추론을 필드와 `<think>` 태그 양쪽에 보냅니다. 필드 추론이 한 번이라도 보이면 `content` 안 태그 구간은 버려서 추론을 한 번만 내보냅니다. 한계: 첫 필드 청크보다 먼저 태그 추론이 이미 나갔다면 되돌릴 수 없습니다.
4. **되돌려 보내기 프로필.** 다음 요청에서 추론을 어느 필드에, 언제 넣을지에 대한 이름 붙은 규칙 묶음. 규칙은 서버마다 다릅니다.

![닫는 태그만 있는 스트림을 옵션 없이 읽은 결과](docs/images/probe-raw.ko.png)

*`--raw` 는 픽스처가 선언한 옵션을 무시합니다. 이 스트림에는 `</think>` 만 있고 여는 태그가 없어서 경고와 함께 `startInReasoning` 을 권합니다.*

## API

아래는 모두 `reasoning-delta` 에서 내보냅니다.

| 이름 | 하는 일 | 주요 인자 | 반환 |
|---|---|---|---|
| `normalizeReasoning(source, options?)` | 청크를 이벤트로 바꿉니다. openai SDK `Stream`, 청크 객체의 비동기 iterable, `fromSSE(...)` 를 받습니다. | `source`, `NormalizeOptions` | `AsyncGenerator<ReasoningEvent>` |
| `fromSSE(body)` | Server-Sent Events 본문을 파싱합니다(`\n`·`\r\n`·`\r`, 주석 줄, 여러 줄 `data:`, `[DONE]`, 바이트 청크에 걸친 UTF-8 처리). JSON 이 틀리거나 SSE 이벤트가 없는 본문(예: HTML 오류 페이지)이면 `SSEParseError`. | `ReadableStream`, 비동기 iterable, iterable, 문자열 | `AsyncGenerator<ChunkLike>` |
| `collect(events)` | 이벤트를 모아 한 턴으로 만듭니다. | 이벤트 스트림 | `Promise<AssistantTurn>` (`content`, `reasoning`, `reasoningDetails`, `toolCalls`, `finishReason`, `dialect`, `warnings`, `usage`) |
| `toAssistantMessage(turn)` | 수집한 턴으로 기록용 메시지를 만듭니다. | `AssistantTurn` | `MessageLike` |
| `normalizeMessage(message, options?)` | 완성된(스트리밍 아닌) 메시지에 같은 분리를 적용합니다. | 메시지, `NormalizeOptions` | `{ content, reasoning, dialect }` |
| `toServerMessages(history, profile, opts?)` | 서버에 맞게 쓴 새 기록을 돌려줍니다. 입력은 바꾸지 않습니다. `opts.hasTools` 기본값은 기록에 tool 호출이나 tool 메시지가 있으면 true. | 기록, 프로필 이름 또는 객체 | `MessageLike[]` |
| `profiles` | 내장 프로필: `deepseek`, `vllm`, `llamacpp`, `llamacpp-legacy`, `openrouter`, `ollama`, `think-tag`, `strict`. | | `Record<ProfileName, ServerProfile>` |
| `defineProfile(profile)` | 직접 만든 프로필용 타입 도우미. | `ServerProfile` | 같은 객체 |
| `TagSplitter`, `DEFAULT_TAGS` | 태그 분리기 자체와 기본 태그 이름(`think`, `reasoning`, `thought`). | `TagSplitterOptions` | |
| `SSEParseError`, `UnknownProfileError`, `StreamError` | 오류: SSE JSON 오류, 모르는 프로필 이름, 스트림 안의 `error` 객체. | | |

타입: `ReasoningEvent`, `AssistantTurn`, `ChunkLike`, `DeltaLike`, `MessageLike`, `NormalizeOptions`, `ServerProfile`, `SendBackRule`, `Dialect`, `Warning`, `TagMode`, `ProfileName`, `ToolCallTurn`, `Segment`, `SegmentKind`, `TagSplitterOptions`.

이벤트:

| 이벤트 | 필드 |
|---|---|
| `reasoning` | `text`, `source`(`'field'` 또는 `'tag'`) |
| `text` | `text` |
| `tool_call_delta` | `index`, `id?`, `name?`, `arguments?` |
| `reasoning_details` | `details`(서버가 보낸 배열 그대로) |
| `done` | `dialect`, `finishReason`, `warnings`, `usage?` |

`NormalizeOptions`:

| 옵션 | 기본값 | 뜻 |
|---|---|---|
| `profile` | `'auto'` | 읽기 힌트를 적용할 프로필 이름 또는 객체. `'auto'` 는 감지에만 맡깁니다. |
| `tags` | `['think', 'reasoning', 'thought']` | `content` 안에서 추론을 감싸는 태그 이름. |
| `tagMode` | `'leading'` | `'leading'`: 첫 번째 보이는 답 글자 앞에서만 태그로 인정하므로 답 중간의 글자 그대로의 `<think>` 는 본문으로 남습니다. `'anywhere'`: 어디서든 인정. `'off'`: 태그를 그냥 글자로 취급. |
| `startInReasoning` | `false` | 여는 태그가 없는 경우(일부 채팅 템플릿이 프롬프트에 넣음). 스트림이 추론 안에서 시작합니다. |
| `choiceIndex` | `0` | 따라갈 choice 번호. |

`startInReasoning` 는 `reasoning_content` / `reasoning` 필드로 추론을 보내는 서버와 함께 써도 안전합니다(필드 추론이 첫 content 보다 먼저 또는 함께 올 때). 답은 그대로 `text` 로 나옵니다.

`done.warnings` 의 경고: `stray-close-tag`(여는 태그 없이 닫는 태그, 글자로 남김), `unclosed-tag`(태그가 열린 채 스트림 종료, 쥐고 있던 글을 추론으로 내보냄), `alias-mismatch`(한 청크에서 `reasoning_content` 와 `reasoning` 이 다름, `reasoning_content` 채택).

## 사용 예

세 파일 모두 [`examples/`](examples) 에 있고, 번들 픽스처를 한 번에 3바이트씩 보내는 로컬 연습용 목 서버를 상대로 실행됩니다.

### openai SDK 와 함께

```js
import OpenAI from 'openai';
import { normalizeReasoning } from 'reasoning-delta';

const client = new OpenAI({ apiKey: 'not-needed', baseURL: 'http://localhost:11434/v1' });
const stream = await client.chat.completions.create({
  model: 'qwen3',
  messages: [{ role: 'user', content: 'What is 2 + 2?' }],
  stream: true,
});
for await (const ev of normalizeReasoning(stream)) {
  if (ev.type === 'reasoning') process.stdout.write(`\x1b[2m${ev.text}\x1b[0m`); // 흐리게
  else if (ev.type === 'text') process.stdout.write(ev.text);
}
```

(주소와 모델은 본인 서버용 예시입니다. 실행 가능한 파일은 목 서버를 씁니다.) 파일을 실제로 실행한 결과:

```bash
node examples/openai-sdk.mjs think-tag-split
```

```text
(practice mock: fixture "think-tag-split", sent 3 bytes at a time)

Let me add 2 and 2.The answer is 4.
[done: dialect=think_tag finish=stop warnings=none]
```

추론 부분은 실제 터미널에서 흐리게 나옵니다. 위 복사본에는 색 코드가 없습니다.

### 순수 `fetch` 와 함께

```js
import { fromSSE, normalizeReasoning } from 'reasoning-delta';

const res = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model, stream: true, messages }),
});
for await (const ev of normalizeReasoning(fromSSE(res.body))) console.log(ev);
```

`node examples/fetch.mjs` 는 한국어 픽스처로 같은 일을 합니다. 3바이트씩 쓰면 한글 글자가 중간에서 잘리지만 온전히 나옵니다:

```text
2 더하기 2를 계산해 보자.정답은 4입니다.
[done: dialect=think_tag finish=stop warnings=none]
```

### 추론을 되돌려 보내는 도구 호출 루프

`collect()` 가 스트리밍 한 턴을 모으고, `toAssistantMessage()` 가 기록용 메시지를 만들고, `toServerMessages()` 가 서버에 맞게 씁니다.

```js
const turn = await collect(normalizeReasoning(fromSSE([text])));
const history = [
  { role: 'user', content: 'Weather in Seoul?' },
  toAssistantMessage(turn),
  { role: 'tool', tool_call_id: turn.toolCalls[0].id, content: '{"temp_c": 18}' },
];
for (const profile of ['deepseek', 'openrouter', 'strict']) {
  console.log(JSON.stringify(toServerMessages(history, profile)[1], null, 2));
}
```

![같은 assistant 메시지를 deepseek, openrouter, strict 용으로 쓴 결과](docs/images/send-back.png)

*`node examples/tool-loop-deepseek.mjs`: DeepSeek 는 `reasoning_content`, OpenRouter 는 `reasoning`, strict 서버는 추론 필드 없음.*

### 엔드포인트 진단

```bash
npx reasoning-delta probe --base-url http://localhost:11434/v1 --model qwen3
npx reasoning-delta probe --base-url https://api.deepseek.com --model <model> --api-key-env DEEPSEEK_API_KEY
```

실제 모드는 짧은 요청을 한 번 보내 방언, 첫 추론·첫 답 지연, 글자 수, 추천 프로필을 알려 줍니다. 키는 *이름*을 넘긴 환경 변수에서 읽습니다(설정돼 있으면 기본 `OPENAI_API_KEY`). 키 자체를 명령줄에 넣지 마세요. 옵션: `--prompt`, `--timeout <초>`(기본 60), `--json`, `--start-in-reasoning`. 연습용 목 모드(네트워크 없음)는 `--fixture <이름|all|경로.sse>`, `--compare`(단순 읽기와 정규화 결과를 나란히 표시), `--raw`(픽스처가 선언한 옵션 무시)를 씁니다. 자세한 것은 `reasoning-delta --help` 를 보세요. 종료 코드는 성공 0, 실행 오류 1, 인자 오류 2. 실제 모드는 로컬 목 서버로만 시험했습니다([검증 범위](#검증-범위) 참고). 공유·원격 서버에서는 느릴 수 있습니다.

## 되돌려 보내기

`toServerMessages(history, profile)` 는 assistant 메시지마다 추론을 읽고, `content` 와 세 추론 필드에서 지운 뒤, 프로필이 정한 방식으로 다시 씁니다. `content` 맨 앞의 `<think>…</think>` 블록은 모든 프로필에서 지워지고, 추론 필드가 없으면 그 블록의 글이 추론으로 쓰입니다.

| 프로필 | 쓰는 것 | 규칙 출처 (2026-11-14 확인) | 문서로 확인됨? |
|---|---|---|---|
| `deepseek` | 기록에 tool 호출이 있을 때만 모든 assistant 메시지에 `reasoning_content` | [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode) | 예 |
| `openrouter` | `reasoning_details` 를 수정 없이 순서대로, 그리고 `reasoning` | [OpenRouter reasoning tokens](https://openrouter.ai/docs/use-cases/reasoning-tokens) | 예 |
| `vllm` | 없음(추론 제거) | [vLLM reasoning outputs](https://docs.vllm.ai/en/latest/features/reasoning_outputs.html) | **미확인**: 문서가 추론을 되돌려 보내는 방법을 설명하지 않음 |
| `llamacpp`, `llamacpp-legacy` | 없음(추론 제거) | [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) | **미확인** |
| `ollama` | 없음(추론 제거) | [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility) | **미확인**: 문서가 델타 필드 이름을 밝히지 않아 감지에 맡김 |
| `think-tag` | 없음(추론 제거) | [vLLM reasoning outputs](https://docs.vllm.ai/en/latest/features/reasoning_outputs.html) | **미확인** |
| `strict` | 없음 | 없음 | 서버 규칙이 아님: 모르는 메시지 필드를 거부하는 서버를 위한 보수적 선택 |

미확인 프로필의 기본값은 안전한 쪽(제거)입니다. 본인 서버가 다른 것을 원한다고 확인했다면 직접 프로필을 넘기세요:

```js
import { defineProfile, toServerMessages } from 'reasoning-delta';

const mine = defineProfile({
  name: 'my-server',
  read: {},
  sendBack: { field: 'reasoning_content', when: 'always', details: false },
  verified: true,
  sources: ['https://example.com/your-docs'],
  checked: '2026-11-14',
});
const messages = toServerMessages(history, mine);
```

내장 프로필마다 `profiles.<이름>.sources` 와 `.checked` 에 출처 URL 과 확인 날짜가 있습니다. 그 날짜에 해당 페이지가 말한 내용이며 페이지는 바뀔 수 있으니, 규칙에 기대기 전에 다시 확인하세요.

## 언제 쓰나

- 잘 맞는 경우: openai SDK 나 `fetch` 로 OpenAI 호환 서버 여러 곳을 부르면서 추론 읽기 경로와 되돌려 보내기 규칙을 한곳에 두고 싶을 때. 새 엔드포인트가 추론을 어디에 싣는지 확인할 때도 좋습니다.
- 다른 도구가 나을 수 있는 경우: Vercel AI SDK 위에서 만든다면 먼저 그쪽의 추론 지원을 보세요([AI SDK 문서](https://ai-sdk.dev/docs), `extractReasoningMiddleware`). 끝난 문자열에서 태그만 떼면 된다면 작은 태그 파서로 충분합니다. 서버가 스스로 추론을 분리해 준다면(예: 서버 쪽 추론 파서 옵션) 클라이언트의 태그 처리가 필요 없을 수도 있습니다.

한 가지 경우에 대한 재현 스크립트가 들어 있습니다: `npm run compare:ai-sdk` 는 합성한 "추론이 두 번 오는" 픽스처를 `ai` 7.0.173 + `@ai-sdk/openai-compatible` 3.0.92(`extractReasoningMiddleware` 유무 두 가지)와 `reasoning-delta` 에 각각 재생합니다. 그 실행(2026-11-14)에서 AI SDK 는 필드를 읽고 태그는 답에 남겼고, 미들웨어를 더하면 추론이 중복·뒤섞여 나왔으며(`Let me Let me add 2 and 2.add 2 and 2.`), `reasoning-delta` 는 추론을 한 번만 냈습니다. 같은 스크립트는 양쪽이 다음 요청에 어느 필드를 쓰는지도 출력합니다. AI SDK 는 `reasoning_content` 와 `reasoning` 둘 다 읽습니다. 이것은 스크립트에 든 경우만 다루며 일반적인 비교가 아닙니다.

## 검증 범위

### 픽스처는 합성입니다

[`fixtures/`](fixtures) 의 픽스처 10개는 **문서화된 형식으로 합성한 것이며 실제 서버를 녹화한 것이 아닙니다.** 각 파일 첫 줄에 그렇게 적혀 있고 어느 서버를 흉내 냈는지도 적혀 있습니다. CLI 의 목 모드도 같은 안내를 출력합니다. "연습용 목(mock) 모드"는 네트워크·키 없이 항상 같은 출력이 나오는 모드이고, 실제 모드는 실제 서버를 부르므로 그 서버의 속도와 모델에 좌우됩니다.

- 자동 테스트 96개가 다루는 것: 모든 픽스처, 무작위 청크 분할, 로컬 `127.0.0.1` 목 서버에서 스트리밍하는 실제 openai SDK 클라이언트, 두 언어의 CLI, 패킹한 tarball(ESM import, CJS `require`, `npx reasoning-delta --version`).
- **아직 실제 서버로 확인하지 않은 것:** llama.cpp, vLLM, Ollama, DeepSeek, OpenRouter 엔드포인트는 호출하지 않았습니다. 실제 모드 `probe` 는 로컬 목 서버로만 시험했습니다. 위 표에서 미확인으로 표시한 되돌려 보내기 규칙은 서버 문서로 확인되지 않았습니다.

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 답이 `</think>` 앞까지의 글로 시작하고 추론이 비어 있음, 경고 `stray-close-tag` | 채팅 템플릿이 프롬프트에 `<think>` 를 넣어서 스트림에는 닫는 태그만 있음 | `normalizeReasoning(stream, { startInReasoning: true })` 또는 `probe --start-in-reasoning` |
| 글자 그대로의 `<think>` 가 답에 남음 | 기본 `tagMode: 'leading'` 은 첫 답 글자 앞에서만 태그를 추론으로 봄 | 모델이 정말 나중에 추론을 내보낸다면 `tagMode: 'anywhere'` |
| `done.dialect` 가 `none` | 서버가 추론을 보내지 않았거나 그 요청에서 추론이 꺼져 있음 | 해당 서버의 추론·thinking 요청 파라미터 확인 |
| `SSEParseError` | 본문이 `stream: true` Chat Completions 스트림이 아님(예: 오류 페이지, SSE 이벤트가 없는 본문) | 파싱 전에 상태 코드와 요청 본문 확인 |
| `StreamError` | 서버가 스트림 안에 `error` 객체를 보냄 | `error.detail` 확인 |
| `UnknownProfileError` | 프로필 이름 오타 | `profiles` 의 이름을 쓰거나 `defineProfile()` 사용 |

## 언어

CLI 는 영어와 한국어로 출력합니다. `--lang en|ko` 로 고르고, 없으면 `REASONING_DELTA_LANG`, 그다음 `LC_ALL`, `LC_MESSAGES`, `LANG`(`ko` 로 시작하면 한국어), 모두 없으면 영어입니다.

```bash
npx reasoning-delta probe --fixture reasoning --lang ko
REASONING_DELTA_LANG=ko npx reasoning-delta probe --fixture all --compare
```

## 버전

[유의적 버전(SemVer)](https://semver.org/lang/ko/)을 따릅니다. 0.x 동안은 마이너 버전에서 API 가 바뀔 수 있고, 바뀌면 [CHANGELOG.md](CHANGELOG.md) 에 적습니다. 현재 버전: 0.1.2.

## 개발

```bash
npm install
npm test        # 빌드 후 테스트 파일 11개 / 테스트 96개 실행
npm run build   # tsc
npm run compare:ai-sdk
```

퍼즈 테스트만: `npm test -- fuzz`.

![퍼즈 테스트 출력: 픽스처마다 무작위 분할 2000번, 실패 0건](docs/images/fuzz.png)

*청크 경계 퍼즈 테스트: 청크 수준과 SSE 바이트 수준의 시드 고정 무작위 분할.*

## 라이선스

MIT.
