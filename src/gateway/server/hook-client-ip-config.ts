// Hook client-IP config adapts gateway trusted-proxy settings for hook request handling.
import type { ACTAgentConfig } from "../../config/types.actagent.js";
import type { HookClientIpConfig } from "./hooks-request-handler.js";

/**
 * Adapts gateway network trust config to the hooks HTTP request handler.
 */
export function resolveHookClientIpConfig(cfg: ACTAgentConfig): HookClientIpConfig {
  return {
    trustedProxies: cfg.gateway?.trustedProxies,
    allowRealIpFallback: cfg.gateway?.allowRealIpFallback === true,
  };
}
