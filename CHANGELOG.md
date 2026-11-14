# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-14

### Added
- `normalizeReasoning()` turns OpenAI-compatible chat streams into `reasoning`, `text`,
  `tool_call_delta`, `reasoning_details` and `done` events, for `reasoning_content`, `reasoning`,
  `<think>` tags in `content`, and servers that send both.
- `TagSplitter`: tag parsing that is safe at any chunk boundary, with `tagMode`
  (`leading`, `anywhere`, `off`) and `startInReasoning`.
- `fromSSE()` for `fetch` bodies, including UTF-8 characters cut across byte chunks.
- `collect()`, `toAssistantMessage()` and `normalizeMessage()`.
- Eight server profiles and `toServerMessages()` to send history back per server;
  `defineProfile()` for custom rules.
- `reasoning-delta probe` CLI (practice mock and real endpoint modes, `--compare`, `--json`),
  English and Korean output (`--lang`, `REASONING_DELTA_LANG`).
- Ten practice-mock fixtures synthesized from documented formats (not recordings of real servers).
