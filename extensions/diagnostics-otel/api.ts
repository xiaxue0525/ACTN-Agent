// Diagnostics Otel API module exposes the plugin public contract.
export {
  createChildDiagnosticTraceContext,
  createDiagnosticTraceContext,
  emitDiagnosticEvent,
  formatDiagnosticTraceparent,
  isValidDiagnosticSpanId,
  isValidDiagnosticTraceFlags,
  isValidDiagnosticTraceId,
  onDiagnosticEvent,
  parseDiagnosticTraceparent,
  type DiagnosticEventMetadata,
  type DiagnosticEventPayload,
  type DiagnosticTraceContext,
} from "actagent/plugin-sdk/diagnostic-runtime";
export { emptyPluginConfigSchema, type ACTAgentPluginApi } from "actagent/plugin-sdk/plugin-entry";
export type {
  ACTAgentPluginService,
  ACTAgentPluginServiceContext,
} from "actagent/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "actagent/plugin-sdk/security-runtime";
