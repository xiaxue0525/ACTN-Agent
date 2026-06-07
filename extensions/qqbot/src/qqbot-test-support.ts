// Qqbot plugin module implements qqbot test support behavior.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";

export function makeQqbotSecretRefConfig(): ACTAgentConfig {
  return {
    channels: {
      qqbot: {
        appId: "123456",
        clientSecret: {
          source: "env",
          provider: "default",
          id: "QQBOT_CLIENT_SECRET",
        },
      },
    },
  } as ACTAgentConfig;
}

export function makeQqbotDefaultAccountConfig(): ACTAgentConfig {
  return {
    channels: {
      qqbot: {
        defaultAccount: "bot2",
        accounts: {
          bot2: { appId: "123456" },
        },
      },
    },
  } as ACTAgentConfig;
}
