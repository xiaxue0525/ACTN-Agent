// Private runtime barrel for the bundled Nostr extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export { getPluginRuntimeGatewayRequestScope } from "actagent/plugin-sdk/plugin-runtime";
export type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";
