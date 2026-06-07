// Slack API module exposes the plugin public contract.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: ACTAgentConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
