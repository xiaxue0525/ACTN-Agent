// Resolves ACTAgentHub plugin catalog entries and install metadata.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { normalizeOptionalString } from "@actagent/normalization-core/string-coerce";
import JSZip from "jszip";
import {
  ARCHIVE_LIMIT_ERROR_CODE,
  ArchiveLimitError,
  DEFAULT_MAX_ARCHIVE_BYTES_ZIP,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_ENTRY_BYTES,
  loadZipArchiveWithPreflight,
} from "../infra/archive.js";
import {
  ACTAgentHubRequestError,
  downloadACTAgentHubPackageArchive,
  fetchACTAgentHubPackageArtifact,
  fetchACTAgentHubPackageDetail,
  fetchACTAgentHubPackageVersion,
  isDefaultACTAgentHubBaseUrl,
  normalizeACTAgentHubSha256Integrity,
  normalizeACTAgentHubSha256Hex,
  parseACTAgentHubPluginSpec,
  resolveACTAgentHubBaseUrl,
  resolveLatestVersionFromPackage,
  satisfiesGatewayMinimum,
  satisfiesPluginApiRange,
  type ACTAgentHubPackageArtifactSummary,
  type ACTAgentHubPackageArtifactResolverResponse,
  type ACTAgentHubPackageCompatibility,
  type ACTAgentHubPackageDetail,
  type ACTAgentHubPackageactagentpackSummary,
  type ACTAgentHubResolvedArtifact,
  type ACTAgentHubPackageVersion,
} from "../infra/actagenthub.js";
import { formatErrorMessage } from "../infra/errors.js";
import { resolveCompatibilityHostVersion } from "../version.js";
import type { RuntimeVersionEnv } from "../version.js";
import { ACTAGENTHUB_INSTALL_ERROR_CODE, type ACTAgentHubInstallErrorCode } from "./actagenthub-error-codes.js";
import type { ACTAgentHubPluginInstallRecordFields } from "./actagenthub-install-records.js";
import type { InstallSafetyOverrides } from "./install-security-scan.js";
import { installPluginFromArchive, type InstallPluginResult } from "./install.js";

export { ACTAGENTHUB_INSTALL_ERROR_CODE };
export type { ACTAgentHubInstallErrorCode };

type PluginInstallLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

type ACTAgentHubInstallFailure = {
  ok: false;
  error: string;
  code?: ACTAgentHubInstallErrorCode;
};

type ACTAgentHubFileEntryLike = {
  path?: unknown;
  sha256?: unknown;
};

type ACTAgentHubFileVerificationEntry = {
  path: string;
  sha256: string;
};

type ACTAgentHubArchiveVerification =
  | {
      kind: "archive-integrity";
      integrity: string;
    }
  | {
      kind: "file-list";
      files: ACTAgentHubFileVerificationEntry[];
    };

type ACTAgentHubArchiveVerificationResolution =
  | {
      ok: true;
      verification: ACTAgentHubArchiveVerification | null;
    }
  | ACTAgentHubInstallFailure;

type ACTAgentHubArtifactResolverVersion = NonNullable<
  Exclude<ACTAgentHubPackageArtifactResolverResponse["version"], string | null | undefined>
>;

type ACTAgentHubInstallArtifactDecision = {
  version: string;
  compatibility?: ACTAgentHubPackageCompatibility | null;
  verification: ACTAgentHubArchiveVerification | null;
  actagentpack?: ACTAgentHubPackageArtifactSummary | ACTAgentHubPackageactagentpackSummary | null;
};

type ACTAgentHubArchiveFileVerificationResult =
  | {
      ok: true;
      validatedGeneratedPaths: string[];
    }
  | ACTAgentHubInstallFailure;

type JSZipObjectWithSize = JSZip.JSZipObject & {
  // Internal JSZip field from loadAsync() metadata. Use it only as a best-effort
  // size hint; the streaming byte checks below are the authoritative guard.
  _data?: {
    uncompressedSize?: number;
  };
};

const ACTAGENTHUB_GENERATED_ARCHIVE_METADATA_FILE = "_meta.json";

type ACTAgentHubArchiveEntryLimits = {
  maxEntryBytes: number;
  addArchiveBytes: (bytes: number) => boolean;
};

function normalizeACTAgentHubactagentpackInstallFields(
  actagentpack: ACTAgentHubPackageArtifactSummary | ACTAgentHubPackageactagentpackSummary | null | undefined,
): Pick<
  ACTAgentHubPluginInstallRecordFields,
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
  const isNpmPackArtifact =
    actagentpack && "kind" in actagentpack && normalizeOptionalString(actagentpack.kind) === "npm-pack";
  const isLegacyactagentpack = actagentpack && "available" in actagentpack && actagentpack.available;
  if (!isNpmPackArtifact && !isLegacyactagentpack) {
    return {};
  }

  const actagentpackSha256 =
    typeof actagentpack.sha256 === "string" ? normalizeACTAgentHubSha256Hex(actagentpack.sha256) : null;
  const actagentpackManifestSha256 =
    "manifestSha256" in actagentpack && typeof actagentpack.manifestSha256 === "string"
      ? normalizeACTAgentHubSha256Hex(actagentpack.manifestSha256)
      : null;
  const actagentpackSpecVersion =
    "specVersion" in actagentpack &&
    typeof actagentpack.specVersion === "number" &&
    Number.isSafeInteger(actagentpack.specVersion) &&
    actagentpack.specVersion >= 0
      ? actagentpack.specVersion
      : undefined;
  const actagentpackSize =
    typeof actagentpack.size === "number" && Number.isSafeInteger(actagentpack.size) && actagentpack.size >= 0
      ? actagentpack.size
      : undefined;
  const npmIntegrity = normalizeOptionalString(actagentpack.npmIntegrity);
  const npmShasum = normalizeOptionalString(actagentpack.npmShasum);
  const npmTarballName = normalizeOptionalString(actagentpack.npmTarballName);
  return {
    artifactKind: "npm-pack",
    artifactFormat: "tgz",
    ...(npmIntegrity ? { npmIntegrity } : {}),
    ...(npmShasum ? { npmShasum } : {}),
    ...(npmTarballName ? { npmTarballName } : {}),
    ...(actagentpackSha256 ? { actagentpackSha256 } : {}),
    ...(actagentpackSpecVersion !== undefined ? { actagentpackSpecVersion } : {}),
    ...(actagentpackManifestSha256 ? { actagentpackManifestSha256 } : {}),
    ...(actagentpackSize !== undefined ? { actagentpackSize } : {}),
  };
}

