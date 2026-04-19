/**
 * Agent-login (идемпотентный) через /api/auth.
 *
 * Если login (email+password) возвращает 200 — использует его JWT.
 * Иначе register + login.
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

  const regRes = await fetch(`${server}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!regRes.ok) {
    const text = await regRes.text();
    throw new Error(`register failed: ${regRes.status} ${text}`);
  }
  const { token } = await regRes.json();
  logger(`registered + login OK: ${email}`);
  return token;
}
