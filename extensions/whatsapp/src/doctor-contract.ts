// Whatsapp plugin module implements doctor contract behavior.
import type { ChannelDoctorConfigMutation } from "actagent/plugin-sdk/channel-contract";
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: ACTAgentConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
