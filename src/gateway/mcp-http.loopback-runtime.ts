// Process-local MCP loopback runtime state for owner/non-owner HTTP access.
type McpLoopbackRuntime = {
  port: number;
  ownerToken: string;
  nonOwnerToken: string;
};

let activeRuntime: McpLoopbackRuntime | undefined;

/** Return a copy of the active loopback runtime, if one has been installed. */
export function getActiveMcpLoopbackRuntime(): McpLoopbackRuntime | undefined {
  return activeRuntime ? { ...activeRuntime } : undefined;
}

/** Install the active loopback runtime used by in-process MCP callers. */
export function setActiveMcpLoopbackRuntime(runtime: McpLoopbackRuntime): void {
  activeRuntime = { ...runtime };
}

/** Choose the bearer token matching owner/non-owner caller identity. */
export function resolveMcpLoopbackBearerToken(
  runtime: McpLoopbackRuntime,
  senderIsOwner: boolean,
): string {
  return senderIsOwner ? runtime.ownerToken : runtime.nonOwnerToken;
}

/** Clear loopback runtime only when the owning token matches the active runtime. */
export function clearActiveMcpLoopbackRuntimeByOwnerToken(ownerToken: string): void {
  if (activeRuntime?.ownerToken === ownerToken) {
    activeRuntime = undefined;
  }
}

/** Build the MCP server config injected into agents for loopback tool access. */
export function createMcpLoopbackServerConfig(port: number) {
  return {
    mcpServers: {
      actagent: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {
          Authorization: "Bearer ${ACTAGENT_MCP_TOKEN}",
          "x-session-key": "${ACTAGENT_MCP_SESSION_KEY}",
          "x-actagent-agent-id": "${ACTAGENT_MCP_AGENT_ID}",
          "x-actagent-account-id": "${ACTAGENT_MCP_ACCOUNT_ID}",
          "x-actagent-message-channel": "${ACTAGENT_MCP_MESSAGE_CHANNEL}",
          "x-actagent-current-channel-id": "${ACTAGENT_MCP_CURRENT_CHANNEL_ID}",
          "x-actagent-current-thread-ts": "${ACTAGENT_MCP_CURRENT_THREAD_TS}",
          "x-actagent-current-message-id": "${ACTAGENT_MCP_CURRENT_MESSAGE_ID}",
          "x-actagent-current-inbound-audio": "${ACTAGENT_MCP_CURRENT_INBOUND_AUDIO}",
          "x-actagent-inbound-event-kind": "${ACTAGENT_MCP_INBOUND_EVENT_KIND}",
          "x-actagent-source-reply-delivery-mode": "${ACTAGENT_MCP_SOURCE_REPLY_DELIVERY_MODE}",
        },
      },
    },
  };
}
