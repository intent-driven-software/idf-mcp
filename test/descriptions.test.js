import { describe, it, expect } from "vitest";
import { buildDescription, conditionsToText } from "../src/descriptions.js";

describe("conditionsToText", () => {
  it("пустые / undefined → пустая строка", () => {
    expect(conditionsToText([])).toBe("");
    expect(conditionsToText(undefined)).toBe("");
    expect(conditionsToText(null)).toBe("");
  });

  it("IDF-форма { entity, field, op, value } — booking example", () => {
    const text = conditionsToText([
      { entity: "booking", field: "status", op: "=", value: "confirmed" },
      { entity: "booking", field: "clientId", op: "=", value: { ref: "viewer.id" } },
    ]);
    expect(text).toBe('\n\nПредусловия: booking.status = "confirmed"; booking.clientId = viewer.id');
  });

  it("alternate форма { left, op, right }", () => {
    const text = conditionsToText([{ left: "count", op: ">", right: 5 }]);
    expect(text).toContain("count > 5");
  });

  it("value.ref раскрывается в text без JSON-обёртки", () => {
    const text = conditionsToText([
      { entity: "task", field: "ownerId", op: "=", value: { ref: "viewer.id" } },
    ]);
    expect(text).toContain("task.ownerId = viewer.id");
    expect(text).not.toContain('{"ref"');
  });
});

describe("buildDescription", () => {
  it("простой intent — только description", () => {
    const d = buildDescription({
      intentId: "login",
      name: "Войти",
      description: "Сессия пользователя",
    });
    expect(d).toBe("Сессия пользователя");
  });

  it("creates добавляет \"Создаёт: X\"", () => {
    const d = buildDescription({
      intentId: "leave_review",
      name: "Оставить отзыв",
      description: "Оставить отзыв",
      creates: "Review",
    });
    expect(d).toContain("Создаёт: Review");
  });

  it("irreversibility:high → предупреждение", () => {
    const d = buildDescription({
      intentId: "cancel_booking",
      description: "Отменить запись",
      irreversibility: "high",
    });
    expect(d).toContain("⚠️");
    expect(d).toContain("Необратимое действие");
  });

  it("irreversibility:low → нет предупреждения", () => {
    const d = buildDescription({
      intentId: "create_booking",
      description: "Создать запись",
      irreversibility: "low",
    });
    expect(d).not.toContain("⚠️");
  });

  it("conditions попадают в description как Предусловия", () => {
    const d = buildDescription({
      intentId: "cancel_booking",
      description: "Отменить запись",
      irreversibility: "high",
      conditions: [
        { entity: "booking", field: "status", op: "=", value: "confirmed" },
      ],
    });
    expect(d).toContain("Предусловия: booking.status");
  });

  it("fallback на name/intentId если description отсутствует", () => {
    expect(buildDescription({ intentId: "x", name: "XName" })).toContain("XName");
    expect(buildDescription({ intentId: "y" })).toContain("y");
  });
});
