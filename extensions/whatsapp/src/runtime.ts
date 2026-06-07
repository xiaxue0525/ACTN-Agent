// Whatsapp plugin module implements runtime behavior.
import type { PluginRuntime } from "actagent/plugin-sdk/core";
import { createPluginRuntimeStore } from "actagent/plugin-sdk/runtime-store";

const {
  setRuntime: setWhatsAppRuntime,
  getRuntime: getWhatsAppRuntime,
  tryGetRuntime: getOptionalWhatsAppRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "whatsapp",
  errorMessage: "WhatsApp runtime not initialized",
});
export { getOptionalWhatsAppRuntime, getWhatsAppRuntime, setWhatsAppRuntime };
