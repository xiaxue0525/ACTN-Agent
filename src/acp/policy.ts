/** Policy gates for ACP availability, dispatch, and allowed agent ids. */
import { AcpRuntimeError } from "@actagent/acp-core/runtime/errors";
import type { ACTAgentConfig } from "../config/types.actagent.js";
import { normalizeAgentId } from "../routing/session-key.js";

const ACP_DISABLED_MESSAGE = "ACP is disabled by policy (`acp.enabled=false`).";
const ACP_DISPATCH_DISABLED_MESSAGE =
  "ACP dispatch is disabled by policy (`acp.dispatch.enabled=false`).";

export type AcpDispatchPolicyState = "enabled" | "acp_disabled" | "dispatch_disabled";

/** Returns whether ACP is globally enabled by config policy. */
export function isAcpEnabledByPolicy(cfg: ACTAgentConfig): boolean {
  return cfg.acp?.enabled !== false;
}

/** Resolves the effective dispatch policy state for inbound ACP routing. */
export function resolveAcpDispatchPolicyState(cfg: ACTAgentConfig): AcpDispatchPolicyState {
  if (!isAcpEnabledByPolicy(cfg)) {
    return "acp_disabled";
  }
  // ACP dispatch is enabled unless explicitly disabled.
  if (cfg.acp?.dispatch?.enabled === false) {
    return "dispatch_disabled";
  }
  return "enabled";
}

/** Returns whether inbound ACP dispatch is currently allowed. */
export function isAcpDispatchEnabledByPolicy(cfg: ACTAgentConfig): boolean {
  return resolveAcpDispatchPolicyState(cfg) === "enabled";
}

/** Returns the operator-facing dispatch block message, if any. */
export function resolveAcpDispatchPolicyMessage(cfg: ACTAgentConfig): string | null {
  const state = resolveAcpDispatchPolicyState(cfg);
  if (state === "acp_disabled") {
    return ACP_DISABLED_MESSAGE;
  }
  if (state === "dispatch_disabled") {
    return ACP_DISPATCH_DISABLED_MESSAGE;
  }
  return null;
}

/** Returns the runtime error for dispatch-blocked ACP routing, if blocked. */
export function resolveAcpDispatchPolicyError(cfg: ACTAgentConfig): AcpRuntimeError | null {
  const message = resolveAcpDispatchPolicyMessage(cfg);
  if (!message) {
    return null;
  }
  return new AcpRuntimeError("ACP_DISPATCH_DISABLED", message);
}

/** Returns the runtime error for explicit ACP turns when ACP itself is disabled. */
export function resolveAcpExplicitTurnPolicyError(cfg: ACTAgentConfig): AcpRuntimeError | null {
  if (isAcpEnabledByPolicy(cfg)) {
    return null;
  }
  return new AcpRuntimeError("ACP_DISPATCH_DISABLED", ACP_DISABLED_MESSAGE);
}

/** Returns whether an agent id passes the optional ACP allowed-agent list. */
export function isAcpAgentAllowedByPolicy(cfg: ACTAgentConfig, agentId: string): boolean {
  const allowed = (cfg.acp?.allowedAgents ?? [])
    .map((entry) => normalizeAgentId(entry))
    .filter(Boolean);
  if (allowed.length === 0) {
    return true;
  }
  return allowed.includes(normalizeAgentId(agentId));
}

/** Returns the runtime error for agent-policy rejection, if rejected. */
export function resolveAcpAgentPolicyError(
  cfg: ACTAgentConfig,
  agentId: string,
): AcpRuntimeError | null {
  if (isAcpAgentAllowedByPolicy(cfg, agentId)) {
    return null;
  }
  return new AcpRuntimeError(
    "ACP_SESSION_INIT_FAILED",
    `ACP agent "${normalizeAgentId(agentId)}" is not allowed by policy.`,
  );
}
