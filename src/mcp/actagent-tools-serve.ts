/**
 * Standalone MCP server for selected built-in ACTAgent tools.
 *
 * Run via: node --import tsx src/mcp/actagent-tools-serve.ts
 * Or: bun src/mcp/actagent-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveACTAgentToolsForMcp(): AnyAgentTool[] {
  return [createCronTool()];
}

function createACTAgentToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveACTAgentToolsForMcp();
  return createToolsMcpServer({ name: "actagent-tools", tools });
}

async function serveACTAgentToolsMcp(): Promise<void> {
  const server = createACTAgentToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveACTAgentToolsMcp().catch((err: unknown) => {
    process.stderr.write(`actagent-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
