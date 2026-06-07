// Signal plugin module implements account types behavior.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<ACTAgentConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