function isTrustedSourceLinkedOfficialPackage(pkg: NonNullable<ACTAgentHubPackageDetail["package"]>) {
  const sourceRepo = normalizeOptionalString(pkg.verification?.sourceRepo);
  return (
    pkg.channel === "official" &&
    pkg.isOfficial &&
    pkg.verification?.tier === "source-linked" &&
    (sourceRepo === "actagent/actagent" ||
      sourceRepo === "github.com/actagent/actagent" ||
      sourceRepo === "https://github.com/actagent/actagent")
  );
}

function resolveACTAgentHubactagentpackArtifactSha256(
  actagentpack: ACTAgentHubPackageArtifactSummary | ACTAgentHubPackageactagentpackSummary | null | undefined,
): string | null {
  const isNpmPackArtifact =
    actagentpack && "kind" in actagentpack && normalizeOptionalString(actagentpack.kind) === "npm-pack";
  const isLegacyactagentpack = actagentpack && "available" in actagentpack && actagentpack.available;
  if ((!isNpmPackArtifact && !isLegacyactagentpack) || typeof actagentpack.sha256 !== "string") {
    return null;
  }
  return normalizeACTAgentHubSha256Hex(actagentpack.sha256);
}

function resolveACTAgentHubNpmIntegrity(
  actagentpack: ACTAgentHubPackageArtifactSummary | ACTAgentHubPackageactagentpackSummary | null | undefined,
): string | null {
  return normalizeOptionalString(actagentpack?.npmIntegrity) ?? null;
}

function resolveACTAgentHubNpmShasum(
  actagentpack: ACTAgentHubPackageArtifactSummary | ACTAgentHubPackageactagentpackSummary | null | undefined,
): string | null {
  return normalizeOptionalString(actagentpack?.npmShasum) ?? null;
}

function resolveACTAgentHubNpmTarballName(
  actagentpack: ACTAgentHubPackageArtifactSummary | ACTAgentHubPackageactagentpackSummary | null | undefined,
): string | null {
  return normalizeOptionalString(actagentpack?.npmTarballName) ?? null;
}

function resolveACTAgentHubNpmPackArtifact(
  version: NonNullable<ACTAgentHubPackageVersion["version"]>,
): ACTAgentHubPackageArtifactSummary | ACTAgentHubPackageactagentpackSummary | null {
  if (version.artifact?.kind === "npm-pack") {
    return version.artifact;
  }
  if (version.actagentpack?.available === true) {
    return version.actagentpack;
  }
  return null;
}

function readArtifactResolverVersion(
  response: ACTAgentHubPackageArtifactResolverResponse,
  requestedVersion: string,
): ACTAgentHubArtifactResolverVersion {
  if (
    response.version &&
    typeof response.version === "object" &&
    !Array.isArray(response.version)
  ) {
    return response.version;
  }
  if (typeof response.version === "string" && response.version.trim().length > 0) {
    return { version: response.version.trim() };
  }
  return { version: requestedVersion };
}

function isACTAgentHubPackageFamily(
  value: unknown,
): value is NonNullable<ACTAgentHubPackageVersion["package"]>["family"] {
  return value === "code-plugin" || value === "bundle-plugin" || value === "skill";
}

function normalizeArtifactResolverFiles(
  files: ACTAgentHubArtifactResolverVersion["files"],
): NonNullable<ACTAgentHubPackageVersion["version"]>["files"] {
  if (!Array.isArray(files)) {
    return undefined;
  }
  return files as NonNullable<ACTAgentHubPackageVersion["version"]>["files"];
}

type ACTAgentHubResolvedArtifactWire = {
  artifactKind?: string | null;
  kind?: string | null;
  artifactSha256?: string | null;
  sha256?: string | null;
  npmIntegrity?: string | null;
  npmShasum?: string | null;
  downloadUrl?: string | null;
};

function resolveTopLevelNpmPackArtifact(
  artifact: ACTAgentHubResolvedArtifact | null | undefined,
): ACTAgentHubPackageArtifactSummary | null {
  const wire = artifact as ACTAgentHubResolvedArtifactWire | null | undefined;
  const artifactKind = wire?.artifactKind ?? wire?.kind;
  if (artifactKind !== "npm-pack") {
    return null;
  }
  if (typeof wire?.npmIntegrity !== "string") {
    return null;
  }
  return {
    kind: "npm-pack",
    format: "tgz",
    sha256: wire.artifactSha256 ?? wire.sha256 ?? null,
    npmIntegrity: wire.npmIntegrity,
    npmShasum: wire.npmShasum ?? null,
    downloadUrl: wire.downloadUrl ?? null,
  };
}

function resolveTopLevelLegacyArchiveVerification(
  artifact: ACTAgentHubResolvedArtifact | null | undefined,
): ACTAgentHubArchiveVerification | null {
  const wire = artifact as ACTAgentHubResolvedArtifactWire | null | undefined;
  const artifactKind = wire?.artifactKind ?? wire?.kind;
  const artifactSha256 = wire?.artifactSha256 ?? wire?.sha256;
  if (artifactKind !== "legacy-zip" || typeof artifactSha256 !== "string") {
    return null;
  }
  const integrity = normalizeACTAgentHubSha256Integrity(artifactSha256);
  return integrity ? { kind: "archive-integrity", integrity } : null;
}

