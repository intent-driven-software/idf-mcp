/**
 * MCP request handlers поверх IDF agent-REST API.
 *
 * tools/call  → POST /api/agent/:domain/exec/:intentId
 * resources/* → GET  /api/agent/:domain/world (фильтруется по visibleFields)
 */

export function makeToolCallHandler({ server, domain, token }) {
  return async (intentId, args) => {
    const res = await fetch(`${server}/api/agent/${domain}/exec/${intentId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args || {}),
    });
    const payload = await res.json();
    // Pass-through всего payload'а: agent route возвращает разные shape для
    // обычных intents (effectId, effects, createdEntity), для lifecycle
    // intents (approvalRequestId, expiresAt, fromRole), и для approval-action
    // (status='approved', approvedBy, approvedAt, appliedEffects).
    // Фильтрация subset'а ломала MCP-flow для approval lifecycle.
    if (res.ok) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify(payload, null, 2),
        }],
      };
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify(payload, null, 2),
      }],
      isError: true,
    };
  };
}

const COLLECTION_MIMETYPE = "application/json";

/**
 * Простая английская плюрализация с учётом нескольких правил:
 *   ends "y" preceded by consonant → y→ies   (Category → categories)
 *   ends "s"/"x"/"z"/"ch"/"sh"     → +es     (Address → addresses)
 *   иначе                          → +s      (Booking → bookings)
 */
function pluralize(singular) {
  if (/[^aeiou]y$/.test(singular)) return singular.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/.test(singular)) return singular + "es";
  return singular + "s";
}

/**
 * Превращает имя entity ("Booking") в collection-name ("bookings") по тем
 * же правилам, что серверный typemap. Для irregular-plurals (TimeSlot →
 * timeSlots, Category → categories) опираемся на worldKeys из /world —
 * server-side plural это source of truth.
 */
function toCollectionName(entityName, worldKeys) {
  const lower = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const pluralGuess = pluralize(lower);
  // 1. Точное совпадение plural-формы в /world.
  if (worldKeys.includes(pluralGuess)) return pluralGuess;
  // 2. Singular-форма в /world (редкий случай).
  if (worldKeys.includes(lower)) return lower;
  // 3. Fuzzy: ключ в /world, чья lower-форма начинается с первых
  //    (len-1) символов (справляется с `category` → `categories`).
  const prefix = lower.length > 3 ? lower.slice(0, lower.length - 1) : lower;
  const match = worldKeys.find(k => k.toLowerCase().startsWith(prefix));
  return match || pluralGuess;
}

/**
 * Описание полей в зависимости от формы visibleFields.
 *
 * IDF допускает несколько форматов в `role.visibleFields[entityName]`:
 *   Array  — явный whitelist полей: ["id","name","email"]
 *   "own"  — все поля, viewer-scoped (single-owner)
 *   "all"  — все поля, без фильтра
 *   "aggregated" — агрегаты, row-level read недоступен
 *   объект — composite shape (расширения)
 */
function describeFields(spec) {
  if (Array.isArray(spec)) return `поля: ${spec.join(", ")}`;
  if (typeof spec === "string") return `scope: ${spec}`;
  if (spec && typeof spec === "object") return `shape: ${Object.keys(spec).join(", ")}`;
  return "shape: unknown";
}

export function buildResourceList({ domain, visibleFields, worldSnapshot }) {
  if (!visibleFields) return [];
  const worldKeys = Object.keys(worldSnapshot || {});
  const resources = [];
  for (const entityName of Object.keys(visibleFields)) {
    const collection = toCollectionName(entityName, worldKeys);
    resources.push({
      uri: `idf://${domain}/${collection}`,
      name: collection,
      title: `${entityName} (${domain})`,
      description: `Filtered collection of ${entityName} — ${describeFields(visibleFields[entityName])}`,
      mimeType: COLLECTION_MIMETYPE,
    });
  }
  return resources;
}

export function makeResourceReadHandler({ server, domain, token }) {
  return async (uri) => {
    // URI: idf://<domain>/<collection>
    const prefix = `idf://${domain}/`;
    if (!uri.startsWith(prefix)) {
      throw new Error(`unknown resource uri: ${uri}`);
    }
    const collection = uri.slice(prefix.length);
    const res = await fetch(`${server}/api/agent/${domain}/world`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`/world ${res.status}: ${await res.text()}`);
    }
    const { world } = await res.json();
    const rows = world?.[collection] || [];
    return {
      contents: [{
        uri,
        mimeType: COLLECTION_MIMETYPE,
        text: JSON.stringify(rows, null, 2),
      }],
    };
  };
}
