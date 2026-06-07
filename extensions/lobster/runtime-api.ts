// Lobster API module exposes the plugin public contract.
export { definePluginEntry } from "actagent/plugin-sdk/core";
export type {
  AnyAgentTool,
  ACTAgentPluginApi,
  ACTAgentPluginToolContext,
  ACTAgentPluginToolFactory,
} from "actagent/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "actagent/plugin-sdk/windows-spawn";
