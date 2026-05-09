import { describe, it, expect, vi, afterEach } from "vitest";
import { buildResourceList, makeToolCallHandler } from "../src/handlers.js";

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

  it("y→ies (Category → categories) — через pluralize-правило", () => {
    const [r] = buildResourceList({
      domain: "freelance",
      visibleFields: { Category: ["id", "name"] },
      worldSnapshot: { categories: [1, 2, 3] },
    });
    expect(r.uri).toBe("idf://freelance/categories");
  });

  it("x/sh → +es (Address → addresses)", () => {
    const [r] = buildResourceList({
      domain: "delivery",
      visibleFields: { Address: ["id"] },
      worldSnapshot: { addresses: [] },
    });
    expect(r.uri).toBe("idf://delivery/addresses");
  });

  it("если snapshot пуст — fallback на plural-guess правила", () => {
    const [r] = buildResourceList({
      domain: "x",
      visibleFields: { Category: ["id"] },
      worldSnapshot: null,
    });
    // fallback: pluralize("category") === "categories"
    expect(r.uri).toBe("idf://x/categories");
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

describe("makeToolCallHandler — read vs mutation routing", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("read intent (alpha=read) → GET /api/agent/:domain/world + filter rows", async () => {
    const calls = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url, method: init?.method || "GET" });
      return {
        ok: true,
        async json() {
          return { world: { products: [{ id: "p1", name: "T-Shirt" }, { id: "p2", name: "Mug" }] } };
        },
      };
    });
    const intentsById = {
      list_products: { intentId: "list_products", alpha: "read", target: "Product" },
    };
    const handler = makeToolCallHandler({ server: "http://x", domain: "ecom", token: "t", intentsById });
    const result = await handler("list_products", {});
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://x/api/agent/ecom/world");
    expect(calls[0].method).toBe("GET");
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("confirmed");
    expect(parsed.collection).toBe("products");
    expect(parsed.count).toBe(2);
    expect(parsed.rows).toHaveLength(2);
  });

  it("mutation intent (alpha=add) → POST /api/agent/:domain/exec/:intentId", async () => {
    const calls = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url, method: init?.method, body: init?.body });
      return { ok: true, async json() { return { status: "confirmed", effect: { id: "e1" } }; } };
    });
    const intentsById = {
      create_order: { intentId: "create_order", alpha: "add", target: "Order" },
    };
    const handler = makeToolCallHandler({ server: "http://x", domain: "ecom", token: "t", intentsById });
    const result = await handler("create_order", { params: { total: 100 } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://x/api/agent/ecom/exec/create_order");
    expect(calls[0].method).toBe("POST");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("confirmed");
  });

  it("intent не в map → fallback POST exec (backward compat)", async () => {
    const calls = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url, method: init?.method });
      return { ok: true, async json() { return { ok: true }; } };
    });
    const handler = makeToolCallHandler({ server: "http://x", domain: "d", token: "t" });
    await handler("unknown_intent", {});
    expect(calls[0].url).toBe("http://x/api/agent/d/exec/unknown_intent");
    expect(calls[0].method).toBe("POST");
  });

  it("read с target='Order.status' — берётся base entity (Order → orders)", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      async json() { return { world: { orders: [{ id: "o1", status: "pending" }] } }; },
    }));
    const intentsById = {
      verify_payment_status: { intentId: "verify_payment_status", alpha: "read", target: "Order.paymentStatus" },
    };
    const handler = makeToolCallHandler({ server: "http://x", domain: "ecom", token: "t", intentsById });
    const result = await handler("verify_payment_status", {});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.collection).toBe("orders");
    expect(parsed.rows).toHaveLength(1);
  });

  it("read когда /world возвращает 500 → isError + world_fetch_failed", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, async text() { return "boom"; } }));
    const intentsById = { list_x: { intentId: "list_x", alpha: "read", target: "X" } };
    const handler = makeToolCallHandler({ server: "http://x", domain: "d", token: "t", intentsById });
    const result = await handler("list_x", {});
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("world_fetch_failed");
    expect(parsed.httpStatus).toBe(500);
  });
});
