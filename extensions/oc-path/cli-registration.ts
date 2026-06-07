// OC Path module implements cli registration behavior.
import type { ACTAgentPluginApi } from "actagent/plugin-sdk/plugin-entry";

export function registerOcPathCli(api: ACTAgentPluginApi): void {
  api.registerCli(
    async ({ program }) => {
      const { registerPathCli } = await import("./src/cli.js");
      registerPathCli(program);
    },
    {
      descriptors: [
        {
          name: "path",
          description: "Inspect and edit workspace files via oc:// paths",
          hasSubcommands: true,
        },
      ],
    },
  );
}
