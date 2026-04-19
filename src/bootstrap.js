/**
 * Регистрирует ontology + intents домена на IDF server через
 * /api/typemap и /api/intents. Прототип в браузере делает то же самое
 * при старте (src/runtime/DomainRuntime.jsx).
 *
 * Работает, если домен живёт в локальной FS с структурой
 *   <ontologyPath>/ontology.js — export ONTOLOGY
 *   <ontologyPath>/intents.js  — export INTENTS
 *
 * Для SaaS-варианта (ontology из БД / удалённого API) это заменит
 * следующая ревизия.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

export async function bootstrapOntology({
  server,
  domain,
  ontologyPath,
  logger = () => {},
}) {
  const abs = path.resolve(ontologyPath);
  const ontologyMod = await import(pathToFileURL(path.join(abs, "ontology.js")).href);
  const intentsMod = await import(pathToFileURL(path.join(abs, "intents.js")).href);

  const ONTOLOGY = ontologyMod.ONTOLOGY || ontologyMod.default;
  const INTENTS = intentsMod.INTENTS || intentsMod.default;

  if (!ONTOLOGY) throw new Error(`Не найден export ONTOLOGY в ${abs}/ontology.js`);
  if (!INTENTS) throw new Error(`Не найден export INTENTS в ${abs}/intents.js`);

  const typemapRes = await fetch(`${server}/api/typemap?domain=${domain}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ONTOLOGY),
  });
  if (!typemapRes.ok) {
    throw new Error(`/api/typemap вернул ${typemapRes.status}`);
  }

  const intentsRes = await fetch(`${server}/api/intents?domain=${domain}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(INTENTS),
  });
  if (!intentsRes.ok) {
    throw new Error(`/api/intents вернул ${intentsRes.status}`);
  }

  const entityCount = Object.keys(ONTOLOGY.entities || {}).length;
  const intentCount = Object.keys(INTENTS).length;
  logger(`bootstrap OK: ${domain} — ${entityCount} entities, ${intentCount} intents`);

  return { ontology: ONTOLOGY, intents: INTENTS };
}