export function formatACTAgentHubSpecifier(params: { name: string; version?: string }): string {
  return `actagenthub:${params.name}${params.version ? `@${params.version}` : ""}`;
}

function buildACTAgentHubInstallFailure(
  error: string,
  code?: ACTAgentHubInstallErrorCode,
): ACTAgentHubInstallFailure {
  return { ok: false, error, code };
}

function isACTAgentHubInstallFailure(value: unknown): value is ACTAgentHubInstallFailure {
  return Boolean(
    value &&
    typeof value === "object" &&
    "ok" in value &&
    Object.is((value as { ok?: unknown }).ok, false) &&
    "error" in value,
  );
}

function mapACTAgentHubRequestError(
  error: unknown,
  context: { stage: "package" | "version"; name: string; version?: string },
): ACTAgentHubInstallFailure {
  if (error instanceof ACTAgentHubRequestError && error.status === 404) {
    if (context.stage === "package") {
      return buildACTAgentHubInstallFailure(
        "Package not found on ACTAgentHub.",
        ACTAGENTHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
      );
    }
    return buildACTAgentHubInstallFailure(
      `Version not found on ACTAgentHub: ${context.name}@${context.version ?? "unknown"}.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.VERSION_NOT_FOUND,
    );
  }
  return buildACTAgentHubInstallFailure(formatErrorMessage(error));
}

function isMissingArtifactResolverRoute(error: unknown): boolean {
  return (
    error instanceof ACTAgentHubRequestError &&
    error.status === 404 &&
    error.requestPath.endsWith("/artifact")
  );
}

function buildArtifactResolverResponseFromVersion(params: {
  detail: ACTAgentHubPackageDetail;
  versionDetail: ACTAgentHubPackageVersion;
}): ACTAgentHubPackageArtifactResolverResponse {
  const packageDetail = params.detail.package;
  const versionPackage = params.versionDetail.package;
  return {
    package: versionPackage
      ? {
          name: versionPackage.name,
          displayName: versionPackage.displayName,
          family: versionPackage.family,
        }
      : packageDetail
        ? {
            name: packageDetail.name,
            displayName: packageDetail.displayName,
            family: packageDetail.family,
          }
        : null,
    version: params.versionDetail.version,
  };
}

function formatACTAgentHubactagentpackDownloadError(params: {
  error: unknown;
  packageName: string;
  version: string;
}): string {
  const message = formatErrorMessage(params.error);
  if (!(params.error instanceof ACTAgentHubRequestError)) {
    return message;
  }
  return `ACTAgentHub artifact download for "${params.packageName}@${params.version}" is not available yet (${message}). Use "npm:${params.packageName}@${params.version}" for launch installs while ACTAgentHub artifact routing is being rolled out.`;
}

function formatACTAgentHubMissingArtifactMetadataError(params: {
  packageName: string;
  version: string;
}): string {
  return `ACTAgentHub package "${params.packageName}@${params.version}" does not expose a downloadable plugin artifact yet. Use "npm:${params.packageName}@${params.version}" for launch installs while ACTAgentHub artifact routing is being rolled out.`;
}

function resolveRequestedVersion(params: {
  detail: ACTAgentHubPackageDetail;
  requestedVersion?: string;
}): string | null {
  if (params.requestedVersion) {
    return params.detail.package?.tags?.[params.requestedVersion] ?? params.requestedVersion;
  }
  return resolveLatestVersionFromPackage(params.detail);
}

function readTrimmedString(value: unknown): string | null {
  return normalizeOptionalString(value) ?? null;
}

function normalizeACTAgentHubRelativePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  if (value.trim() !== value || value.includes("\\")) {
    return null;
  }
  if (value.startsWith("/")) {
    return null;
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null;
  }
  return value;
}

function describeInvalidACTAgentHubRelativePath(value: unknown): string {
  if (typeof value !== "string") {
    return `non-string value of type ${typeof value}`;
  }
  if (value.length === 0) {
    return "empty string";
  }
  if (value.trim() !== value) {
    return `path "${value}" has leading or trailing whitespace`;
  }
  if (value.includes("\\")) {
    return `path "${value}" contains backslashes`;
  }
  if (value.startsWith("/")) {
    return `path "${value}" is absolute`;
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    return `path "${value}" contains an empty segment`;
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return `path "${value}" contains dot segments`;
  }
  return `path "${value}" failed validation for an unknown reason`;
}

function describeInvalidACTAgentHubSha256(value: unknown): string {
  if (typeof value !== "string") {
    return `non-string value of type ${typeof value}`;
  }
  if (value.length === 0) {
    return "empty string";
  }
  if (value.trim().length === 0) {
    return "whitespace-only string";
  }
  return `value "${value}" is not a 64-character hexadecimal SHA-256 digest`;
}

function resolveACTAgentHubArchiveVerification(
  versionDetail: ACTAgentHubPackageVersion,
  packageName: string,
  version: string,
): ACTAgentHubArchiveVerificationResolution {
  const sha256hashValue = versionDetail.version?.sha256hash;
  const sha256hash = readTrimmedString(sha256hashValue);
  const integrity = sha256hash ? normalizeACTAgentHubSha256Integrity(sha256hash) : null;
  if (integrity) {
    return {
      ok: true,
      verification: {
        kind: "archive-integrity",
        integrity,
      },
    };
  }
  if (sha256hashValue !== undefined && sha256hashValue !== null) {
    const detail =
      typeof sha256hashValue === "string" && sha256hashValue.trim().length === 0
        ? "empty string"
        : typeof sha256hashValue === "string"
          ? `unrecognized value "${sha256hashValue.trim()}"`
          : `non-string value of type ${typeof sha256hashValue}`;
    return buildACTAgentHubInstallFailure(
      `ACTAgentHub version metadata for "${packageName}@${version}" has an invalid sha256hash (${detail}).`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
    );
  }
  const files = versionDetail.version?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return {
      ok: true,
      verification: null,
    };
  }
  const normalizedFiles: ACTAgentHubFileVerificationEntry[] = [];
  const seenPaths = new Set<string>();
  for (const [index, file] of files.entries()) {
    if (!file || typeof file !== "object") {
      return buildACTAgentHubInstallFailure(
        `ACTAgentHub version metadata for "${packageName}@${version}" has an invalid files[${index}] entry (expected an object, got ${file === null ? "null" : typeof file}).`,
        ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    const fileRecord = file as ACTAgentHubFileEntryLike;
    const filePath = normalizeACTAgentHubRelativePath(fileRecord.path);
    const sha256Value = readTrimmedString(fileRecord.sha256);
    const sha256 = sha256Value ? normalizeACTAgentHubSha256Hex(sha256Value) : null;
    if (!filePath) {
      return buildACTAgentHubInstallFailure(
        `ACTAgentHub version metadata for "${packageName}@${version}" has an invalid files[${index}].path (${describeInvalidACTAgentHubRelativePath(fileRecord.path)}).`,
        ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    if (filePath === ACTAGENTHUB_GENERATED_ARCHIVE_METADATA_FILE) {
      return buildACTAgentHubInstallFailure(
        `ACTAgentHub version metadata for "${packageName}@${version}" must not include generated file "${filePath}" in files[].`,
        ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    if (!sha256) {
      return buildACTAgentHubInstallFailure(
        `ACTAgentHub version metadata for "${packageName}@${version}" has an invalid files[${index}].sha256 (${describeInvalidACTAgentHubSha256(fileRecord.sha256)}).`,
        ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    if (seenPaths.has(filePath)) {
      return buildACTAgentHubInstallFailure(
        `ACTAgentHub version metadata for "${packageName}@${version}" has duplicate files[] path "${filePath}".`,
        ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    seenPaths.add(filePath);
    normalizedFiles.push({ path: filePath, sha256 });
  }
  return {
    ok: true,
    verification: {
      kind: "file-list",
      files: normalizedFiles,
    },
  };
}

async function readLimitedACTAgentHubArchiveEntry<T>(
  entry: JSZip.JSZipObject,
  limits: ACTAgentHubArchiveEntryLimits,
  handlers: {
    onChunk: (buffer: Buffer) => void;
    onEnd: () => T;
  },
): Promise<T | ACTAgentHubInstallFailure> {
  const hintedSize = (entry as JSZipObjectWithSize)["_data"]?.uncompressedSize;
  if (
    typeof hintedSize === "number" &&
    Number.isFinite(hintedSize) &&
    hintedSize > limits.maxEntryBytes
  ) {
    return buildACTAgentHubInstallFailure(
      `ACTAgentHub archive fallback verification rejected "${entry.name}" because it exceeds the per-file size limit.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  let entryBytes = 0;
  return await new Promise<T | ACTAgentHubInstallFailure>((resolve) => {
    let settled = false;
    const stream = entry.nodeStream("nodebuffer") as NodeJS.ReadableStream & {
      destroy?: (error?: Error) => void;
    };
    stream.on("data", (chunk: Buffer | Uint8Array | string) => {
      if (settled) {
        return;
      }
      const buffer =
        typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array);
      entryBytes += buffer.byteLength;
      if (entryBytes > limits.maxEntryBytes) {
        settled = true;
        stream.destroy?.();
        resolve(
          buildACTAgentHubInstallFailure(
            `ACTAgentHub archive fallback verification rejected "${entry.name}" because it exceeds the per-file size limit.`,
            ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
          ),
        );
        return;
      }
      if (!limits.addArchiveBytes(buffer.byteLength)) {
        settled = true;
        stream.destroy?.();
        resolve(
          buildACTAgentHubInstallFailure(
            "ACTAgentHub archive fallback verification exceeded the total extracted-size limit.",
            ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
          ),
        );
        return;
      }
      handlers.onChunk(buffer);
    });
    stream.once("end", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(handlers.onEnd());
    });
    stream.once("error", (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(
        buildACTAgentHubInstallFailure(
          error instanceof Error ? error.message : String(error),
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        ),
      );
    });
  });
}

