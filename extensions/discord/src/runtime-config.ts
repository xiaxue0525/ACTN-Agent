// Discord helper module supports runtime config behavior.
import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
  selectApplicableRuntimeConfig,
} from "actagent/plugin-sdk/runtime-config-snapshot";
import type { ACTAgentConfig } from "./runtime-api.js";

export function selectDiscordRuntimeConfig(inputConfig: ACTAgentConfig): ACTAgentConfig {
  return (
    selectApplicableRuntimeConfig({
      inputConfig,
      runtimeConfig: getRuntimeConfigSnapshot(),
      runtimeSourceConfig: getRuntimeConfigSourceSnapshot(),
    }) ?? inputConfig
  );
}
