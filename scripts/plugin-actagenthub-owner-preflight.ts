#!/usr/bin/env -S node --import tsx
// Plugin ACTAgentHub Owner Preflight script supports ACTAgent repository automation.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { collectACTAgentHubACTAgentOwnerErrors } from "./lib/plugin-actagenthub-release.ts";

type ReleasePlanFile = {
  candidates?: Array<{
    packageName?: unknown;
  }>;
};

export async function runACTAgentHubOwnerPreflight(argv: string[]) {
  const planPath = argv[0];
  if (!planPath) {
    throw new Error("usage: plugin-actagenthub-owner-preflight.ts <release-plan.json>");
  }

  const parsed = JSON.parse(readFileSync(planPath, "utf8")) as ReleasePlanFile;
  const candidates = (parsed.candidates ?? [])
    .filter(
      (candidate): candidate is { packageName: string } =>
        typeof candidate.packageName === "string",
    )
    .map((candidate) => ({ packageName: candidate.packageName }));

  const errors = await collectACTAgentHubACTAgentOwnerErrors({ plugins: candidates });
  if (errors.length > 0) {
    throw new Error(
      `ACTAgentHub ACTAgent package ownership preflight failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  console.log(`ACTAgentHub ACTAgent owner preflight passed for ${candidates.length} candidate(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    await runACTAgentHubOwnerPreflight(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
