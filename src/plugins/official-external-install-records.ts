// Defines official external install records for plugins.
import type { PluginInstallRecord } from "../config/types.plugins.js";
import { parseACTAgentHubPluginSpec } from "../infra/actagenthub-spec.js";
import { parseRegistryNpmSpec } from "../infra/npm-registry-spec.js";
import {
  getOfficialExternalPluginCatalogEntry,
  resolveOfficialExternalPluginInstall,
  type OfficialExternalPluginCatalogEntry,
} from "./official-external-plugin-catalog.js";

function resolveNpmSpecPackageName(spec: string | undefined): string | undefined {
  return spec ? parseRegistryNpmSpec(spec)?.name : undefined;
}

function resolveACTAgentHubSpecPackageName(spec: string | undefined): string | undefined {
  return spec ? parseACTAgentHubPluginSpec(spec)?.name : undefined;
}

function resolveOfficialPackageNames(params: {
  entry: OfficialExternalPluginCatalogEntry;
  npmSpec?: string;
  actagenthubSpec?: string;
}): string[] {
  return [
    resolveACTAgentHubSpecPackageName(params.actagenthubSpec),
    resolveNpmSpecPackageName(params.npmSpec),
    params.entry.name,
  ].filter((value): value is string => Boolean(value));
}

function resolveRecordedACTAgentHubPackageNames(record: PluginInstallRecord): string[] {
  return [record.actagenthubPackage, resolveACTAgentHubSpecPackageName(record.spec)].filter(
    (value): value is string => Boolean(value),
  );
}

function isOfficialACTAgentHubInstallRecord(record: PluginInstallRecord): boolean {
  if (record.source !== "actagenthub" || record.actagenthubChannel !== "official") {
    return false;
  }
  return (record.actagenthubUrl ?? "").replace(/\/+$/, "") === "https://actagenthub.ai";
}

/** Resolves the official npm spec when an install record matches the trusted catalog package. */
export function resolveTrustedSourceLinkedOfficialNpmSpec(params: {
  pluginId: string;
  record: PluginInstallRecord;
}): string | undefined {
  if (params.record.source !== "npm") {
    return undefined;
  }
  const entry = getOfficialExternalPluginCatalogEntry(params.pluginId);
  if (!entry) {
    return undefined;
  }
  const officialSpec = resolveOfficialExternalPluginInstall(entry)?.npmSpec;
  const officialPackageName = resolveNpmSpecPackageName(officialSpec);
  if (!officialSpec || !officialPackageName) {
    return undefined;
  }
  const recordedPackageNames = [
    params.record.resolvedName,
    resolveNpmSpecPackageName(params.record.spec),
    resolveNpmSpecPackageName(params.record.resolvedSpec),
  ].filter((value): value is string => Boolean(value));
  return recordedPackageNames.includes(officialPackageName) ? officialSpec : undefined;
}

/** Resolves the official ACTAgentHub spec when a trusted-source install record matches. */
export function resolveTrustedSourceLinkedOfficialACTAgentHubSpec(params: {
  pluginId: string;
  record: PluginInstallRecord;
}): string | undefined {
  return resolveTrustedSourceLinkedOfficialACTAgentHubInstall(params)?.actagenthubSpec;
}

/** Resolves official ACTAgentHub/npm specs linked to a trusted-source install record. */
export function resolveTrustedSourceLinkedOfficialACTAgentHubInstall(params: {
  pluginId: string;
  record: PluginInstallRecord;
}): { actagenthubSpec?: string; npmSpec?: string } | undefined {
  if (params.record.source !== "actagenthub") {
    return undefined;
  }
  const entry = getOfficialExternalPluginCatalogEntry(params.pluginId);
  if (!entry) {
    return undefined;
  }
  const install = resolveOfficialExternalPluginInstall(entry);
  const officialACTAgentHubSpec = install?.actagenthubSpec;
  const officialNpmSpec = install?.npmSpec;
  const officialNames = resolveOfficialPackageNames({
    entry,
    npmSpec: officialNpmSpec,
    actagenthubSpec: officialACTAgentHubSpec,
  });
  if (officialNames.length === 0) {
    return undefined;
  }
  const recordedPackageNames = resolveRecordedACTAgentHubPackageNames(params.record);
  const matchesOfficialPackage = recordedPackageNames.some((name) => officialNames.includes(name));
  if (!matchesOfficialPackage) {
    return undefined;
  }
  if (officialACTAgentHubSpec || isOfficialACTAgentHubInstallRecord(params.record)) {
    return {
      ...(officialACTAgentHubSpec ? { actagenthubSpec: officialACTAgentHubSpec } : {}),
      ...(officialNpmSpec ? { npmSpec: officialNpmSpec } : {}),
    };
  }
  return undefined;
}
