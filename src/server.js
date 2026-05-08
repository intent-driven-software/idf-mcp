/**
 * Создаёт MCP stdio-сервер поверх IDF agent-layer.
 *
 * Composition:
 *   bootstrap (опц.) → login → /api/agent/:domain/schema →
 *   ├── tools/list + tools/call   (handlers.js)
 *   └── resources/list + resources/read (handlers.js + visibleFields)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { buildInputSchema } from "./jsonSchema.js";
import { buildDescription } from "./descriptions.js";
import { agentLogin } from "./auth.js";
import { bootstrapOntology } from "./bootstrap.js";
import {
  makeToolCallHandler,
  makeResourceReadHandler,
  buildResourceList,
} from "./handlers.js";

const AGENT_ROLE = "agent";

export async function createIdfMcpServer({
  server: idfServer = "http://localhost:3001",
  domain = "booking",
  agentEmail = "mcp-agent@local",
  agentRole = null,
  agentScope = null,
  ontologyPath = null,
  doBootstrap = true,
  logger = () => {},
}) {
  // 1. Bootstrap ontology (optional).
  if (doBootstrap) {
    if (!ontologyPath) {
      throw new Error(
        "doBootstrap=true требует ontologyPath (или передайте doBootstrap=false)"
      );
    }
    try {
      await bootstrapOntology({ server: idfServer, domain, ontologyPath, logger });
    } catch (err) {
      logger(`bootstrap WARN: ${err.message}; пробуем продолжить — ontology, возможно, уже зарегистрирована`);
    }
  }

  // 2. Login → JWT. opts (role/scope) попадает в новый user.metadata —
  //    необходимо для доменов с custom-ролями (host fallback'ится на
  //    DEFAULT_ROLE='agent', но если такой роли нет в ontology — 400
  //    role_unknown). Existing user'ы (login OK) уже имеют metadata из БД.
  const opts = (agentRole || agentScope) ? {
    ...(agentRole ? { role: agentRole } : {}),
    ...(agentScope ? { scope: agentScope } : {}),
  } : null;
  const token = await agentLogin({
    server: idfServer,
    email: agentEmail,
    opts,
    logger,
  });

  // 3. Fetch agent schema (intents + visibleFields под role=agent).
  const schemaRes = await fetch(`${idfServer}/api/agent/${domain}/schema`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!schemaRes.ok) {
    throw new Error(`/api/agent/${domain}/schema: ${schemaRes.status} ${await schemaRes.text()}`);
  }
  const schema = await schemaRes.json();
  const { intents, ontology } = schema;
  const visibleFields = ontology?.entities
    ? Object.fromEntries(
        Object.entries(ontology.entities).map(([k, v]) => [k, v.fields || []])
      )
    : null;
  logger(`получено intent'ов: ${intents.length}, entities: ${Object.keys(visibleFields || {}).length}`);

  // 4. Fetch initial world snapshot (для resources/list).
  const worldRes = await fetch(`${idfServer}/api/agent/${domain}/world`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const worldSnapshot = worldRes.ok ? (await worldRes.json()).world : null;

  // 5. Prepare MCP primitives.
  const tools = intents.map(intent => ({
    name: intent.intentId,
    title: intent.name,
    description: buildDescription(intent),
    inputSchema: buildInputSchema(intent.parameters),
    annotations: {
      destructiveHint: intent.irreversibility === "high",
      readOnlyHint: false,
    },
  }));
  const resources = buildResourceList({ domain, visibleFields, worldSnapshot });

  const callTool = makeToolCallHandler({ server: idfServer, domain, token });
  const readResource = makeResourceReadHandler({ server: idfServer, domain, token });

  // 6. MCP Server wiring.
  const mcp = new Server(
    { name: `idf-${domain}`, version: "1.0.2" },
    { capabilities: { tools: {}, resources: {} } }
  );

  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const tool = tools.find(t => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "unknown_tool", name }) }],
        isError: true,
      };
    }
    return callTool(name, args);
  });
  mcp.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }));
  mcp.setRequestHandler(ReadResourceRequestSchema, async (req) => readResource(req.params.uri));

  logger(`зарегистрировано tools: ${tools.length}, resources: ${resources.length}`);

  return {
    mcp,
    tools,
    resources,
    /** Подключить к stdio (обычный путь для Claude Desktop). */
    async connectStdio() {
      const transport = new StdioServerTransport();
      await mcp.connect(transport);
      logger("stdio transport подключён; жду JSON-RPC на stdin");
    },
    /** Передать пользовательский transport (тесты / SSE в будущем). */
    async connect(transport) {
      await mcp.connect(transport);
    },
  };
}
