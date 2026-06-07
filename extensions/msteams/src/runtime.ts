// Msteams plugin module implements runtime behavior.
import { createPluginRuntimeStore } from "actagent/plugin-sdk/runtime-store";
import type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";

const {
  setRuntime: setMSTeamsRuntime,
  getRuntime: getMSTeamsRuntime,
  tryGetRuntime: getOptionalMSTeamsRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "msteams",
  errorMessage: "MSTeams runtime not initialized",
});
export { getMSTeamsRuntime, getOptionalMSTeamsRuntime, setMSTeamsRuntime };
