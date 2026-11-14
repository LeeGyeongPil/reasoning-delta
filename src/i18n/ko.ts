import type { en } from './en.js';

export const ko: Record<keyof typeof en, string> = {
  help: `reasoning-delta - OpenAI 호환 서버의 추론 스트림을 하나의 이벤트 형태로 맞춥니다

사용법:
  reasoning-delta probe --fixture <이름|all|파일> [--compare] [--json] [--raw]
  reasoning-delta probe --base-url <주소> --model <이름> [--api-key-env 이름]
  reasoning-delta --help | --version

옵션:
  --fixture <x>        동봉된 연습용 목 픽스처, "all", 또는 .sse 파일을 재생
  --compare            단순 읽기와 정규화 결과를 비교
  --raw                --fixture 에서 픽스처가 선언한 옵션을 무시
  --base-url <주소>    실제 모드: 서버 기본 주소 (예: http://localhost:11434/v1)
  --model <이름>       실제 모드: 모델 이름
  --api-key-env <이름> 실제 모드: API 키가 든 환경 변수 이름 (설정돼 있으면 기본 OPENAI_API_KEY)
  --prompt <글>        실제 모드: 보낼 질문
  --timeout <초>       실제 모드: 이 시간(초)이 지나면 포기 (기본 60)
  --start-in-reasoning 스트림에 닫는 태그만 있고 여는 태그가 없을 때
  --json               JSON 으로 출력
  --lang <en|ko>       출력 언어 (환경 변수 REASONING_DELTA_LANG, 그다음 LC_ALL/LC_MESSAGES/LANG)

픽스처는 문서화된 형식으로 합성한 연습용 목(mock)이며 실제 서버를 녹화한 것이 아닙니다.
종료 코드: 0 성공, 1 실행 오류, 2 인자 오류.
`,
  mockNote: '연습용 목(mock): 픽스처는 문서화된 형식으로 합성한 것이며 실제 서버 녹화가 아닙니다',
  realNote: '실제 모드: {url} (공유·로컬 장비에서는 느릴 수 있습니다)',
  colFixture: '픽스처',
  labelFixture: '픽스처',
  labelModel: '모델',
  labelDialect: '방언',
  labelReasoning: '추론',
  labelText: '답',
  labelChars: '{n}자',
  labelWarnings: '경고',
  labelNone: '없음',
  labelOptions: '옵션',
  labelRecommended: '추천 프로필',
  labelFirstReasoning: '첫 추론',
  labelFirstText: '첫 답',
  labelFinish: '종료 사유',
  labelMs: '{n} ms',
  naive: '단순 읽기',
  normalized: '정규화',
  issues: '문제 {n}건',
  issueOne: '문제 {n}건',
  issueKinds: '문제',
  'issue.reasoning-in-text': '추론이 답에 섞임',
  'issue.tag-fragment': '답에 태그 조각이 남음',
  'issue.reasoning-missing': '추론이 비어 있음',
  'issue.reasoning-duplicated': '추론이 두 번 나옴',
  'issue.text-differs': '답이 기대한 글과 다름',
  'issue.reasoning-differs': '추론이 기대한 글과 다름',
  'warn.stray-close-tag':
    '여는 태그 없이 닫는 태그가 나왔습니다. 템플릿이 여는 태그를 프롬프트에 넣는다면 startInReasoning (--start-in-reasoning) 을 쓰세요',
  'warn.unclosed-tag': '추론 태그가 열렸지만 닫히지 않았습니다',
  'warn.alias-mismatch': '같은 청크에서 reasoning_content 와 reasoning 의 글이 서로 달랐습니다',
  'recommend.reasoning_content': 'deepseek (또는 --reasoning-format deepseek 를 쓴 llamacpp)',
  'recommend.reasoning': 'vllm, reasoning_details 가 있으면 openrouter',
  'recommend.think_tag': 'think-tag',
  'recommend.legacy_both': 'llamacpp-legacy (추론이 필드와 태그에 모두 나옵니다. 한 벌만 남깁니다)',
  'recommend.none': 'strict (추론이 보이지 않음)',
  'recommend.stray': 'think-tag + startInReasoning (--start-in-reasoning 을 붙여 다시 실행)',
  errBadArgs: '인자가 잘못되었습니다: {detail} 사용법은 "reasoning-delta --help" 를 보세요.',
  errMissingValue: '{flag} 옵션에는 값이 필요합니다.',
  errUnknownOption: '알 수 없는 옵션 {flag}.',
  errUnknownCommand: '알 수 없는 명령 "{cmd}". 명령은 "probe" 하나뿐입니다.',
  errNoSource: '--fixture <이름|all|파일> (연습용 목) 또는 --base-url 과 --model (실제 모드)을 주세요.',
  errBothSources: '--fixture 와 --base-url 은 함께 쓸 수 없습니다.',
  errNeedModel: '--base-url 에는 --model 이 필요합니다.',
  errBadLang: '--lang 은 en 또는 ko 여야 합니다. 받은 값: "{value}".',
  errBadTimeout: '--timeout 은 0보다 큰 초 단위 숫자여야 합니다. 받은 값: "{value}".',
  errUnknownFixture: '"{name}" 픽스처가 없습니다. 사용 가능: {list}. .sse 파일 경로도 쓸 수 있습니다.',
  errFixtureRead: '픽스처 파일 {path} 을(를) 읽지 못했습니다: {detail}',
  errNoKey: '환경 변수 {name} 이(가) 설정되지 않았습니다. export 하거나 --api-key-env 로 다른 이름을 고르세요.',
  errConnect: '{url} 에 연결하지 못했습니다: {detail}. 서버가 켜져 있고 --base-url 이 맞는지 확인하세요.',
  errHttp: '서버가 HTTP {status} 로 답했습니다: {detail}',
  errTimeout: '{seconds}초 안에 답이 끝나지 않았습니다. --timeout 을 늘리세요. 큰 추론 모델은 오래 걸릴 수 있습니다.',
  errStream: '스트림을 읽지 못했습니다: {detail}',
};
