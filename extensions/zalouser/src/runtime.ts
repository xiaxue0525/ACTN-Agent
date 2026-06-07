// Zalouser plugin module implements runtime behavior.
import type { PluginRuntime } from "actagent/plugin-sdk/core";
import { createPluginRuntimeStore } from "actagent/plugin-sdk/runtime-store";

const { setRuntime: setZalouserRuntime, getRuntime: getZalouserRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "zalouser",
    errorMessage: "Zalouser runtime not initialized",
  });
export { getZalouserRuntime, setZalouserRuntime };
