# Changelog

All notable changes to `@intent-driven/mcp-server` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] — 2026-05-06

Registry-publish release. Adds the metadata required to publish the
package to the official **MCP Server Registry** (`registry.modelcontextprotocol.io`),
which replaces the retired third-party-server list in
`modelcontextprotocol/servers/README.md`.

### Added
- `package.json` `mcpName` → `io.github.intent-driven-software/idf-mcp`
  (npm-package ownership-verification marker required by the Registry).
- `server.json` at repo root — Registry manifest with stdio transport
  declaration and the five public environment variables (`IDF_SERVER`,
  `IDF_DOMAIN`, `IDF_BOOTSTRAP`, `IDF_ONTOLOGY_PATH`, `IDF_AUTH_TOKEN`).

### Changed
- `package.json` version 1.0.1 → 1.0.2.
- `src/server.js` MCP Server identity version → 1.0.2.

No behavioural changes — same tool surface, same wire shape. Existing
1.0.1 installs continue to work.

After this release ships to npm, run from the repo root:

```bash
mcp-publisher login github
mcp-publisher publish
```

Server will then appear at
`https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.intent-driven-software/idf-mcp`.

## [1.0.1] — 2026-05-04

Patch release. Repository moved from `DubovskiyIM/idf-mcp` to
`intent-driven-software/idf-mcp` as part of org consolidation; this
release re-publishes the tarball with the updated `repository.url`
metadata so npmjs.com links resolve directly to the org repo (rather
than going through GitHub's 301 redirect from the personal namespace).

### Changed
- `package.json` `homepage` and `repository.url` → `intent-driven-software/idf-mcp`
- `src/server.js` MCP Server identity version → `1.0.1`
- `bin/mcp-idf.js` README references → org URLs
- `CHANGELOG.md` GitHub commit/PR refs to `idf-mcp` PRs reflow through `intent-driven-software/idf-mcp` (the original `DubovskiyIM/idf` host commit references are intentionally preserved — host runtime stays personal)

No code or behavioural changes. Tarball contents identical except for `package.json`, `src/server.js`, README, and CHANGELOG. Existing 1.0.0 installs continue to work.

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
