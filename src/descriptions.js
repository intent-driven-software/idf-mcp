/**
 * Построение MCP tool description из IDF intent-schema entry.
 *
 * Суть: передать LLM максимум полезного контекста из онтологии, чтобы
 * агент мог правильно выбрать tool и не пытаться его вызывать когда
 * предусловия не выполнены.
 *
 * Составляющие:
 *   1. intent.description (или fallback на intent.name)
 *   2. "Создаёт: <entity>" если intent.creates
 *   3. "⚠️ Необратимое действие" если irreversibility: "high" (§23)
 *   4. "Предусловия: …" из intent.conditions — это и есть competitive
 *      edge vs ручных MCP-серверов: бизнес-правила попадают в hint.
 */

export function conditionsToText(conditions) {
  if (!conditions || conditions.length === 0) return "";
  const parts = conditions
    .map(c => {
      const lhs = c.entity ? `${c.entity}.${c.field}` : (c.left ?? c.field ?? "?");
      const rhs = c.value && typeof c.value === "object" && "ref" in c.value
        ? c.value.ref
        : JSON.stringify(c.value ?? c.right);
      return `${lhs} ${c.op} ${rhs}`;
    })
    .join("; ");
  return `\n\nПредусловия: ${parts}`;
}

export function buildDescription(intent) {
  const base = intent.description || intent.name || intent.intentId;
  const creates = intent.creates ? `\n\nСоздаёт: ${intent.creates}` : "";
  const irr = intent.irreversibility === "high"
    ? "\n\n⚠️ Необратимое действие (точка невозврата высокая)."
    : "";
  return base + creates + irr + conditionsToText(intent.conditions);
}
