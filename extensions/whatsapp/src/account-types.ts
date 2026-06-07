// Whatsapp plugin module implements account types behavior.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<ACTAgentConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
