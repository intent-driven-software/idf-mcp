/**
 * MCP request handlers поверх IDF agent-REST API.
 *
 * tools/call  → POST /api/agent/:domain/exec/:intentId
 * resources/* → GET  /api/agent/:domain/world (фильтруется по visibleFields)
 */

/**
 * Маршрутизация по intent.alpha:
 *   alpha=read → GET /api/agent/:domain/world + filter по intent.target.
 *                Mutation /exec для read-intent'ов в runtime-local v0.6 возвращает
 *                400 (read_intent_not_executable). Делаем GET явно: единый путь
 *                для host и runtime-local, snapshot из source-of-truth.
 *   add/replace/remove/batch → POST /api/agent/:domain/exec/:intentId — стандартный
 *                ingest пайплайн с invariants + lifecycle.requiresApproval.
 *
 * @param {Object} opts
 * @param {Object<string, {alpha?:string, target?:string}>} [opts.intentsById]
 *   Map intentId → intent. Если intent не найден — fallback на mutation-path.
 */
export function makeToolCallHandler({ server, domain, token, intentsById = {} }) {
  return async (intentId, args) => {
    const intent = intentsById[intentId];
    if (intent && intent.alpha === "read") {
      return await readViaWorld({ server, domain, token, intent: { ...intent, intentId } });
    }
    const res = await fetch(`${server}/api/agent/${domain}/exec/${intentId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args || {}),
    });
    const payload = await res.json();
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
        text: JSON.stringify({
          status: payload.status || "error",
          error: payload.error,
          reason: payload.reason || payload.message,
          failedCondition: payload.failedCondition,
          issues: payload.issues,
        }, null, 2),
      }],
      isError: true,
    };
  };
}

async function readViaWorld({ server, domain, token, intent }) {
  const res = await fetch(`${server}/api/agent/${domain}/world`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "error",
          error: "world_fetch_failed",
          httpStatus: res.status,
        }, null, 2),
      }],
      isError: true,
    };
  }
  const { world } = await res.json();
  const worldKeys = Object.keys(world || {});
  const targetEntity = (intent.target || "").split(".")[0];
  const collection = toCollectionName(targetEntity, worldKeys);
  const rows = world?.[collection] || [];
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        status: "confirmed",
        intent: { intentId: intent.intentId, target: intent.target, alpha: "read" },
        collection,
        count: rows.length,
        rows,
      }, null, 2),
    }],
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
