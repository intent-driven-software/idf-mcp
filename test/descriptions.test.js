import { describe, it, expect } from "vitest";
import {
  buildDescription,
  conditionsToText,
  invariantsToText,
} from "../src/descriptions.js";

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
    expect(text).toBe(
      '\n\nPreconditions: booking.status = "confirmed"; booking.clientId = viewer.id'
    );
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

describe("invariantsToText", () => {
  it("пустые / undefined → пустая строка", () => {
    expect(invariantsToText([])).toBe("");
    expect(invariantsToText(undefined)).toBe("");
    expect(invariantsToText(null)).toBe("");
  });

  it("один invariant — попадает как bullet с summary", () => {
    const text = invariantsToText([
      {
        name: "deal_status_transition",
        kind: "transition",
        entity: "Deal",
        severity: "warning",
        summary: "Deal.status transitions allowed: new→in_progress, in_progress→completed",
      },
    ]);
    expect(text).toContain("May fail on (domain invariants):");
    expect(text).toContain("- Deal.status transitions allowed");
    expect(text).toContain("[warning]");
  });

  it("error severity не показывается явно (default)", () => {
    const text = invariantsToText([
      {
        name: "ref",
        kind: "referential",
        entity: "Response",
        severity: "error",
        summary: "Response.taskId must reference existing Task.id",
      },
    ]);
    expect(text).toContain("Response.taskId must reference existing Task.id");
    expect(text).not.toContain("[error]");
  });

  it("несколько инвариантов — bullet-list", () => {
    const text = invariantsToText([
      { name: "a", kind: "referential", summary: "Response.taskId → Task.id" },
      { name: "b", kind: "cardinality", summary: "Response: max 1 per taskId" },
    ]);
    const lines = text.split("\n").filter(l => l.startsWith("  - "));
    expect(lines).toHaveLength(2);
  });
});

describe("buildDescription", () => {
  it("простой intent — только description", () => {
    const d = buildDescription({
      intentId: "login",
      name: "Login",
      description: "User session",
    });
    expect(d).toBe("User session");
  });

  it("creates добавляет \"Creates: X\"", () => {
    const d = buildDescription({
      intentId: "leave_review",
      name: "Leave review",
      description: "Leave a review for the deal",
      creates: "Review",
    });
    expect(d).toContain("Creates: Review");
  });

  it("irreversibility:high → предупреждение про forward-correction", () => {
    const d = buildDescription({
      intentId: "release_escrow",
      description: "Release escrow to executor",
      irreversibility: "high",
    });
    expect(d).toContain("⚠️");
    expect(d).toContain("Irreversible action");
    expect(d).toContain("Forward-correction only");
  });

  it("irreversibility:low → нет предупреждения", () => {
    const d = buildDescription({
      intentId: "create_booking",
      description: "Create a booking",
      irreversibility: "low",
    });
    expect(d).not.toContain("⚠️");
  });

  it("conditions попадают в description как Preconditions", () => {
    const d = buildDescription({
      intentId: "cancel_booking",
      description: "Cancel booking",
      irreversibility: "high",
      conditions: [
        { entity: "booking", field: "status", op: "=", value: "confirmed" },
      ],
    });
    expect(d).toContain("Preconditions: booking.status");
  });

  it("invariants попадают в description как May fail on", () => {
    const d = buildDescription({
      intentId: "submit_response",
      description: "Submit response to a task",
      creates: "Response",
      invariants: [
        {
          name: "response_references_task",
          kind: "referential",
          entity: "Response",
          severity: "error",
          summary: "Response.taskId must reference existing Task.id",
        },
        {
          name: "task_has_at_most_one_selected_response",
          kind: "cardinality",
          entity: "Response",
          severity: "error",
          summary: 'Response: max 1 per taskId where (status="selected")',
        },
      ],
    });
    expect(d).toContain("May fail on (domain invariants):");
    expect(d).toContain("Response.taskId must reference existing Task.id");
    expect(d).toContain("max 1 per taskId");
  });

  it("полная композиция: description + creates + irr + preconditions + invariants", () => {
    const d = buildDescription({
      intentId: "cancel_deal",
      description: "Cancel an in-progress deal",
      creates: null,
      irreversibility: "high",
      conditions: [
        { entity: "deal", field: "status", op: "=", value: "in_progress" },
      ],
      invariants: [
        {
          kind: "transition",
          summary: "Deal.status transitions allowed: in_progress→cancelled",
          severity: "warning",
        },
      ],
    });
    // Сохраняется порядок и каждый блок присутствует
    const idxIrr = d.indexOf("Irreversible");
    const idxPre = d.indexOf("Preconditions:");
    const idxInv = d.indexOf("May fail on");
    expect(idxIrr).toBeGreaterThan(0);
    expect(idxPre).toBeGreaterThan(idxIrr);
    expect(idxInv).toBeGreaterThan(idxPre);
  });

  it("fallback на name/intentId если description отсутствует", () => {
    expect(buildDescription({ intentId: "x", name: "XName" })).toContain("XName");
    expect(buildDescription({ intentId: "y" })).toContain("y");
  });
});
