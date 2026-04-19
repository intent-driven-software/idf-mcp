#!/usr/bin/env node
/**
 * CLI entry для @intent-driven/mcp-server.
 *
 * Все опции можно передать либо через флаг, либо через env:
 *   --domain            IDF_DOMAIN            (default: "booking")
 *   --server            IDF_SERVER            (default: "http://localhost:3001")
 *   --ontology-path     IDF_ONTOLOGY_PATH     (default: ./src/domains/<domain>)
 *   --agent-email       IDF_AGENT_EMAIL       (default: "mcp-agent@local")
 *   --no-bootstrap      IDF_BOOTSTRAP=0       (default: bootstrap включён)
 *   --help
 *
 * Диагностика — в stderr (stdout зарезервирован под JSON-RPC).
 */

import path from "node:path";
import { createIdfMcpServer } from "../src/index.js";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a === "--no-bootstrap") {
      out.noBootstrap = true;
    } else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const key = eq > -1 ? a.slice(2, eq) : a.slice(2);
      const val = eq > -1 ? a.slice(eq + 1) : argv[++i];
      out[key] = val;
    }
  }
  return out;
}

function printHelp() {
  process.stderr.write(`\
mcp-idf — MCP stdio-сервер поверх IDF agent-layer

Usage:
  mcp-idf [--domain=<name>] [--server=<url>] [--ontology-path=<path>]
          [--agent-email=<email>] [--no-bootstrap]

Env:
  IDF_DOMAIN, IDF_SERVER, IDF_ONTOLOGY_PATH, IDF_AGENT_EMAIL, IDF_BOOTSTRAP

Examples:
  mcp-idf --domain=booking
  mcp-idf --domain=freelance --server=http://localhost:3001
  IDF_DOMAIN=invest mcp-idf
  mcp-idf --no-bootstrap   # ontology уже зарегистрирована другим клиентом
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const domain = args.domain || process.env.IDF_DOMAIN || "booking";
  const server = args.server || process.env.IDF_SERVER || "http://localhost:3001";
  const agentEmail = args["agent-email"] || process.env.IDF_AGENT_EMAIL || "mcp-agent@local";
  const envBootstrap = process.env.IDF_BOOTSTRAP;
  const doBootstrap = args.noBootstrap
    ? false
    : envBootstrap === "0" || envBootstrap === "false"
    ? false
    : true;

  const defaultOntology = path.resolve(process.cwd(), `src/domains/${domain}`);
  const ontologyPath = args["ontology-path"] || process.env.IDF_ONTOLOGY_PATH || defaultOntology;

  const log = (...xs) => console.error("[mcp-idf]", ...xs);
  log(`starting; server=${server} domain=${domain} bootstrap=${doBootstrap}`);

  const { connectStdio } = await createIdfMcpServer({
    server,
    domain,
    agentEmail,
    ontologyPath,
    doBootstrap,
    logger: log,
  });
  await connectStdio();
}

main().catch(err => {
  console.error("[mcp-idf] FATAL:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
