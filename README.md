# @intent-driven/mcp-server

Превращает любой [IDF](https://github.com/DubovskiyIM/idf)-домен в MCP-сервер
для Claude Desktop / Cursor / Zed. Тонкий адаптер поверх
`/api/agent/:domain/{schema, world, exec}` — **один файл онтологии → MCP-tools
без дополнительной работы**.

```
IDF intent.canExecute        ─→   MCP tool
intent.parameters            ─→   JSON Schema inputSchema
intent.conditions            ─→   description hint для LLM
intent.irreversibility:high  ─→   annotations.destructiveHint
role.visibleFields           ─→   resource per collection
preapproval guard            ─→   автоматические scope/limits
checkOwnership               ─→   автоматический access control
```

## Quick start

1. Поднимите IDF server (из репо [idf](https://github.com/DubovskiyIM/idf)):

   ```bash
   npm run server   # :3001 по умолчанию
   ```

2. Добавьте сервер в Claude Desktop
   (`~/Library/Application Support/Claude/claude_desktop_config.json`):

   ```json
   {
     "mcpServers": {
       "idf-booking": {
         "command": "npx",
         "args": ["-y", "@intent-driven/mcp-server"],
         "env": {
           "IDF_SERVER": "http://localhost:3001",
           "IDF_DOMAIN": "booking",
           "IDF_ONTOLOGY_PATH": "/Users/you/WebstormProjects/idf/src/domains/booking"
         }
       }
     }
   }
   ```

3. Перезапустите Claude Desktop — в Tools-меню появятся инструменты
   `create_booking`, `cancel_booking`, `reschedule_booking`, …

## CLI

```bash
mcp-idf --domain=booking --server=http://localhost:3001
mcp-idf --domain=freelance --ontology-path=/abs/path/to/src/domains/freelance
mcp-idf --no-bootstrap   # не загружать онтологию (предполагается, уже загружена)
```

Флаги / env переменные:

| Флаг | Env | По умолчанию |
|---|---|---|
| `--domain` | `IDF_DOMAIN` | `booking` |
| `--server` | `IDF_SERVER` | `http://localhost:3001` |
| `--ontology-path` | `IDF_ONTOLOGY_PATH` | `./src/domains/<domain>` |
| `--agent-email` | `IDF_AGENT_EMAIL` | `mcp-agent@local` |
| `--no-bootstrap` | `IDF_BOOTSTRAP=0` | bootstrap включён |

## Что экспонируется

### tools

Один tool на каждый intent из `ontology.roles.agent.canExecute`.

- `name` — `intentId`
- `title` — `intent.name`
- `description` — `intent.description` + `Создаёт: …` + предусловия +
  предупреждение о необратимости (если `irreversibility: "high"`)
- `inputSchema` — JSON Schema из `particles.parameters`:
  - `entityRef` / `id` / `text` / `textarea` / `select` → `string`
  - `number` → `number`
  - `boolean` → `boolean`
  - `datetime` → `string` + `format: "date-time"`
  - `email` → `string` + `format: "email"`
- `annotations.destructiveHint` — `true` если
  `intent.irreversibility === "high"` (§23 IDF: effect-level точка невозврата)

### resources

Один resource на каждую коллекцию из `role.visibleFields[entity]`.
URI-схема: `idf://<domain>/<collection>`.

`resources/read` возвращает filtered world из `/api/agent/:domain/world` —
уже отфильтрованный под viewer (single-owner + m2m через role.scope).

## Почему это нелинейный выигрыш

MCP-сообщество решает эти задачи руками в каждом сервере:

1. **Scope / visibility.** Руками решается через декораторы или middleware.
   IDF: `role.visibleFields` — декларативно.
2. **Permissions.** Руками: OAuth scopes, custom ACL.
   IDF: `ontology.roles.agent.canExecute` — декларативно.
3. **Rate limits / spending caps.** Руками.
   IDF: `preapproval.requiredFor` с `maxAmount` / `dailySum` — декларативно.
4. **Destructive hints.** Руками проставляются, часто забываются.
   IDF: `effect.context.__irr.point === "high"` → `destructiveHint: true`
   автоматически.
5. **Business rules как hint для LLM.** Обычно не передаются.
   IDF: `intent.conditions` попадают в tool description:
   `"booking.status = \"confirmed\"; booking.clientId = viewer.id"`.

## Ограничения 0.1

- Только `tools` и `resources`. `prompts` / `completion` — roadmap.
- Bootstrap читает ontology из локальной FS. Для SaaS-варианта (ontology из
  БД / API) — следующая версия.
- Auth: login по email/password. PAT / OAuth2 — 0.2.
- Sync-only (`POST /exec` sync). Long-running через MCP tasks API — 0.3.

## Ссылки

- [IDF манифест v2](https://github.com/DubovskiyIM/idf/blob/main/docs/manifesto-v2.md) — §1 (материализации),
  §5 (роли), §17 (agent-layer), §23 (irreversibility)
- [MCP spec](https://modelcontextprotocol.io)

## Лицензия

MIT
