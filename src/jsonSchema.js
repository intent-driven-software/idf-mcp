/**
 * Конверсия IDF параметров в JSON Schema.
 *
 * IDF server-oriented types (server/schema/inferControlType.cjs):
 *   entityRef | id | text | textarea | select | number | boolean | datetime | email
 *
 * Все строковые типы схлопываются в `type: "string"`; datetime/email получают
 * format; entityRef пишет FK в description.
 */

export function idfParamToJsonSchema(param) {
  const prop = {};
  switch (param.type) {
    case "number":
      prop.type = "number";
      break;
    case "boolean":
      prop.type = "boolean";
      break;
    case "datetime":
      prop.type = "string";
      prop.format = "date-time";
      break;
    case "email":
      prop.type = "string";
      prop.format = "email";
      break;
    case "id":
    case "entityRef":
    case "text":
    case "textarea":
    case "select":
    default:
      prop.type = "string";
      break;
  }
  if (param.entity) {
    prop.description = `${param.name} — FK to ${param.entity}`;
  } else if (param.placeholder) {
    prop.description = param.placeholder;
  } else {
    prop.description = param.name;
  }
  return prop;
}

export function buildInputSchema(parameters) {
  const properties = {};
  const required = [];
  for (const p of parameters || []) {
    properties[p.name] = idfParamToJsonSchema(p);
    if (p.required) required.push(p.name);
  }
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}
