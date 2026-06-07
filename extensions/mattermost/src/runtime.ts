// Mattermost plugin module implements runtime behavior.
import { createPluginRuntimeStore } from "actagent/plugin-sdk/runtime-store";
import type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";

const { setRuntime: setMattermostRuntime, getRuntime: getMattermostRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "mattermost",
    errorMessage: "Mattermost runtime not initialized",
  });
export { getMattermostRuntime, setMattermostRuntime };
