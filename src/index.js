/**
 * Публичный API пакета @intent-driven/mcp-server.
 *
 * Главный фабричный метод — createIdfMcpServer; pure-утилиты доступны
 * отдельно для тестов и ре-юза.
 */

export { createIdfMcpServer } from "./server.js";
export { buildInputSchema, idfParamToJsonSchema } from "./jsonSchema.js";
export { buildDescription, conditionsToText } from "./descriptions.js";
export { agentLogin } from "./auth.js";
export { bootstrapOntology } from "./bootstrap.js";
export {
  makeToolCallHandler,
  makeResourceReadHandler,
  buildResourceList,
} from "./handlers.js";
