// Diffs API module exposes the plugin public contract.
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export {
  definePluginEntry,
  type AnyAgentTool,
  type ACTAgentPluginApi,
  type ACTAgentPluginConfigSchema,
  type ACTAgentPluginToolContext,
  type PluginLogger,
} from "actagent/plugin-sdk/plugin-entry";
export { resolvePreferredACTAgentTmpDir } from "actagent/plugin-sdk/temp-path";
