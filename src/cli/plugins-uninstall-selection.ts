// Plugin uninstall id resolver for registry ids, display names, npm specs, and ACTAgentHub specs.
import type { ACTAgentConfig } from "../config/types.actagent.js";
import { parseACTAgentHubPluginSpec } from "../infra/actagenthub-spec.js";
import type { PluginRecord } from "../plugins/registry.js";

/** Resolve user input to the plugin id that should be removed from config/install records. */
export function resolvePluginUninstallId<
  TPlugin extends Pick<PluginRecord, "id" | "name">,
>(params: {
  rawId: string;
  config: ACTAgentConfig;
  plugins: TPlugin[];
}): { pluginId: string; plugin?: TPlugin } {
  const rawId = params.rawId.trim();
  const plugin = params.plugins.find((entry) => entry.id === rawId || entry.name === rawId);
  if (plugin) {
    return { pluginId: plugin.id, plugin };
  }

  for (const [pluginId, install] of Object.entries(params.config.plugins?.installs ?? {})) {
    if (
      install.spec === rawId ||
      install.resolvedSpec === rawId ||
      install.resolvedName === rawId ||
      install.marketplacePlugin === rawId
    ) {
      return { pluginId };
    }
  }

  const requestedACTAgentHub = parseACTAgentHubPluginSpec(rawId);
  if (requestedACTAgentHub) {
    for (const [pluginId, install] of Object.entries(params.config.plugins?.installs ?? {})) {
      const installedACTAgentHubName =
        install.actagenthubPackage ??
        parseACTAgentHubPluginSpec(install.spec ?? "")?.name ??
        parseACTAgentHubPluginSpec(install.resolvedSpec ?? "")?.name;
      if (installedACTAgentHubName === requestedACTAgentHub.name) {
        return { pluginId };
      }
    }
  }

  return { pluginId: rawId };
}
