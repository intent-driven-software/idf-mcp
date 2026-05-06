#!/usr/bin/env bash
# Glama-deployed container entrypoint:
#   1. Spawn IDF host (Express :3001) in background
#   2. Wait up to 30s for /api/effects healthcheck
#   3. Bootstrap the `invest` demo domain (typemap + intents)
#   4. Exec mcp-idf — stdio MCP server, foreground; this is the
#      process Glama Inspector / "Try in Browser" sends MCP requests
#      to (initialize, tools/list, tools/call).
#
# stderr — host log + bootstrap chatter.
# stdout — strictly MCP wire-protocol from mcp-idf (do not pollute).

set -euo pipefail

PORT="${PORT:-3001}"
BOOT_TIMEOUT="${HOST_BOOT_TIMEOUT_SECS:-30}"
DOMAIN="${BOOTSTRAP_DOMAIN:-invest}"
LOG_FILE="/tmp/idf-host.log"

echo "[glama] starting IDF host on :${PORT}" >&2
cd /opt/idf
PORT="${PORT}" npm run server > "${LOG_FILE}" 2>&1 &
HOST_PID=$!

shutdown() {
  echo "[glama] stopping host (PID ${HOST_PID})" >&2
  kill -TERM "${HOST_PID}" 2>/dev/null || true
  wait "${HOST_PID}" 2>/dev/null || true
  exit 0
}
trap shutdown SIGTERM SIGINT

echo "[glama] waiting for host (up to ${BOOT_TIMEOUT}s)…" >&2
for ((i = 0; i < BOOT_TIMEOUT; i++)); do
  if curl -fsS "http://localhost:${PORT}/api/effects" > /dev/null 2>&1; then
    echo "[glama] host ready after ${i}s" >&2
    break
  fi
  if ! kill -0 "${HOST_PID}" 2>/dev/null; then
    echo "[glama] FATAL — host died before ready" >&2
    tail -n 30 "${LOG_FILE}" >&2 || true
    exit 1
  fi
  sleep 1
done

if ! curl -fsS "http://localhost:${PORT}/api/effects" > /dev/null 2>&1; then
  echo "[glama] FATAL — host not ready in ${BOOT_TIMEOUT}s" >&2
  tail -n 30 "${LOG_FILE}" >&2 || true
  exit 1
fi

echo "[glama] bootstrapping domain '${DOMAIN}'…" >&2
node - "${PORT}" "${DOMAIN}" >&2 <<'NODE_BOOT'
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , port, domain] = process.argv;
const SERVER = `http://localhost:${port}`;
const root = `/opt/idf/src/domains/${domain}`;

const { ONTOLOGY } = await import(pathToFileURL(path.join(root, "ontology.js")).href);
const { INTENTS  } = await import(pathToFileURL(path.join(root, "intents.js")).href);

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`POST ${url} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

await post(`${SERVER}/api/typemap?domain=${domain}`, ONTOLOGY);
await post(`${SERVER}/api/intents?domain=${domain}`, INTENTS);
console.log(`[glama] ✓ domain='${domain}' bootstrapped`);
NODE_BOOT

echo "[glama] handing off to mcp-idf (stdio MCP server)" >&2
export IDF_SERVER="http://localhost:${PORT}"
export IDF_DOMAIN="${DOMAIN}"
export IDF_BOOTSTRAP=0
exec mcp-idf
