// ACTAgent MCP tools tests cover core tool server startup and registration.
import { describe, expect, it } from "vitest";
import { resolveACTAgentToolsForMcp } from "./actagent-tools-serve.js";
import { createPluginToolsMcpHandlers } from "./plugin-tools-handlers.js";

describe("ACTAgent tools MCP server", () => {
  it("exposes cron", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveACTAgentToolsForMcp());

    const listed = await handlers.listTools();
    expect(listed.tools.map((tool) => tool.name)).toContain("cron");
  });
});
