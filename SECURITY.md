# 보안 정책 / Security policy

보안 취약점을 발견하셨다면 **공개 이슈 대신** 이 레포의 **Security → Report a vulnerability**(비공개 취약점 신고)로 알려 주세요. 확인 후 답변드리고, 고친 버전을 릴리스하면서 함께 안내합니다.

If you find a security issue, please **do not open a public issue**. Use **Security → Report a vulnerability** in this repository to report it privately. We will reply after checking and announce the fix with a release.

이 라이브러리는 네트워크 포트를 열지 않습니다. 예제와 테스트용 목 서버만 127.0.0.1에 바인딩합니다. `probe` 실제 모드는 `--api-key-env` 로 고른 환경 변수의 키를 `--base-url` 로 보냅니다(지정하지 않으면 `OPENAI_API_KEY` 가 있을 때 그 값). / The library opens no network ports. Only the mock server used by the examples and tests binds to 127.0.0.1. Real-mode `probe` sends the key from the environment variable chosen with `--api-key-env` to `--base-url` (if not given, the value of `OPENAI_API_KEY` when it is set).
