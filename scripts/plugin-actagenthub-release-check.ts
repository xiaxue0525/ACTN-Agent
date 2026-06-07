#!/usr/bin/env -S node --import tsx
// Plugin ACTAgentHub Release Check script supports ACTAgent repository automation.

import { pathToFileURL } from "node:url";
import {
  collectACTAgentHubPublishablePluginPackages,
  collectACTAgentHubVersionGateErrors,
  parsePluginReleaseArgs,
  resolveSelectedACTAgentHubPublishablePluginPackages,
} from "./lib/plugin-actagenthub-release.ts";

export async function runPluginACTAgentHubReleaseCheck(argv: string[]) {
  const { selection, selectionMode, baseRef, headRef } = parsePluginReleaseArgs(argv);
  const publishable = collectACTAgentHubPublishablePluginPackages(".", {
    packageNames:
      selectionMode === "all-publishable" || selection.length === 0 ? undefined : selection,
  });
  const gitRange = baseRef && headRef ? { baseRef, headRef } : undefined;
  const selected = resolveSelectedACTAgentHubPublishablePluginPackages({
    plugins: publishable,
    selection,
    selectionMode,
    gitRange,
  });

  if (gitRange) {
    const errors = collectACTAgentHubVersionGateErrors({
      plugins: publishable,
      gitRange,
    });
    if (errors.length > 0) {
      throw new Error(
        `plugin-actagenthub-release-check: version bumps required before ACTAgentHub publish:\n${errors
          .map((error) => `  - ${error}`)
          .join("\n")}`,
      );
    }
  }

  console.log("plugin-actagenthub-release-check: publishable plugin metadata looks OK.");
  if (gitRange && selected.length === 0) {
    console.log(
      `  - no publishable plugin package changes detected between ${gitRange.baseRef} and ${gitRange.headRef}`,
    );
  }
  for (const plugin of selected) {
    console.log(
      `  - ${plugin.packageName}@${plugin.version} (${plugin.channel}, ${plugin.extensionId})`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runPluginACTAgentHubReleaseCheck(process.argv.slice(2));
}
