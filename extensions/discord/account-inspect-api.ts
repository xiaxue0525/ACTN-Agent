// Discord API module exposes the plugin public contract.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: ACTAgentConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
