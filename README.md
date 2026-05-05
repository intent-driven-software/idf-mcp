# @intent-driven/mcp-server

[![CI](https://github.com/intent-driven-software/idf-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/intent-driven-software/idf-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@intent-driven/mcp-server.svg)](https://www.npmjs.com/package/@intent-driven/mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@intent-driven/mcp-server.svg)](https://www.npmjs.com/package/@intent-driven/mcp-server)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Stop giving AI agents API keys. Give them a domain.**

`@intent-driven/mcp-server` exposes any [IDF](https://github.com/DubovskiyIM/idf) domain
to Claude Desktop / Cursor / Zed as a Model Context Protocol server &mdash; with
**domain semantics in tool descriptions** (preconditions, invariants,
irreversibility, role scopes) and **structured rejections** when the agent
tries something it shouldn't. Not a 500. Not a string. A JSON shape the
LLM can read and adapt to.

→ Landing &amp; demo: **[fold.intent-design.tech](https://fold.intent-design.tech)**
→ 5-min quickstart: **[github.com/intent-driven-software/fold-runtime-quickstart](https://github.com/intent-driven-software/fold-runtime-quickstart)**

### 75-second walkthrough

[![Watch the demo on Loom](https://cdn.loom.com/sessions/thumbnails/2ca4a40e3b9245feb86a74a998e42cb8-with-play.gif)](https://www.loom.com/share/2ca4a40e3b9245feb86a74a998e42cb8)

→ **[Watch on Loom →](https://www.loom.com/share/2ca4a40e3b9245feb86a74a998e42cb8)**

---

## Why this exists

On April 25 2026 a Cursor agent powered by Claude Opus 4.6, working on a
credential mismatch in PocketOS staging, found an unrelated API token,
decided to delete a Railway volume to fix things, and wiped the production
database **and all volume-level backups** in 9 seconds. The agent's own
post-mortem:

> "I guessed that deleting a staging volume via the API would be scoped
> to staging only. I didn't verify. I didn't check if the volume ID was
> shared across environments."

30-hour outage. PocketOS rolled back to a 3-month-old backup.
([The Register](https://www.theregister.com/2026/04/27/cursoropus_agent_snuffs_out_pocketos/) ·
[FastCompany](https://www.fastcompany.com/91533544/cursor-claude-ai-agent-deleted-software-company-pocket-os-database-jer-crane) ·
[OECD AI Incident #6153](https://oecd.ai/en/incidents/2026-04-27-6153))

This isn't an alignment problem. The system never told the agent what
was allowed, why it shouldn't, or what would happen if it tried. Existing
MCP servers don't either &mdash; tool descriptions carry endpoint shape
and not much else. The agent learns by colliding with 500s.

This package fixes that. The MCP tool descriptions carry the **why** the
call might fail; the rejection carries the **what** failed, structured.

## How it plugs into your stack

`@intent-driven/mcp-server` is a **stdio MCP adapter** that talks to a
**Fold runtime** over an HTTP API. The runtime is a sibling service —
not middleware in your existing app, not codegen at runtime. Your current
backend stays where it is; the IDF artifact *describes* the agent-facing
surface, and the runtime serves it on its own port (default `:3001`).

```
┌──────────────────┐   stdio    ┌──────────────────┐   HTTP   ┌────────────────────┐
│ Claude Desktop   │ ◀─────────▶│ @intent-driven/  │ ◀───────▶│ Fold runtime       │
│ Cursor / Zed     │            │ mcp-server       │          │ (idf host :3001)   │
└──────────────────┘            └──────────────────┘          └────────┬───────────┘
                                                                       │ reads
                                                                       ▼
                                                              ┌────────────────────┐
                                                              │ IDF artifact       │
                                                              │ (entities + intents│
                                                              │  + invariants +    │
                                                              │  roles + __irr)    │
                                                              └────────────────────┘
```

The **MCP server** is what Claude/Cursor connects to. The **runtime** is
what enforces the rejection. The **IDF artifact** is what you author.

**Who this is for.** You're the engineer at a 5–30-person team putting
an AI agent into production this quarter — on top of a real backend,
with real customers, real SOC2 review on the horizon. You don't want a
guardrail layer that reviews after the fact. You want the system itself
to refuse the wrong action — before the call, with a structured reason
the agent can read.

## What the agent actually sees

`submit_response` in the freelance domain:

```
Executor публикует Response на Task в status=published; Response.status=pending; +1 в Task.responsesCount

Creates: Response(pending)

Preconditions: task.status = "published"

May fail on (domain invariants):
  - Response.taskId must reference existing Task.id
  - Response: max 1 per taskId where (status="selected")
  - Response: row count rule per taskId where (status="pending") [info]
```

`release_payment` in the same domain:

```
Customer releases escrow to executor. After confirmation, money is gone — forward-correction only.

⚠️ Irreversible action (point-of-no-return: high). Forward-correction only after this effect is confirmed.

May fail on (domain invariants):
  - Deal.status transitions allowed: in_progress→completed, on_review→completed, ...
```

None of this is hand-written for the MCP server. It's all derived from
one declarative IDF artifact (entities + intents + invariants + roles
+ irreversibility points).

## What a structured rejection looks like

Agent submits a $50,000 BTC long without preapproval. The runtime
intercepts **before** any effect lands in storage:

```json
HTTP 403
{
  "error": "preapproval_denied",
  "intentId": "agent_execute_preapproved_order",
  "reason": "no_preapproval",
  "details": {
    "entity": "AgentPreapproval",
    "ownerField": "userId",
    "viewerId": "user_5f57c252"
  }
}
```

The next move for any sane agent: stop, ask the human for a preapproval,
retry. Not a 500. Not a string. A JSON shape the LLM can read and adapt to.

---

## Quickstart

The fastest path is the [**fold-runtime-quickstart**](https://github.com/intent-driven-software/fold-runtime-quickstart)
&mdash; two commands, Docker-bundled, no path configuration:

```bash
git clone https://github.com/intent-driven-software/fold-runtime-quickstart && cd $_
docker compose up                  # ~3 min first time, ~5 sec after

# in another terminal
npm install
npm run demo:rogue   && \          # Act 1: $50K trade → 403 with structured rejection
  npm run demo:grant && \          # Act 2: investor issues $1K cap (one declarative effect)
  npm run demo:smart               # Act 3: agent reads cap, scales to $950, executes 200 OK
```

If you'd rather drive the host yourself (e.g. for development against your
own ontologies), see the next section.

## Drive the MCP server directly

You need a running IDF host on `localhost:3001` (the quickstart's
docker-compose gives you that, or run [`idf`](https://github.com/DubovskiyIM/idf)
manually) and a bootstrapped domain.

### CLI

```bash
# bootstrap from local FS (ontology + intents)
mcp-idf --domain=invest --ontology-path=/abs/path/to/idf/src/domains/invest

# skip bootstrap (domain already loaded by another client / docker)
mcp-idf --domain=invest --no-bootstrap
```

Flags / env vars:

| Flag                | Env var                | Default                         |
|---------------------|------------------------|---------------------------------|
| `--domain`          | `IDF_DOMAIN`           | `booking`                       |
| `--server`          | `IDF_SERVER`           | `http://localhost:3001`         |
| `--ontology-path`   | `IDF_ONTOLOGY_PATH`    | `./src/domains/<domain>`        |
| `--agent-email`     | `IDF_AGENT_EMAIL`      | `mcp-agent@local`               |
| `--no-bootstrap`    | `IDF_BOOTSTRAP=0`      | bootstrap on (load FS ontology) |

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "invest": {
      "command": "npx",
      "args": ["-y", "@intent-driven/mcp-server"],
      "env": {
        "IDF_SERVER": "http://localhost:3001",
        "IDF_DOMAIN": "invest",
        "IDF_BOOTSTRAP": "0",
        "IDF_AGENT_EMAIL": "claude@local"
      }
    }
  }
}
```

`IDF_BOOTSTRAP=0` if the host already has the domain loaded (the quickstart
container does this on `docker compose up`). Restart Claude Desktop fully
(⌘Q + relaunch &mdash; closing the window isn't enough). All
agent-callable intents appear in the **Tools** menu.

---

## Schema mapping

```
IDF intent.canExecute              ─→  MCP tool
intent.parameters                  ─→  JSON Schema inputSchema
intent.conditions                  ─→  description hint for LLM
ontology.invariants (relevant)     ─→  description block "May fail on"
intent.irreversibility:high        ─→  annotations.destructiveHint + warning
role.visibleFields                 ─→  resource per collection
preapproval guard                  ─→  automatic scope/limits
checkOwnership                     ─→  automatic access control
```

### Tools

One tool per intent in `ontology.roles.agent.canExecute`.

- `name` — `intentId`
- `title` — `intent.name`
- `description` — `intent.description` + `Creates: …` + preconditions +
  `May fail on (domain invariants)` block + irreversibility warning when
  `irreversibility: "high"`
- `inputSchema` — JSON Schema from `particles.parameters`:
  - `entityRef` / `id` / `text` / `textarea` / `select` → `string`
  - `number` → `number`
  - `boolean` → `boolean`
  - `datetime` → `string` + `format: "date-time"`
  - `email` → `string` + `format: "email"`
- `annotations.destructiveHint` — `true` when
  `intent.irreversibility === "high"` (§23 IDF: effect-level point of no return)

### Resources

One resource per collection in `role.visibleFields[entity]`. URI scheme:
`idf://<domain>/<collection>`.

`resources/read` returns the filtered world from
`/api/agent/:domain/world` &mdash; already scoped per viewer (single-owner
+ m2m via `role.scope`).

---

## What this gets you that hand-rolled MCP doesn't

The MCP community solves these by hand in every server:

1. **Scope / visibility.** Decorators or middleware. → IDF declares `role.visibleFields`.
2. **Permissions.** OAuth scopes, custom ACL. → IDF declares `roles.agent.canExecute`.
3. **Rate limits / spending caps.** Bespoke per server. → IDF declares `preapproval.requiredFor` with `maxAmount` / `dailySum`.
4. **Destructive hints.** Manual, often forgotten. → IDF: `effect.context.__irr.point === "high"` → `destructiveHint: true` automatic.
5. **Business rules as LLM hint.** Usually not transmitted. → IDF: `intent.conditions` land in tool description as `Preconditions:`.
6. **Domain invariants in descriptions.** Almost never. → IDF computes the relevant invariants per intent (alpha × entity match) and injects them as `May fail on (domain invariants)`. Closes the #1 complaint about hand-rolled MCP servers: *"the server doesn't carry domain semantics — the LLM knows what to call but not why it'll fail."*

---

## How long does authoring an IDF artifact take

Three reference points from the public IDF host runtime:

| Domain      | Shape                                                          | Time                                |
|-------------|----------------------------------------------------------------|-------------------------------------|
| `invest`    | 14 entities · 61 intents · 5 invariants · ~600 lines           | a weekend, hand-written             |
| `gravitino` | 253 entities (Apache catalog OpenAPI) · 120 intents            | imported in <1h, enriched in 2 days |
| `workflow`  | 9 entities · 47 intents · timer queue · cascade rules          | a day                               |

Where the speed comes from (all in `@intent-driven/cli`):

- `idf import postgres` — reads your live schema, generates entity
  baseline with FKs and column types as `fieldRole`.
- `idf import openapi` — reads your existing API spec, generates intents
  + parameter shapes + reference fields. *This is how a 253-entity
  domain gets bootstrapped.*
- `idf import prisma` — same story for ORM-driven backends.
- `idf enrich` — LLM pass to fill `label`, `fieldRole`, `compositions`,
  suggested `roles.agent.preapproval` predicates from your existing
  code comments.

The author-once-then-forget loop is the whole point. Once the artifact
exists, you don't regenerate scaffolding on schema change — the runtime
re-reads and serves four readers (UI, voice, agent, document) off the
same file.

---

## Domain prerequisites

The protocol is reliable, but it needs the IDF domain to be authored
correctly. Without these, `tools/list` may return empty,
`tools/call` may return `domain_not_supported`, resources may be empty:

1. **`ontology.roles.agent`** must be declared. No agent role → no tools, no resources.
2. **`role.agent.canExecute`** — list of safe intents. Avoid `__irr:high` without preapproval.
3. **`role.agent.visibleFields`** — array of fields or `"own"` / `"all"` / `"aggregated"` markers.
4. **Server-side effect builder** (`server/schema/effectBuildersRegistry.cjs` in `idf`) must include your domain. Without it `tools/call` returns `domain_not_supported`.
5. **Public catalogs without `ownerField`.** When an entity has `ownerField`, the SDK `filterWorldForRole` filters out rows where `row[ownerField] !== viewer.id`. For public catalogs (e.g. `Task` with `status: "published"`) use `role.scope` with a via-collection or a separate agent-roleable projection (roadmap).

---

## Limitations (1.0)

- `tools` and `resources` only. `prompts` / `completion` — roadmap.
- Bootstrap reads ontology from local FS. SaaS variant (ontology from DB/API) — next.
- Auth: email/password login. PAT / OAuth2 — next.
- Sync only (`POST /exec`). Long-running via MCP tasks API — next.

## Links

- **Landing &amp; demo:** [fold.intent-design.tech](https://fold.intent-design.tech)
- **Quickstart:** [intent-driven-software/fold-runtime-quickstart](https://github.com/intent-driven-software/fold-runtime-quickstart)
- **Host runtime:** [DubovskiyIM/idf](https://github.com/DubovskiyIM/idf)
- **Format spec:** [Manifesto v2](https://github.com/DubovskiyIM/idf/blob/main/docs/manifesto-v2.md) — §1 (materializations), §5 (roles), §17 (agent layer), §23 (irreversibility)
- **MCP spec:** [modelcontextprotocol.io](https://modelcontextprotocol.io)

## License

MIT
