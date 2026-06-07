// Gateway model-pricing config helper.
// Resolves whether cost/pricing metadata should be available to Gateway surfaces.
import type { ACTAgentConfig } from "../config/types.actagent.js";

/** Returns whether gateway model pricing/cost metadata should be shown. */
export function isGatewayModelPricingEnabled(config: ACTAgentConfig): boolean {
  return config.models?.pricing?.enabled !== false;
}
