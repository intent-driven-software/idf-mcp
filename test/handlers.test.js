import { describe, it, expect } from "vitest";
import { buildResourceList } from "../src/handlers.js";

describe("buildResourceList", () => {
  it("per-collection ресурсы из visibleFields", () => {
    const resources = buildResourceList({
      domain: "booking",
      visibleFields: {
        Specialist: ["id", "name"],
        Booking: ["id", "slotId", "status"],
      },
      worldSnapshot: { specialists: [], bookings: [] },
    });
    expect(resources).toHaveLength(2);
    expect(resources.map(r => r.uri).sort()).toEqual([
      "idf://booking/bookings",
      "idf://booking/specialists",
    ]);
  });

  it("URI schema стабильный — idf://<domain>/<collection>", () => {
    const [r] = buildResourceList({
      domain: "freelance",
      visibleFields: { Task: ["id"] },
      worldSnapshot: { tasks: [] },
    });
    expect(r.uri).toBe("idf://freelance/tasks");
    expect(r.mimeType).toBe("application/json");
  });

  it("если collection нет в worldSnapshot — fallback на простой plural", () => {
    const [r] = buildResourceList({
      domain: "booking",
      visibleFields: { Review: ["id"] },
      worldSnapshot: {}, // пустой snapshot
    });
    expect(r.uri).toBe("idf://booking/reviews");
  });

  it("irregular plural (TimeSlot → timeSlots) берётся из snapshot", () => {
    const [r] = buildResourceList({
      domain: "booking",
      visibleFields: { TimeSlot: ["id", "date"] },
      worldSnapshot: { timeSlots: [], specialists: [] },
    });
    expect(r.uri).toBe("idf://booking/timeSlots");
  });

  it("пустые visibleFields → пустой массив", () => {
    expect(buildResourceList({ domain: "x", visibleFields: null, worldSnapshot: {} })).toEqual([]);
    expect(buildResourceList({ domain: "x", visibleFields: {}, worldSnapshot: {} })).toEqual([]);
  });

  it("поля entity попадают в description", () => {
    const [r] = buildResourceList({
      domain: "booking",
      visibleFields: { Booking: ["id", "slotId", "status", "price"] },
      worldSnapshot: { bookings: [] },
    });
    expect(r.description).toContain("id, slotId, status, price");
  });

  it("строковый маркер (invest 'own'/'all') не падает, превращается в scope-описание", () => {
    const resources = buildResourceList({
      domain: "invest",
      visibleFields: {
        Portfolio: "own",
        Transaction: "all",
        Position: "aggregated",
      },
      worldSnapshot: { portfolios: [], transactions: [], positions: [] },
    });
    expect(resources).toHaveLength(3);
    expect(resources[0].description).toContain("scope: own");
    expect(resources[1].description).toContain("scope: all");
    expect(resources[2].description).toContain("scope: aggregated");
  });
});
