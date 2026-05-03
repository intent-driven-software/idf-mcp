/**
 * Построение MCP tool description из IDF intent-schema entry.
 *
 * Суть: передать LLM максимум полезного контекста из онтологии, чтобы
 * агент мог правильно выбрать tool и не пытаться его вызывать когда
 * предусловия не выполнены.
 *
 * Составляющие:
 *   1. intent.description (или fallback на intent.name)
 *   2. "Creates: <entity>" если intent.creates
 *   3. "⚠️ Irreversible action" если irreversibility: "high" (§23)
 *   4. "Preconditions: …" из intent.conditions
 *   5. "May fail on: …" из intent.invariants — релевантные доменные
 *      правила, на которые этот intent МОЖЕТ упасть. Это и есть
 *      главный edge vs ручных MCP-серверов: правила попадают в hint
 *      ДО вызова, не только в rejection ПОСЛЕ.
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
  return `\n\nPreconditions: ${parts}`;
}

export function invariantsToText(invariants) {
  if (!invariants || invariants.length === 0) return "";
  const lines = invariants.map(inv => {
    const sev = inv.severity && inv.severity !== "error" ? ` [${inv.severity}]` : "";
    return `  - ${inv.summary}${sev}`;
  });
  return `\n\nMay fail on (domain invariants):\n${lines.join("\n")}`;
}

export function buildDescription(intent) {
  const base = intent.description || intent.name || intent.intentId;
  const creates = intent.creates ? `\n\nCreates: ${intent.creates}` : "";
  const irr = intent.irreversibility === "high"
    ? "\n\n⚠️ Irreversible action (point-of-no-return: high). Forward-correction only after this effect is confirmed."
    : "";
  return base + creates + irr + conditionsToText(intent.conditions) + invariantsToText(intent.invariants);
}
