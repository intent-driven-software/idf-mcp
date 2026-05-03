# Changelog

All notable changes to `@intent-driven/mcp-server` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-04

First production release. The package was incubated as `0.1.x` since
2026-04-20; this version stabilises the wire shape, switches the
end-user-facing strings to English, and adds the differentiating
**domain-semantics surface** that motivated the package.

### Added
- **Domain invariants in tool descriptions.** Every MCP tool description
  now carries a `May fail on (domain invariants)` block listing the
  ontology rules the intent may trip on, derived through `alpha × entity`
  match (referential / transition / cardinality / aggregate / expression).
  Requires `@intent-driven/host` ≥ commit
  [6772443](https://github.com/DubovskiyIM/idf/commit/6772443) (PR #254).
- `invariantsToText(invariants)` exported from `descriptions.js`.
- README: example before/after of an agent's view of an intent
  (`submit_response` shows referential + cardinality rules with
  human-readable summaries).

### Changed
- **Tool description language switched to English.** Russian strings
  (`Создаёт`, `Предусловия`, `Необратимое действие`) are replaced with
  `Creates`, `Preconditions`, `Irreversible action (point-of-no-return:
  high). Forward-correction only after this effect is confirmed.` Source
  comments and commit messages stay in Russian per project convention;
  user-facing text — English.
- Package `description` field rewritten in English to align with the
  npm-listed positioning.
- Severity tag in invariant lines is shown only when ≠ `error` (default).
  Previously every line ended with `[error]`; now `error` is implicit.

### Fixed
- Cardinality summary no longer renders `Entity:  per groupBy` (double
  space) when neither `min` nor `max` is set — falls back to
  `row count rule`.

### Notes
- Wire shape is now considered stable for `tools/list` and `tools/call`.
  The structured rejection envelope (`status / error / reason /
  failedCondition / failedCheck / details / issues`) is the contract the
  agent SDK should expect from `1.x`.
- `prompts` and `completion` MCP capabilities remain on roadmap (0.x
  README listed them as such; carried forward unchanged).

## [0.1.0] — 2026-04-20

Initial release. Stdio MCP adapter over `/api/agent/:domain/{schema, world,
exec}`. `tools/list`, `tools/call`, `resources/list`, `resources/read`.
Bootstrap of ontology from local FS. Email/password agent login.
