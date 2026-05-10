# What is Fold?

**Fold** — agent governance runtime. Коробочный slot-in между LLM-агентом и реальным backend'ом.

## Решает 4 задокументированные боли AI-агентов

1. **Destructive actions без permission scope** (PocketOS, Replit incidents) → `role.base` + `role.scope` filtering
2. **Generic 500 без machine-readable reason** (90.8% retry waste) → structured rejections с invariant-violation reasons
3. **Over-broad capability tokens** (Supabase service_role, GitHub MCP PAT leaks) → preapproval guards + maxAmount/csvInclude/dailySum predicates
4. **Нет point of no return** (Railway blog) → `__irr.point` irreversibility primitive с escape-proof доказательством

## Что входит в Fold

| Часть | Репо | npm |
|---|---|---|
| MCP server | `idf-mcp/` | `@intent-driven/mcp-server` |
| Standalone runtime | `idf-sdk/packages/runtime-local/` | `@intent-driven/runtime-local` |
| CLI (`idf serve`, `idf approvals`, `idf approve`) | `idf-sdk/packages/cli/` | `@intent-driven/cli` |
| Docker quickstart | `fold-runtime-quickstart/` | — |
| Landing | `fold-landing/` | fold.intent-design.tech |

## Что не Fold

- **Не Studio** — Fold не делает UI, не имеет multi-tenant control plane. Studio — отдельный продукт (см. `~/WebstormProjects/idf/docs/products.md`).
- **Не сам формат IDF** — Fold потребляет IDF-онтологию, но спецификация формата живёт в `idf-spec/`.
- **Не middleware** — Fold sibling к backend'у через MCP, не proxy перед API.

## Time to first `approve_pending`

Цель: ≤ 15 минут от `npm install` на NestJS+TypeORM+PG проекте. Quickstart-доc — `~/WebstormProjects/fold-runtime-quickstart/README.md`.
