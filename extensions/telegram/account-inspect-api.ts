// Telegram API module exposes the plugin public contract.
import type { ACTAgentConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: ACTAgentConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
