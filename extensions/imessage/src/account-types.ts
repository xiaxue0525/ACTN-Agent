// Imessage plugin module implements account types behavior.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<ACTAgentConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