async function readACTAgentHubArchiveEntryBuffer(
  entry: JSZip.JSZipObject,
  limits: ACTAgentHubArchiveEntryLimits,
): Promise<Buffer | ACTAgentHubInstallFailure> {
  const chunks: Buffer[] = [];
  return await readLimitedACTAgentHubArchiveEntry(entry, limits, {
    onChunk(buffer) {
      chunks.push(buffer);
    },
    onEnd() {
      return Buffer.concat(chunks);
    },
  });
}

async function hashACTAgentHubArchiveEntry(
  entry: JSZip.JSZipObject,
  limits: ACTAgentHubArchiveEntryLimits,
): Promise<string | ACTAgentHubInstallFailure> {
  const digest = createHash("sha256");
  return await readLimitedACTAgentHubArchiveEntry(entry, limits, {
    onChunk(buffer) {
      digest.update(buffer);
    },
    onEnd() {
      return digest.digest("hex");
    },
  });
}

function validateACTAgentHubArchiveMetaJson(params: {
  packageName: string;
  version: string;
  bytes: Buffer;
}): ACTAgentHubInstallFailure | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(params.bytes.toString("utf8"));
  } catch {
    return buildACTAgentHubInstallFailure(
      `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json is not valid JSON.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    return buildACTAgentHubInstallFailure(
      `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json is not a JSON object.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  const record = parsed as { slug?: unknown; version?: unknown };
  if (record.slug !== params.packageName) {
    return buildACTAgentHubInstallFailure(
      `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json slug does not match the package name.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  if (record.version !== params.version) {
    return buildACTAgentHubInstallFailure(
      `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json version does not match the package version.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  return null;
}

function mapACTAgentHubArchiveReadFailure(error: unknown): ACTAgentHubInstallFailure {
  if (error instanceof ArchiveLimitError) {
    if (error.code === ARCHIVE_LIMIT_ERROR_CODE.ENTRY_COUNT_EXCEEDS_LIMIT) {
      return buildACTAgentHubInstallFailure(
        "ACTAgentHub archive fallback verification exceeded the archive entry limit.",
        ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
    if (error.code === ARCHIVE_LIMIT_ERROR_CODE.ARCHIVE_SIZE_EXCEEDS_LIMIT) {
      return buildACTAgentHubInstallFailure(
        "ACTAgentHub archive fallback verification rejected the downloaded archive because it exceeds the ZIP archive size limit.",
        ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
  }
  return buildACTAgentHubInstallFailure(
    "ACTAgentHub archive fallback verification failed while reading the downloaded archive.",
    ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
  );
}

async function verifyACTAgentHubArchiveFiles(params: {
  archivePath: string;
  packageName: string;
  packageVersion: string;
  files: ACTAgentHubFileVerificationEntry[];
}): Promise<ACTAgentHubArchiveFileVerificationResult> {
  try {
    const archiveStat = await fs.stat(params.archivePath);
    if (archiveStat.size > DEFAULT_MAX_ARCHIVE_BYTES_ZIP) {
      return buildACTAgentHubInstallFailure(
        "ACTAgentHub archive fallback verification rejected the downloaded archive because it exceeds the ZIP archive size limit.",
        ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
    const archiveBytes = await fs.readFile(params.archivePath);
    const zip = await loadZipArchiveWithPreflight(archiveBytes, {
      maxArchiveBytes: DEFAULT_MAX_ARCHIVE_BYTES_ZIP,
      maxEntries: DEFAULT_MAX_ENTRIES,
      maxExtractedBytes: DEFAULT_MAX_EXTRACTED_BYTES,
      maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES,
    });
    const actualFiles = new Map<string, string>();
    const validatedGeneratedPaths = new Set<string>();
    let entryCount = 0;
    let extractedBytes = 0;
    const addArchiveBytes = (bytes: number): boolean => {
      extractedBytes += bytes;
      return extractedBytes <= DEFAULT_MAX_EXTRACTED_BYTES;
    };
    for (const entry of Object.values(zip.files as Record<string, JSZip.JSZipObject>)) {
      entryCount += 1;
      if (entryCount > DEFAULT_MAX_ENTRIES) {
        return buildACTAgentHubInstallFailure(
          "ACTAgentHub archive fallback verification exceeded the archive entry limit.",
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      if (entry.dir) {
        continue;
      }
      const relativePath = normalizeACTAgentHubRelativePath(entry.name);
      if (!relativePath) {
        return buildACTAgentHubInstallFailure(
          `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": invalid package file path "${entry.name}" (${describeInvalidACTAgentHubRelativePath(entry.name)}).`,
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      if (relativePath === ACTAGENTHUB_GENERATED_ARCHIVE_METADATA_FILE) {
        const metaResult = await readACTAgentHubArchiveEntryBuffer(entry, {
          maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES,
          addArchiveBytes,
        });
        if (isACTAgentHubInstallFailure(metaResult)) {
          return metaResult;
        }
        const metaFailure = validateACTAgentHubArchiveMetaJson({
          packageName: params.packageName,
          version: params.packageVersion,
          bytes: metaResult,
        });
        if (metaFailure) {
          return metaFailure;
        }
        validatedGeneratedPaths.add(relativePath);
        continue;
      }
      const sha256 = await hashACTAgentHubArchiveEntry(entry, {
        maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES,
        addArchiveBytes,
      });
      if (typeof sha256 !== "string") {
        return sha256;
      }
      actualFiles.set(relativePath, sha256);
    }
    for (const file of params.files) {
      const actualSha256 = actualFiles.get(file.path);
      if (!actualSha256) {
        return buildACTAgentHubInstallFailure(
          `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": missing "${file.path}".`,
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      if (actualSha256 !== file.sha256) {
        return buildACTAgentHubInstallFailure(
          `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": expected ${file.path} to hash to ${file.sha256}, got ${actualSha256}.`,
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      actualFiles.delete(file.path);
    }
    let unexpectedFile: string | undefined;
    for (const file of actualFiles.keys()) {
      if (unexpectedFile === undefined || file < unexpectedFile) {
        unexpectedFile = file;
      }
    }
    if (unexpectedFile) {
      return buildACTAgentHubInstallFailure(
        `ACTAgentHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": unexpected file "${unexpectedFile}".`,
        ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
    return {
      ok: true,
      validatedGeneratedPaths: [...validatedGeneratedPaths].toSorted(),
    };
  } catch (error) {
    return mapACTAgentHubArchiveReadFailure(error);
  }
}

async function resolveCompatiblePackageVersion(params: {
  detail: ACTAgentHubPackageDetail;
  requestedVersion?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
}): Promise<({ ok: true } & ACTAgentHubInstallArtifactDecision) | ACTAgentHubInstallFailure> {
  const requestedVersion = resolveRequestedVersion(params);
  if (!requestedVersion) {
    return buildACTAgentHubInstallFailure(
      `ACTAgentHub package "${params.detail.package?.name ?? "unknown"}" has no installable version.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.NO_INSTALLABLE_VERSION,
    );
  }
  let artifactResponse: ACTAgentHubPackageArtifactResolverResponse;
  try {
    artifactResponse = await fetchACTAgentHubPackageArtifact({
      name: params.detail.package?.name ?? "",
      version: requestedVersion,
      baseUrl: params.baseUrl,
      token: params.token,
      timeoutMs: params.timeoutMs,
    });
  } catch (error) {
    if (isMissingArtifactResolverRoute(error)) {
      try {
        const versionDetail = await fetchACTAgentHubPackageVersion({
          name: params.detail.package?.name ?? "",
          version: requestedVersion,
          baseUrl: params.baseUrl,
          token: params.token,
          timeoutMs: params.timeoutMs,
        });
        artifactResponse = buildArtifactResolverResponseFromVersion({
          detail: params.detail,
          versionDetail,
        });
      } catch (versionError) {
        return mapACTAgentHubRequestError(versionError, {
          stage: "version",
          name: params.detail.package?.name ?? "unknown",
          version: requestedVersion,
        });
      }
    } else {
      return mapACTAgentHubRequestError(error, {
        stage: "version",
        name: params.detail.package?.name ?? "unknown",
        version: requestedVersion,
      });
    }
  }
  const artifactVersion = readArtifactResolverVersion(artifactResponse, requestedVersion);
  const resolvedVersion = normalizeOptionalString(artifactVersion.version) ?? requestedVersion;
  if (params.detail.package?.family === "skill") {
    return {
      ok: true,
      version: resolvedVersion,
      compatibility: artifactVersion.compatibility ?? params.detail.package?.compatibility ?? null,
      verification: null,
      actagentpack:
        artifactVersion.actagentpack ?? resolveTopLevelNpmPackArtifact(artifactResponse.artifact),
    };
  }
  const artifactFamily = artifactResponse.package?.family;
  const resolvedFamily: NonNullable<ACTAgentHubPackageVersion["package"]>["family"] =
    isACTAgentHubPackageFamily(artifactFamily)
      ? artifactFamily
      : (params.detail.package?.family ?? "code-plugin");
  const versionRecord: NonNullable<ACTAgentHubPackageVersion["version"]> = {
    version: resolvedVersion,
    createdAt: typeof artifactVersion.createdAt === "number" ? artifactVersion.createdAt : 0,
    changelog: typeof artifactVersion.changelog === "string" ? artifactVersion.changelog : "",
    distTags: artifactVersion.distTags,
    files: normalizeArtifactResolverFiles(artifactVersion.files),
    sha256hash: artifactVersion.sha256hash,
    compatibility: artifactVersion.compatibility,
    artifact: artifactVersion.artifact,
    actagentpack: artifactVersion.actagentpack ?? undefined,
  };
  const versionDetail: ACTAgentHubPackageVersion = {
    package: artifactResponse.package
      ? {
          name: artifactResponse.package.name ?? params.detail.package?.name ?? "",
          displayName:
            artifactResponse.package.displayName ?? params.detail.package?.displayName ?? "",
          family: resolvedFamily,
        }
      : null,
    version: versionRecord,
  };
  const actagentpack =
    resolveACTAgentHubNpmPackArtifact(versionRecord) ??
    resolveTopLevelNpmPackArtifact(artifactResponse.artifact);
  const verificationState = resolveACTAgentHubArchiveVerification(
    versionDetail,
    params.detail.package?.name ?? "unknown",
    resolvedVersion,
  );
  if (!verificationState.ok) {
    if (!resolveACTAgentHubactagentpackArtifactSha256(actagentpack)) {
      return verificationState;
    }
    return {
      ok: true,
      version: resolvedVersion,
      compatibility:
        versionDetail.version?.compatibility ?? params.detail.package?.compatibility ?? null,
      verification: null,
      actagentpack,
    };
  }
  const topLevelLegacyVerification = resolveTopLevelLegacyArchiveVerification(
    artifactResponse.artifact,
  );
  return {
    ok: true,
    version: resolvedVersion,
    compatibility:
      versionDetail.version?.compatibility ?? params.detail.package?.compatibility ?? null,
    verification: verificationState.verification ?? topLevelLegacyVerification,
    actagentpack,
  };
}

function validateACTAgentHubPluginPackage(params: {
  detail: ACTAgentHubPackageDetail;
  compatibility?: ACTAgentHubPackageCompatibility | null;
  runtimeVersion: string;
}): ACTAgentHubInstallFailure | null {
  const pkg = params.detail.package;
  if (!pkg) {
    return buildACTAgentHubInstallFailure(
      "Package not found on ACTAgentHub.",
      ACTAGENTHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
    );
  }
  if (pkg.family === "skill") {
    return buildACTAgentHubInstallFailure(
      `"${pkg.name}" is a skill. Use "actagent skills install ${pkg.name}" instead.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
    );
  }
  if (pkg.family !== "code-plugin" && pkg.family !== "bundle-plugin") {
    return buildACTAgentHubInstallFailure(
      `Unsupported ACTAgentHub package family: ${String(pkg.family)}`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.UNSUPPORTED_FAMILY,
    );
  }
  if (pkg.channel === "private") {
    return buildACTAgentHubInstallFailure(
      `"${pkg.name}" is private on ACTAgentHub and cannot be installed anonymously.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.PRIVATE_PACKAGE,
    );
  }

  const compatibility = params.compatibility;
  const runtimeVersion = params.runtimeVersion;
  if (
    compatibility?.pluginApiRange &&
    !satisfiesPluginApiRange(runtimeVersion, compatibility.pluginApiRange)
  ) {
    return buildACTAgentHubInstallFailure(
      `Plugin "${pkg.name}" requires plugin API ${compatibility.pluginApiRange}, but this ACTAgent runtime exposes ${runtimeVersion}.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API,
    );
  }

  if (
    compatibility?.minGatewayVersion &&
    !satisfiesGatewayMinimum(runtimeVersion, compatibility.minGatewayVersion)
  ) {
    return buildACTAgentHubInstallFailure(
      `Plugin "${pkg.name}" requires ACTAgent >=${compatibility.minGatewayVersion}, but this host is ${runtimeVersion}.`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_GATEWAY,
    );
  }
  return null;
}

function logACTAgentHubPackageSummary(params: {
  detail: ACTAgentHubPackageDetail;
  version: string;
  compatibility?: ACTAgentHubPackageCompatibility | null;
  logger?: PluginInstallLogger;
}) {
  const pkg = params.detail.package;
  if (!pkg) {
    return;
  }
  const verification = pkg.verification?.tier ? ` verification=${pkg.verification.tier}` : "";
  params.logger?.info?.(
    `ACTAgentHub ${pkg.family} ${pkg.name}@${params.version} channel=${pkg.channel}${verification}`,
  );
  const compatibilityParts = [
    params.compatibility?.pluginApiRange
      ? `pluginApi=${params.compatibility.pluginApiRange}`
      : null,
    params.compatibility?.minGatewayVersion
      ? `minGateway=${params.compatibility.minGatewayVersion}`
      : null,
  ].filter(Boolean);
  if (compatibilityParts.length > 0) {
    params.logger?.info?.(`Compatibility: ${compatibilityParts.join(" ")}`);
  }
  if (pkg.channel !== "official") {
    params.logger?.warn?.(
      `ACTAgentHub package "${pkg.name}" is ${pkg.channel}; review source and verification before enabling.`,
    );
  }
}

export async function installPluginFromACTAgentHub(
  params: InstallSafetyOverrides & {
    spec: string;
    baseUrl?: string;
    token?: string;
    logger?: PluginInstallLogger;
    mode?: "install" | "update";
    extensionsDir?: string;
    timeoutMs?: number;
    dryRun?: boolean;
    expectedPluginId?: string;
    env?: RuntimeVersionEnv;
  },
): Promise<
  | ({
      ok: true;
    } & Extract<InstallPluginResult, { ok: true }> & {
        actagenthub: ACTAgentHubPluginInstallRecordFields;
        packageName: string;
      })
  | ACTAgentHubInstallFailure
  | Extract<InstallPluginResult, { ok: false }>
> {
  const parsed = parseACTAgentHubPluginSpec(params.spec);
  if (!parsed?.name) {
    return buildACTAgentHubInstallFailure(
      `invalid ACTAgentHub plugin spec: ${params.spec}`,
      ACTAGENTHUB_INSTALL_ERROR_CODE.INVALID_SPEC,
    );
  }

  params.logger?.info?.(`Resolving ${formatACTAgentHubSpecifier(parsed)}…`);
  let detail: ACTAgentHubPackageDetail;
  try {
    detail = await fetchACTAgentHubPackageDetail({
      name: parsed.name,
      baseUrl: params.baseUrl,
      token: params.token,
      timeoutMs: params.timeoutMs,
    });
  } catch (error) {
    return mapACTAgentHubRequestError(error, {
      stage: "package",
      name: parsed.name,
    });
  }
  const versionState = await resolveCompatiblePackageVersion({
    detail,
    requestedVersion: parsed.version,
    baseUrl: params.baseUrl,
    token: params.token,
    timeoutMs: params.timeoutMs,
  });
  if (!versionState.ok) {
    return versionState;
  }
  const runtimeVersion = resolveCompatibilityHostVersion(params.env);
  const validationFailure = validateACTAgentHubPluginPackage({
    detail,
    compatibility: versionState.compatibility,
    runtimeVersion,
  });
  if (validationFailure) {
    return validationFailure;
  }
  const expectedactagentpackSha256 = resolveACTAgentHubactagentpackArtifactSha256(versionState.actagentpack);
  const canonicalPackageName = detail.package?.name ?? parsed.name;
  if (!versionState.verification && !expectedactagentpackSha256) {
    return buildACTAgentHubInstallFailure(
      formatACTAgentHubMissingArtifactMetadataError({
        packageName: canonicalPackageName,
        version: versionState.version,
      }),
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARTIFACT_UNAVAILABLE,
    );
  }
  logACTAgentHubPackageSummary({
    detail,
    version: versionState.version,
    compatibility: versionState.compatibility,
    logger: params.logger,
  });

  let archive;
  try {
    archive = await downloadACTAgentHubPackageArchive({
      name: parsed.name,
      version: versionState.version,
      artifact: expectedactagentpackSha256 ? "actagentpack" : "archive",
      baseUrl: params.baseUrl,
      token: params.token,
      timeoutMs: params.timeoutMs,
    });
  } catch (error) {
    // Fix-me(actagenthub): remove this npm hint once ACTAgentHub actagentpack artifact
    // routing is live for official package installs.
    return buildACTAgentHubInstallFailure(
      expectedactagentpackSha256
        ? formatACTAgentHubactagentpackDownloadError({
            error,
            packageName: canonicalPackageName,
            version: versionState.version,
          })
        : formatErrorMessage(error),
      expectedactagentpackSha256 &&
        error instanceof ACTAgentHubRequestError &&
        error.status === 404 &&
        error.requestPath.endsWith("/artifact/download")
        ? ACTAGENTHUB_INSTALL_ERROR_CODE.ARTIFACT_DOWNLOAD_UNAVAILABLE
        : error instanceof ACTAgentHubRequestError
          ? ACTAGENTHUB_INSTALL_ERROR_CODE.ARTIFACT_UNAVAILABLE
          : undefined,
    );
  }
  try {
    if (expectedactagentpackSha256) {
      const expectedIntegrity = normalizeACTAgentHubSha256Integrity(expectedactagentpackSha256);
      const expectedNpmIntegrity = resolveACTAgentHubNpmIntegrity(versionState.actagentpack);
      if (
        archive.artifact !== "actagentpack" ||
        archive.actagentpackHeaderSha256 !== expectedactagentpackSha256 ||
        archive.sha256Hex !== expectedactagentpackSha256 ||
        archive.integrity !== expectedIntegrity
      ) {
        return buildACTAgentHubInstallFailure(
          `ACTAgentHub actagentpack integrity mismatch for "${parsed.name}@${versionState.version}": expected ${expectedactagentpackSha256}, got ${archive.sha256Hex}.`,
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      if (expectedNpmIntegrity && archive.npmIntegrity !== expectedNpmIntegrity) {
        return buildACTAgentHubInstallFailure(
          `ACTAgentHub actagentpack npm integrity mismatch for "${parsed.name}@${versionState.version}": expected ${expectedNpmIntegrity}, got ${archive.npmIntegrity ?? "unknown"}.`,
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      const expectedNpmShasum = resolveACTAgentHubNpmShasum(versionState.actagentpack);
      if (expectedNpmShasum && archive.npmShasum !== expectedNpmShasum) {
        return buildACTAgentHubInstallFailure(
          `ACTAgentHub actagentpack npm shasum mismatch for "${parsed.name}@${versionState.version}": expected ${expectedNpmShasum}, got ${archive.npmShasum ?? "unknown"}.`,
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
    } else if (versionState.verification?.kind === "archive-integrity") {
      if (archive.integrity !== versionState.verification.integrity) {
        return buildACTAgentHubInstallFailure(
          `ACTAgentHub archive integrity mismatch for "${parsed.name}@${versionState.version}": expected ${versionState.verification.integrity}, got ${archive.integrity}.`,
          ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
    } else if (versionState.verification) {
      const validatedPaths = versionState.verification.files
        .map((file) => file.path)
        .toSorted()
        .join(", ");
      const fallbackVerification = await verifyACTAgentHubArchiveFiles({
        archivePath: archive.archivePath,
        packageName: canonicalPackageName,
        packageVersion: versionState.version,
        files: versionState.verification.files,
      });
      if (!fallbackVerification.ok) {
        return fallbackVerification;
      }
      const validatedGeneratedPaths =
        fallbackVerification.validatedGeneratedPaths.length > 0
          ? ` Validated generated metadata files present in archive: ${fallbackVerification.validatedGeneratedPaths.join(", ")} (JSON parse plus slug/version match only).`
          : "";
      params.logger?.warn?.(
        `ACTAgentHub package "${canonicalPackageName}@${versionState.version}" is missing sha256hash; falling back to files[] verification. Validated files: ${validatedPaths}.${validatedGeneratedPaths}`,
      );
    }
    const actagenthubRegistry = resolveACTAgentHubBaseUrl(params.baseUrl);
    const actagenthubAuthority = isDefaultACTAgentHubBaseUrl(params.baseUrl) ? "actagent" : "third-party";
    params.logger?.info?.(
      `Downloading ${detail.package?.family === "bundle-plugin" ? "bundle" : "plugin"} ${parsed.name}@${versionState.version} from ACTAgentHub…`,
    );
    const installResult = await installPluginFromArchive({
      archivePath: archive.archivePath,
      dangerouslyForceUnsafeInstall: params.dangerouslyForceUnsafeInstall,
      trustedSourceLinkedOfficialInstall: isTrustedSourceLinkedOfficialPackage(detail.package!),
      config: params.config,
      logger: params.logger,
      mode: params.mode,
      extensionsDir: params.extensionsDir,
      timeoutMs: params.timeoutMs,
      dryRun: params.dryRun,
      expectedPluginId: params.expectedPluginId,
      installPolicyRequest: {
        kind: "plugin-archive",
        requestedSpecifier: params.spec,
        source: { kind: "actagenthub", authority: actagenthubAuthority, mutable: false, network: true },
      },
    });
    if (!installResult.ok) {
      return installResult;
    }

    const pkg = detail.package!;
    const actagentpackFields = normalizeACTAgentHubactagentpackInstallFields(versionState.actagentpack);
    const observedactagentpackArtifactFields =
      archive.artifact === "actagentpack"
        ? ({
            artifactKind: "npm-pack",
            artifactFormat: "tgz",
            ...(archive.npmIntegrity ? { npmIntegrity: archive.npmIntegrity } : {}),
            ...(archive.npmShasum ? { npmShasum: archive.npmShasum } : {}),
            ...(archive.npmTarballName ? { npmTarballName: archive.npmTarballName } : {}),
          } satisfies Partial<ACTAgentHubPluginInstallRecordFields>)
        : ({
            artifactKind: "legacy-zip",
            artifactFormat: "zip",
          } satisfies Partial<ACTAgentHubPluginInstallRecordFields>);
    const expectedTarballName = resolveACTAgentHubNpmTarballName(versionState.actagentpack);
    const actagenthubFamily =
      pkg.family === "code-plugin" || pkg.family === "bundle-plugin" ? pkg.family : null;
    if (!actagenthubFamily) {
      return buildACTAgentHubInstallFailure(
        `Unsupported ACTAgentHub package family: ${pkg.family}`,
        ACTAGENTHUB_INSTALL_ERROR_CODE.UNSUPPORTED_FAMILY,
      );
    }
    return {
      ...installResult,
      packageName: parsed.name,
      actagenthub: {
        source: "actagenthub",
        actagenthubUrl: actagenthubRegistry,
        actagenthubPackage: parsed.name,
        actagenthubFamily,
        actagenthubChannel: pkg.channel,
        version: installResult.version ?? versionState.version,
        // For fallback installs this is the observed download digest, not a
        // server-attested sha256hash from ACTAgentHub version metadata.
        integrity: archive.integrity,
        resolvedAt: new Date().toISOString(),
        ...actagentpackFields,
        ...observedactagentpackArtifactFields,
        ...(expectedTarballName && !archive.npmTarballName
          ? { npmTarballName: expectedTarballName }
          : {}),
      },
    };
  } finally {
    await archive.cleanup().catch(() => undefined);
  }
}
