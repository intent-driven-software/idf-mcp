import { describe, it, expect } from "vitest";
import { idfParamToJsonSchema, buildInputSchema } from "../src/jsonSchema.js";

describe("idfParamToJsonSchema", () => {
  it("text → string", () => {
    expect(idfParamToJsonSchema({ name: "title", type: "text" })).toEqual({
      type: "string",
      description: "title",
    });
  });

  it("textarea → string", () => {
    expect(idfParamToJsonSchema({ name: "body", type: "textarea" }).type).toBe("string");
  });

  it("number → number", () => {
    expect(idfParamToJsonSchema({ name: "price", type: "number" })).toEqual({
      type: "number",
      description: "price",
    });
  });

  it("boolean → boolean", () => {
    expect(idfParamToJsonSchema({ name: "active", type: "boolean" }).type).toBe("boolean");
  });

  it("datetime → string + date-time format", () => {
    const s = idfParamToJsonSchema({ name: "startTime", type: "datetime" });
    expect(s.type).toBe("string");
    expect(s.format).toBe("date-time");
  });

  it("email → string + email format", () => {
    const s = idfParamToJsonSchema({ name: "email", type: "email" });
    expect(s.type).toBe("string");
    expect(s.format).toBe("email");
  });

  it("entityRef → string + FK-description", () => {
    const s = idfParamToJsonSchema({
      name: "specialistId",
      type: "entityRef",
      entity: "Specialist",
    });
    expect(s.type).toBe("string");
    expect(s.description).toBe("specialistId — FK to Specialist");
  });

  it("id → string", () => {
    expect(idfParamToJsonSchema({ name: "id", type: "id" }).type).toBe("string");
  });

  it("placeholder становится description если нет entity", () => {
    const s = idfParamToJsonSchema({
      name: "rating",
      type: "number",
      placeholder: "Оценка 1-5",
    });
    expect(s.description).toBe("Оценка 1-5");
  });

  it("неизвестный type fallback → string", () => {
    expect(idfParamToJsonSchema({ name: "x", type: "hieroglyph" }).type).toBe("string");
  });
});

describe("buildInputSchema", () => {
  it("пустые параметры → valid empty object", () => {
    const s = buildInputSchema([]);
    expect(s).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
  });

  it("required попадают в required, остальные — нет", () => {
    const s = buildInputSchema([
      { name: "rating", type: "number", required: true },
      { name: "text", type: "textarea", required: false },
    ]);
    expect(s.required).toEqual(["rating"]);
    expect(s.properties.rating.type).toBe("number");
    expect(s.properties.text.type).toBe("string");
  });

  it("additionalProperties всегда false (strict)", () => {
    const s = buildInputSchema([{ name: "x", type: "text", required: true }]);
    expect(s.additionalProperties).toBe(false);
  });

  it("смешанные типы (реальный create_booking)", () => {
    const s = buildInputSchema([
      { name: "specialistId", type: "entityRef", entity: "Specialist", required: true },
      { name: "serviceId", type: "entityRef", entity: "Service", required: true },
      { name: "date", type: "datetime", required: true },
      { name: "price", type: "number", required: true },
    ]);
    expect(s.required).toEqual(["specialistId", "serviceId", "date", "price"]);
    expect(s.properties.specialistId.description).toBe("specialistId — FK to Specialist");
    expect(s.properties.date.format).toBe("date-time");
    expect(s.properties.price.type).toBe("number");
  });

  it("nullable/undefined parameters → не падает", () => {
    expect(buildInputSchema(null)).toMatchObject({ type: "object", properties: {} });
    expect(buildInputSchema(undefined)).toMatchObject({ type: "object", properties: {} });
  });
});
