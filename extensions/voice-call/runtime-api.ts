// Private runtime barrel for the bundled Voice Call extension.
// Keep this barrel thin and aligned with the local extension surface.

export { definePluginEntry } from "actagent/plugin-sdk/plugin-entry";
export type { ACTAgentPluginApi } from "actagent/plugin-sdk/plugin-entry";
export type { GatewayRequestHandlerOptions } from "actagent/plugin-sdk/gateway-runtime";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "actagent/plugin-sdk/webhook-request-guards";
export { fetchWithSsrFGuard, isBlockedHostnameOrIp } from "actagent/plugin-sdk/ssrf-runtime";
export type { SessionEntry } from "actagent/plugin-sdk/session-store-runtime";
export {
  TtsAutoSchema,
  TtsConfigSchema,
  TtsModeSchema,
  TtsProviderSchema,
} from "actagent/plugin-sdk/tts-runtime";
export { sleep } from "actagent/plugin-sdk/runtime-env";
