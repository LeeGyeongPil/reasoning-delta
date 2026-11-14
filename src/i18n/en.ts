export const en = {
  help: `reasoning-delta - normalize reasoning streams from OpenAI-compatible servers

Usage:
  reasoning-delta probe --fixture <name|all|file> [--compare] [--json] [--raw]
  reasoning-delta probe --base-url <url> --model <name> [--api-key-env NAME]
  reasoning-delta --help | --version

Options:
  --fixture <x>        Replay a bundled practice-mock fixture, "all", or a .sse file
  --compare            Compare a naive reading with the normalized one
  --raw                With --fixture: ignore the options the fixture declares
  --base-url <url>     Real mode: server base URL, e.g. http://localhost:11434/v1
  --model <name>       Real mode: model name
  --api-key-env <NAME> Real mode: env var holding the API key (default OPENAI_API_KEY if set)
  --prompt <text>      Real mode: prompt to send
  --timeout <seconds>  Real mode: give up after this many seconds (default 60)
  --start-in-reasoning The stream has a closing tag but no opening tag
  --json               Print JSON
  --lang <en|ko>       Output language (env REASONING_DELTA_LANG, then LC_ALL/LC_MESSAGES/LANG)

The fixtures are a practice mock synthesized from documented formats, not recordings of real servers.
Exit codes: 0 ok, 1 run error, 2 bad arguments.
`,
  mockNote: 'practice mock: fixtures are synthesized from documented formats, not recordings of real servers',
  realNote: 'real mode: {url} (can be slow on shared or local hardware)',
  colFixture: 'fixture',
  labelFixture: 'fixture',
  labelModel: 'model',
  labelDialect: 'dialect',
  labelReasoning: 'reasoning',
  labelText: 'text',
  labelChars: '{n} chars',
  labelWarnings: 'warnings',
  labelNone: 'none',
  labelOptions: 'options',
  labelRecommended: 'recommended profile',
  labelFirstReasoning: 'first reasoning',
  labelFirstText: 'first answer',
  labelFinish: 'finish reason',
  labelMs: '{n} ms',
  naive: 'naive',
  normalized: 'normalized',
  issues: '{n} issues',
  issueOne: '{n} issue',
  issueKinds: 'issues',
  'issue.reasoning-in-text': 'reasoning ended up in the answer',
  'issue.tag-fragment': 'tag fragment in the answer',
  'issue.reasoning-missing': 'reasoning is missing',
  'issue.reasoning-duplicated': 'reasoning appears twice',
  'issue.text-differs': 'answer differs from the expected text',
  'issue.reasoning-differs': 'reasoning differs from the expected text',
  'warn.stray-close-tag':
    'closing tag without an opening tag; if the template adds the opening tag to the prompt, use startInReasoning (--start-in-reasoning)',
  'warn.unclosed-tag': 'a reasoning tag was opened but never closed',
  'warn.alias-mismatch': 'reasoning_content and reasoning carried different text in the same chunk',
  'recommend.reasoning_content': 'deepseek (or llamacpp with --reasoning-format deepseek)',
  'recommend.reasoning': 'vllm, or openrouter if reasoning_details are present',
  'recommend.think_tag': 'think-tag',
  'recommend.legacy_both': 'llamacpp-legacy (reasoning appears in the field and in tags; one copy is kept)',
  'recommend.none': 'strict (no reasoning seen)',
  'recommend.stray': 'think-tag with startInReasoning (run again with --start-in-reasoning)',
  errBadArgs: 'Bad arguments: {detail} Run "reasoning-delta --help" for usage.',
  errMissingValue: 'Option {flag} needs a value.',
  errUnknownOption: 'Unknown option {flag}.',
  errUnknownCommand: 'Unknown command "{cmd}". The only command is "probe".',
  errNoSource: 'Give --fixture <name|all|file> (practice mock) or --base-url and --model (real mode).',
  errBothSources: 'Use either --fixture or --base-url, not both.',
  errNeedModel: '--base-url needs --model.',
  errBadLang: '--lang must be en or ko, got "{value}".',
  errBadTimeout: '--timeout must be a positive number of seconds, got "{value}".',
  errUnknownFixture: 'Unknown fixture "{name}". Available: {list}. A path to a .sse file also works.',
  errFixtureRead: 'Could not read fixture file {path}: {detail}',
  errNoKey: 'Environment variable {name} is not set. Export it, or pick another one with --api-key-env.',
  errConnect: 'Could not reach {url}: {detail}. Is the server running and is --base-url correct?',
  errHttp: 'The server answered HTTP {status}: {detail}',
  errTimeout: 'No complete answer within {seconds} s. Raise --timeout; large reasoning models can take a long time.',
  errStream: 'The stream could not be read: {detail}',
} as const;
