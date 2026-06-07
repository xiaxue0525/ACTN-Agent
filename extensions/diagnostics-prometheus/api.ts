// Diagnostics Prometheus API module exposes the plugin public contract.
export type {
  DiagnosticEventMetadata,
  DiagnosticEventPayload,
} from "actagent/plugin-sdk/diagnostic-runtime";
export { isInternalDiagnosticEventMetadata } from "actagent/plugin-sdk/diagnostic-runtime";
export {
  emptyPluginConfigSchema,
  type ACTAgentPluginApi,
  type ACTAgentPluginHttpRouteHandler,
  type ACTAgentPluginService,
  type ACTAgentPluginServiceContext,
} from "actagent/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "actagent/plugin-sdk/security-runtime";
