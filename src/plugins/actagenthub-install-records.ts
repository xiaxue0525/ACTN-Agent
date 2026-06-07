// Converts ACTAgentHub plugin entries into install records.
import type { PluginInstallRecord } from "../config/types.plugins.js";
import type { ACTAgentHubPackageChannel, ACTAgentHubPackageFamily } from "../infra/actagenthub.js";

/** Install record fields captured for ACTAgentHub plugin installs. */
export type ACTAgentHubPluginInstallRecordFields = {
  source: "actagenthub";
  actagenthubUrl: string;
  actagenthubPackage: string;
  actagenthubFamily: Exclude<ACTAgentHubPackageFamily, "skill">;
  actagenthubChannel?: ACTAgentHubPackageChannel;
  version?: string;
  integrity?: string;
  resolvedAt?: string;
  installedAt?: string;
  artifactKind?: "legacy-zip" | "npm-pack";
  artifactFormat?: "zip" | "tgz";
  npmIntegrity?: string;
  npmShasum?: string;
  npmTarballName?: string;
  actagentpackSha256?: string;
  actagentpackSpecVersion?: number;
  actagentpackManifestSha256?: string;
  actagentpackSize?: number;
};

/** Builds plugin install record fields from resolved ACTAgentHub package metadata. */
export function buildACTAgentHubPluginInstallRecordFields(
  fields: ACTAgentHubPluginInstallRecordFields,
): Pick<
  PluginInstallRecord,
  | "source"
  | "actagenthubUrl"
  | "actagenthubPackage"
  | "actagenthubFamily"
  | "actagenthubChannel"
  | "version"
  | "integrity"
  | "resolvedAt"
  | "installedAt"
  | "artifactKind"
  | "artifactFormat"
  | "npmIntegrity"
  | "npmShasum"
  | "npmTarballName"
  | "actagentpackSha256"
  | "actagentpackSpecVersion"
  | "actagentpackManifestSha256"
  | "actagentpackSize"
> {
  return {
    source: "actagenthub",
    actagenthubUrl: fields.actagenthubUrl,
    actagenthubPackage: fields.actagenthubPackage,
    actagenthubFamily: fields.actagenthubFamily,
    ...(fields.actagenthubChannel ? { actagenthubChannel: fields.actagenthubChannel } : {}),
    ...(fields.version ? { version: fields.version } : {}),
    ...(fields.integrity ? { integrity: fields.integrity } : {}),
    ...(fields.resolvedAt ? { resolvedAt: fields.resolvedAt } : {}),
    ...(fields.installedAt ? { installedAt: fields.installedAt } : {}),
    ...(fields.artifactKind ? { artifactKind: fields.artifactKind } : {}),
    ...(fields.artifactFormat ? { artifactFormat: fields.artifactFormat } : {}),
    ...(fields.npmIntegrity ? { npmIntegrity: fields.npmIntegrity } : {}),
    ...(fields.npmShasum ? { npmShasum: fields.npmShasum } : {}),
    ...(fields.npmTarballName ? { npmTarballName: fields.npmTarballName } : {}),
    ...(fields.actagentpackSha256 ? { actagentpackSha256: fields.actagentpackSha256 } : {}),
    ...(fields.actagentpackSpecVersion !== undefined
      ? { actagentpackSpecVersion: fields.actagentpackSpecVersion }
      : {}),
    ...(fields.actagentpackManifestSha256
      ? { actagentpackManifestSha256: fields.actagentpackManifestSha256 }
      : {}),
    ...(fields.actagentpackSize !== undefined ? { actagentpackSize: fields.actagentpackSize } : {}),
  };
}
