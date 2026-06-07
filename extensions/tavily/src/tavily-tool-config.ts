// Tavily helper module supports tavily tool config behavior.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import type { ACTAgentPluginToolContext } from "actagent/plugin-sdk/plugin-entry";
import type { ACTAgentPluginApi } from "actagent/plugin-sdk/plugin-runtime";

export type TavilyToolConfigContext = Pick<
  ACTAgentPluginToolContext,
  "config" | "runtimeConfig" | "getRuntimeConfig"
>;

export function resolveTavilyToolConfig(
  api: ACTAgentPluginApi,
  ctx?: TavilyToolConfigContext,
): ACTAgentConfig {
  return ctx?.getRuntimeConfig?.() ?? ctx?.runtimeConfig ?? ctx?.config ?? api.config;
}
