#!/usr/bin/env -S node --import tsx
// Plugin ACTAgentHub Release Plan script supports ACTAgent repository automation.

import { pathToFileURL } from "node:url";
import {
  collectPluginACTAgentHubReleasePlan,
  parsePluginReleaseArgs,
} from "./lib/plugin-actagenthub-release.ts";

export async function collectPluginReleasePlanForACTAgentHub(argv: string[]) {
  const { selection, selectionMode, baseRef, headRef } = parsePluginReleaseArgs(argv);
  return await collectPluginACTAgentHubReleasePlan({
    selection,
    selectionMode,
    gitRange: baseRef && headRef ? { baseRef, headRef } : undefined,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const plan = await collectPluginReleasePlanForACTAgentHub(process.argv.slice(2));
  console.log(JSON.stringify(plan, null, 2));
}
