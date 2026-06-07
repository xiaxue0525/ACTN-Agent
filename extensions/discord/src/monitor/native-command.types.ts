// Discord type declarations define plugin contracts.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import type { CommandArgValues } from "actagent/plugin-sdk/native-command-registry";

export type DiscordConfig = NonNullable<ACTAgentConfig["channels"]>["discord"];

export type DiscordCommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};
