/**
 * Agent-login (идемпотентный) через /api/auth.
 *
 * Если login (email+password) возвращает 200 — использует его JWT.
 * Иначе register + login.
 *
 * opts (optional) пробрасывается в register для домен-специфичных ролей
 * и scope: { role: "staging-agent", scope: { environment: "staging" } }.
 * Без opts host runtime fall'ит на DEFAULT_ROLE='agent', что НЕ работает
 * для доменов, где такой роли нет (e.g. infra с staging-agent/infra-operator
 * — host вернёт 400 role_unknown).
 *
 * Будущие версии: PAT (personal access token) через `IDF_API_KEY`.
 */

const DEFAULT_PASSWORD = "mcp-agent-password-v1";
const DEFAULT_NAME = "mcp-agent";

export async function agentLogin({
  server,
  email,
  password = DEFAULT_PASSWORD,
  name = DEFAULT_NAME,
  opts = null,
  logger = () => {},
}) {
  const loginRes = await fetch(`${server}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (loginRes.ok) {
    const { token } = await loginRes.json();
    logger(`login OK: ${email}`);
    return token;
  }

  const body = { email, password, name };
  if (opts && (opts.role || opts.scope)) body.opts = opts;
  const regRes = await fetch(`${server}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!regRes.ok) {
    const text = await regRes.text();
    throw new Error(`register failed: ${regRes.status} ${text}`);
  }
  const { token } = await regRes.json();
  const roleNote = opts?.role ? ` role=${opts.role}` : "";
  const scopeNote = opts?.scope ? ` scope=${JSON.stringify(opts.scope)}` : "";
  logger(`registered + login OK: ${email}${roleNote}${scopeNote}`);
  return token;
}
