// Fetches and validates ACTAgentHub package metadata and artifacts.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readResponseWithLimit } from "@actagent/media-core/read-response-with-limit";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "@actagent/normalization-core/string-coerce";
import { normalizeStringEntries } from "@actagent/normalization-core/string-normalization";
import { parseStrictPositiveInteger } from "./parse-finite-number.js";
import { isAtLeast, parseSemver } from "./runtime-guard.js";
import { compareComparableSemver, parseComparableSemver } from "./semver-compare.js";
import { createTempDownloadTarget } from "./temp-download.js";
export { parseACTAgentHubPluginSpec } from "./actagenthub-spec.js";

const DEFAULT_ACTAGENTHUB_URL = "https://actagenthub.ai";
const DEFAULT_GITHUB_CODELOAD_URL = "https://codeload.github.com";
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const SKILL_CARD_MAX_BYTES = 256 * 1024;

export type ACTAgentHubPackageFamily = "skill" | "code-plugin" | "bundle-plugin";
export type ACTAgentHubPackageChannel = "official" | "community" | "private";
// Keep aligned with @actagent/plugin-package-contract ExternalPluginCompatibility.
export type ACTAgentHubPackageCompatibility = {
  pluginApiRange?: string;
  builtWithACTAgentVersion?: string;
  pluginSdkVersion?: string;
  minGatewayVersion?: string;
};
export type ACTAgentHubPackageHostTarget = {
  os?: string | null;
  arch?: string | null;
  libc?: string | null;
  key?: string | null;
};
export type ACTAgentHubPackageEnvironmentSummary = {
  requiresLocalDesktop?: boolean;
  requiresBrowser?: boolean;
  requiresAudioDevice?: boolean;
  requiresNetwork?: boolean;
  requiresExternalServices?: string[];
  requiresOsPermissions?: string[];
  supportsRemoteHost?: boolean;
  knownUnsupported?: string[];
};
export type ACTAgentHubPackageArtifactSummary = {
  kind?: string | null;
  sha256?: string | null;
  size?: number | null;
  format?: string | null;
  npmIntegrity?: string | null;
  npmShasum?: string | null;
  npmTarballName?: string | null;
  npmUnpackedSize?: number | null;
  npmFileCount?: number | null;
  downloadUrl?: string | null;
  tarballUrl?: string | null;
  legacyDownloadUrl?: string | null;
};
export type ACTAgentHubArtifactKind = "legacy-zip" | "npm-pack";
export type ACTAgentHubArtifactScanState =
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "not-run"
  | (string & {});
export type ACTAgentHubArtifactModerationState = "approved" | "quarantined" | "revoked" | (string & {});
export type ACTAgentHubPackageSecurityState =
  | "pending"
  | "approved"
  | "limited"
  | "quarantined"
  | "rejected"
  | "revoked"
  | (string & {});
export type ACTAgentHubResolvedArtifact =
  | {
      source: "actagenthub";
      artifactKind: "legacy-zip";
      packageName: string;
      version: string;
      downloadUrl?: string | null;
      artifactSha256?: string | null;
      scanState?: ACTAgentHubArtifactScanState | null;
      moderationState?: ACTAgentHubArtifactModerationState | null;
    }
  | {
      source: "actagenthub";
      artifactKind: "npm-pack";
      packageName: string;
      version: string;
      downloadUrl?: string | null;
      npmIntegrity: string;
      npmShasum?: string | null;
      artifactSha256?: string | null;
      scanState?: ACTAgentHubArtifactScanState | null;
      moderationState?: ACTAgentHubArtifactModerationState | null;
    };
export type ACTAgentHubPackageArtifactResolverResponse = {
  package?: {
    name?: string | null;
    displayName?: string | null;
    family?: ACTAgentHubPackageFamily | (string & {}) | null;
  } | null;
  version?:
    | ({
        version?: string | null;
        createdAt?: number | null;
        changelog?: string | null;
        distTags?: string[];
        files?: unknown[];
        sha256hash?: string | null;
        compatibility?: ACTAgentHubPackageCompatibility | null;
        artifact?: ACTAgentHubPackageArtifactSummary | null;
        actagentpack?: ACTAgentHubPackageactagentpackSummary | null;
      } & Record<string, unknown>)
    | string
    | null;
  artifact?: ACTAgentHubResolvedArtifact | null;
};
export type ACTAgentHubPackageSecurityResponse = {
  packageId?: string | null;
  releaseId?: string | null;
  state: ACTAgentHubPackageSecurityState;
  reasonCode?: string | null;
  moderatorNote?: string | null;
  actorId?: string | null;
  createdAt?: number | null;
  scanState?: ACTAgentHubArtifactScanState | null;
  moderationState?: ACTAgentHubArtifactModerationState | null;
};
export type ACTAgentHubPackageactagentpackSummary = {
  available: boolean;
  specVersion?: number | null;
  format?: string | null;
  sha256?: string | null;
  size?: number | null;
  fileCount?: number | null;
  manifestSha256?: string | null;
  npmIntegrity?: string | null;
  npmShasum?: string | null;
  npmTarballName?: string | null;
  builtAt?: number | null;
  buildVersion?: string | null;
  hostTargets?: ACTAgentHubPackageHostTarget[];
  environment?: ACTAgentHubPackageEnvironmentSummary | null;
  runtimeBundles?: unknown[];
};
export type ACTAgentHubPackageReadinessPhase =
  | "planned"
  | "published"
  | "actagentpack-ready"
  | "legacy-zip-only"
  | "metadata-ready"
  | "blocked"
  | "ready-for-actagent"
  | (string & {});
export type ACTAgentHubPackageReadiness = {
  ready?: boolean | null;
  readyForACTAgent?: boolean | null;
  installReady?: boolean | null;
  phase?: ACTAgentHubPackageReadinessPhase | null;
  status?: ACTAgentHubPackageReadinessPhase | null;
  package?: {
    name?: string | null;
    family?: ACTAgentHubPackageFamily | (string & {}) | null;
    channel?: ACTAgentHubPackageChannel | (string & {}) | null;
    isOfficial?: boolean | null;
  } | null;
  packageName?: string | null;
  artifactKind?: ACTAgentHubArtifactKind | (string & {}) | null;
  blockers?: string[];
  scanState?: ACTAgentHubArtifactScanState | null;
  moderationState?: ACTAgentHubArtifactModerationState | null;
};
export type ACTAgentHubPackageListItem = {
  name: string;
  displayName: string;
  family: ACTAgentHubPackageFamily;
  runtimeId?: string | null;
  channel: ACTAgentHubPackageChannel;
  isOfficial: boolean;
  summary?: string | null;
  ownerHandle?: string | null;
  createdAt: number;
  updatedAt: number;
  latestVersion?: string | null;
  capabilityTags?: string[];
  executesCode?: boolean;
  verificationTier?: string | null;
  actagentpackAvailable?: boolean;
  hostTargetKeys?: string[];
  environmentFlags?: string[];
  artifact?: ACTAgentHubPackageArtifactSummary | null;
  actagentpack?: ACTAgentHubPackageactagentpackSummary;
};
export type ACTAgentHubPackageDetail = {
  package:
    | (ACTAgentHubPackageListItem & {
        tags?: Record<string, string>;
        compatibility?: ACTAgentHubPackageCompatibility | null;
        capabilities?: {
          executesCode?: boolean;
          runtimeId?: string;
          capabilityTags?: string[];
          bundleFormat?: string;
          hostTargets?: string[];
          pluginKind?: string;
          channels?: string[];
          providers?: string[];
          hooks?: string[];
          bundledSkills?: string[];
        } | null;
        verification?: {
          tier?: string;
          scope?: string;
          summary?: string;
          sourceRepo?: string;
          sourceCommit?: string;
          hasProvenance?: boolean;
          scanStatus?: string;
        } | null;
        artifact?: ACTAgentHubPackageArtifactSummary | null;
        actagentpack?: ACTAgentHubPackageactagentpackSummary;
      })
    | null;
  owner?: {
    handle?: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
};

export type ACTAgentHubPackageVersion = {
  package: {
    name: string;
    displayName: string;
    family: ACTAgentHubPackageFamily;
  } | null;
  version: {
    version: string;
    createdAt: number;
    changelog: string;
    distTags?: string[];
    files?: Array<{
      path: string;
      size?: number;
      sha256: string;
      contentType?: string;
    }>;
    sha256hash?: string | null;
    compatibility?: ACTAgentHubPackageCompatibility | null;
    capabilities?: ACTAgentHubPackageDetail["package"] extends infer T
      ? T extends { capabilities?: infer C }
        ? C
        : never
      : never;
    verification?: ACTAgentHubPackageDetail["package"] extends infer T
      ? T extends { verification?: infer C }
        ? C
        : never
      : never;
    artifact?: ACTAgentHubPackageArtifactSummary | null;
    actagentpack?: ACTAgentHubPackageactagentpackSummary;
  } | null;
};

export type ACTAgentHubPackageSearchResult = {
  score: number;
  package: ACTAgentHubPackageListItem;
};

export type ACTAgentHubSkillSearchResult = {
  score: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
};

export type ACTAgentHubSkillDetail = {
  skill: {
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    createdAt: number;
    updatedAt: number;
  } | null;
  latestVersion?: {
    version: string;
    createdAt: number;
    changelog?: string;
  } | null;
  metadata?: {
    os?: string[] | null;
    systems?: string[] | null;
  } | null;
  owner?: {
    handle?: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
};

export type ACTAgentHubSkillInstallResolutionResponse =
  | {
      ok: true;
      slug: string;
      installKind: "archive";
      archive: {
        version: string;
        downloadUrl: string;
      };
    }
  | {
      ok: true;
      slug: string;
      installKind: "github";
      github: {
        repo: string;
        path: string;
        commit: string;
        contentHash: string;
        sourceUrl: string;
      };
    }
  | {
      ok: false;
      slug: string;
      reason: string;
      message: string;
      status: number;
    };

export type ACTAgentHubSkillVerificationDecision = "pass" | "fail" | (string & {});

export type ACTAgentHubSkillVerificationResponse = {
  schema: "actagenthub.skill.verify.v1";
  ok: boolean;
  decision: ACTAgentHubSkillVerificationDecision;
  reasons: string[];
  skill: unknown;
  publisher: unknown;
  version: unknown;
  card: unknown;
  artifact: unknown;
  provenance: unknown;
  security: unknown;
  signature: unknown;
};

export type ACTAgentHubSkillSecurityVerdictRequestItem = {
  slug: string;
  version: string;
};

export type ACTAgentHubSkillSecurityVerdictItem = {
  ok: boolean;
  decision: ACTAgentHubSkillVerificationDecision;
  reasons: string[];
  requestedSlug: string;
  requestedVersion: string;
  slug?: string | null;
  version?: string | null;
  displayName?: string | null;
  publisherHandle?: string | null;
  publisherDisplayName?: string | null;
  createdAt?: number | null;
  checkedAt?: number | null;
  skillUrl?: string | null;
  securityAuditUrl?: string | null;
  security?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

export type ACTAgentHubSkillSecurityVerdictsResponse = {
  schema: "actagenthub.skill.security-verdicts.v1";
  items: ACTAgentHubSkillSecurityVerdictItem[];
};

export type ACTAgentHubSkillListResponse = {
  items: Array<{
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    latestVersion?: {
      version: string;
      createdAt: number;
      changelog?: string;
    } | null;
    metadata?: {
      os?: string[] | null;
      systems?: string[] | null;
    } | null;
    createdAt: number;
    updatedAt: number;
  }>;
  nextCursor?: string | null;
};

export type ACTAgentHubDownloadResult = {
  archivePath: string;
  integrity: string;
  sha256Hex: string;
  artifact: "archive" | "actagentpack";
  actagentpackHeaderSha256?: string;
  actagentpackHeaderSpecVersion?: number;
  npmIntegrity?: string;
  npmShasum?: string;
  npmTarballName?: string;
  cleanup: () => Promise<void>;
};

export type ACTAgentHubInstallTelemetrySkill = {
  version?: string | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type ACTAgentHubRequestParams = {
  baseUrl?: string;
  path?: string;
  url?: string;
  method?: "GET" | "POST";
  json?: unknown;
  token?: string;
  timeoutMs?: number;
  search?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  skipAuth?: boolean;
};

type ACTAgentHubConfigLike = {
  token?: unknown;
  accessToken?: unknown;
  authToken?: unknown;
  apiToken?: unknown;
  auth?: ACTAgentHubConfigLike | null;
  session?: ACTAgentHubConfigLike | null;
  credentials?: ACTAgentHubConfigLike | null;
  user?: ACTAgentHubConfigLike | null;
};

export class ACTAgentHubRequestError extends Error {
  readonly status: number;
  readonly requestPath: string;
  readonly responseBody: string;

  constructor(params: { path: string; status: number; body: string }) {
    super(`ACTAgentHub ${params.path} failed (${params.status}): ${params.body}`);
    this.name = "ACTAgentHubRequestError";
    this.status = params.status;
    this.requestPath = params.path;
    this.responseBody = params.body;
  }
}

function normalizeBaseUrl(baseUrl?: string): string {
  const envValue =
    normalizeOptionalString(process.env.ACTAGENT_ACTAGENTHUB_URL) ||
    normalizeOptionalString(process.env.ACTAGENTHUB_URL) ||
    DEFAULT_ACTAGENTHUB_URL;
  const value = (normalizeOptionalString(baseUrl) || envValue).replace(/\/+$/, "");
  return value || DEFAULT_ACTAGENTHUB_URL;
}

function normalizeGitHubCodeloadBaseUrl(): string {
  const value =
    normalizeOptionalString(process.env.ACTAGENT_ACTAGENTHUB_GITHUB_CODELOAD_BASE_URL) ||
    normalizeOptionalString(process.env.ACTAGENTHUB_GITHUB_CODELOAD_BASE_URL) ||
    DEFAULT_GITHUB_CODELOAD_URL;
  return value.replace(/\/+$/, "") || DEFAULT_GITHUB_CODELOAD_URL;
}

function extractTokenFromACTAgentHubConfig(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as ACTAgentHubConfigLike;
  return (
    normalizeOptionalString(record.accessToken) ??
    normalizeOptionalString(record.authToken) ??
    normalizeOptionalString(record.apiToken) ??
    normalizeOptionalString(record.token) ??
    extractTokenFromACTAgentHubConfig(record.auth) ??
    extractTokenFromACTAgentHubConfig(record.session) ??
    extractTokenFromACTAgentHubConfig(record.credentials) ??
    extractTokenFromACTAgentHubConfig(record.user)
  );
}

function resolveACTAgentHubConfigPaths(): string[] {
  const explicit =
    normalizeOptionalString(process.env.ACTAGENT_ACTAGENTHUB_CONFIG_PATH) ||
    normalizeOptionalString(process.env.ACTAGENTHUB_CONFIG_PATH) ||
    normalizeOptionalString(process.env.actagentdHUB_CONFIG_PATH); // legacy misspelling from older actagenthub CLI builds; keep for back-compat
  if (explicit) {
    return [explicit];
  }

  const xdgConfigHome = normalizeOptionalString(process.env.XDG_CONFIG_HOME);
  const configHome =
    xdgConfigHome && xdgConfigHome.length > 0 ? xdgConfigHome : path.join(os.homedir(), ".config");
  const xdgPath = path.join(configHome, "actagenthub", "config.json");

  if (process.platform === "darwin") {
    return [
      path.join(os.homedir(), "Library", "Application Support", "actagenthub", "config.json"),
      xdgPath,
    ];
  }

  return [xdgPath];
}

export async function resolveACTAgentHubAuthToken(): Promise<string | undefined> {
  const envToken =
    normalizeOptionalString(process.env.ACTAGENT_ACTAGENTHUB_TOKEN) ||
    normalizeOptionalString(process.env.ACTAGENTHUB_TOKEN) ||
    normalizeOptionalString(process.env.ACTAGENTHUB_AUTH_TOKEN);
  if (envToken) {
    return envToken;
  }

  for (const configPath of resolveACTAgentHubConfigPaths()) {
    try {
      const raw = await fs.readFile(configPath, "utf8");
      const token = extractTokenFromACTAgentHubConfig(JSON.parse(raw));
      if (token) {
        return token;
      }
    } catch {
      // Try the next candidate path.
    }
  }
  return undefined;
}

function normalizePartialComparableVersion(version: string): {
  version: string;
  isPartial: boolean;
} {
  const trimmed = version.trim();
  return /^[vV]?[0-9]+\.[0-9]+$/.test(trimmed)
    ? { version: `${trimmed}.0`, isPartial: true }
    : { version: trimmed, isPartial: false };
}

function compareSemver(left: string, right: string): number | null {
  return compareComparableSemver(
    parseComparableSemver(normalizePartialComparableVersion(left).version),
    parseComparableSemver(normalizePartialComparableVersion(right).version),
  );
}

function upperBoundForCaret(version: string): string | null {
  const parsed = parseComparableSemver(normalizePartialComparableVersion(version).version);
  if (!parsed) {
    return null;
  }
  if (parsed.major > 0) {
    return `${parsed.major + 1}.0.0`;
  }
  if (parsed.minor > 0) {
    return `0.${parsed.minor + 1}.0`;
  }
  return `0.0.${parsed.patch + 1}`;
}

function matchWildcardComparator(token: string): "any" | "none" | null {
  const match = /^(>=|<=|>|<|=|\^|~)?\s*([*xX])$/.exec(token);
  if (!match) {
    return null;
  }
  const operator = match[1];
  return operator === ">" || operator === "<" ? "none" : "any";
}

function shouldPreservePluginApiPrereleaseFloor(target: string): boolean {
  return Boolean(
    parseComparableSemver(normalizePartialComparableVersion(target).version)?.prerelease?.length,
  );
}

function normalizePluginApiVersionForComparator(version: string, target: string): string {
  const normalizedCorrection = normalizeCalVerNumericCorrectionForPluginApi(version);
  if (normalizedCorrection) {
    return normalizedCorrection;
  }
  return shouldPreservePluginApiPrereleaseFloor(target)
    ? version
    : normalizeCalVerCorrectionForPluginApi(version);
}

function satisfiesComparator(version: string, token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) {
    return true;
  }
  const wildcard = matchWildcardComparator(trimmed);
  if (wildcard) {
    return wildcard === "any" && parseComparableSemver(version) != null;
  }
  if (trimmed.startsWith("^")) {
    const base = trimmed.slice(1).trim();
    const upperBound = upperBoundForCaret(base);
    const comparableVersion = normalizePluginApiVersionForComparator(version, base);
    const lowerCmp = compareSemver(comparableVersion, base);
    const upperCmp = upperBound ? compareSemver(comparableVersion, upperBound) : null;
    return lowerCmp != null && upperCmp != null && lowerCmp >= 0 && upperCmp < 0;
  }

  const match = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(trimmed);
  if (!match) {
    return false;
  }
  const operator = match[1];
  const target = match[2]?.trim();
  if (!target) {
    return false;
  }
  const comparableVersion = normalizePluginApiVersionForComparator(version, target);
  const normalizedTarget = normalizePartialComparableVersion(target);
  const cmp = compareSemver(comparableVersion, normalizedTarget.version);
  if (cmp == null) {
    return false;
  }
  switch (operator) {
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    default:
      return normalizedTarget.isPartial && !operator ? cmp >= 0 : cmp === 0;
  }
}

function satisfiesSemverRange(version: string, range: string): boolean {
  const tokens = normalizeStringEntries(range.trim().split(/\s+/));
  if (tokens.length === 0) {
    return false;
  }
  return tokens.every((token) => satisfiesComparator(version, token));
}

const ACTAGENT_CALVER_STABLE_CORRECTION_PATTERN =
  /^[vV]?(\d{4}\.\d{1,2}\.\d{1,2})(?:-\d+|-(?:alpha|beta|rc)\.\d+)$/i;
const ACTAGENT_CALVER_NUMERIC_CORRECTION_PATTERN = /^[vV]?(\d{4}\.\d{1,2}\.\d{1,2})-\d+$/;

function normalizeCalVerNumericCorrectionForPluginApi(
  pluginApiVersion: string,
): string | undefined {
  return ACTAGENT_CALVER_NUMERIC_CORRECTION_PATTERN.exec(pluginApiVersion.trim())?.[1];
}

function normalizeCalVerCorrectionForPluginApi(pluginApiVersion: string): string {
  const match = ACTAGENT_CALVER_STABLE_CORRECTION_PATTERN.exec(pluginApiVersion.trim());
  return match?.[1] ?? pluginApiVersion;
}

function buildUrl(params: Pick<ACTAgentHubRequestParams, "baseUrl" | "path" | "search" | "url">): URL {
  if (params.url) {
    const url = new URL(params.url, `${normalizeBaseUrl(params.baseUrl)}/`);
    for (const [key, value] of Object.entries(params.search ?? {})) {
      if (!value) {
        continue;
      }
      url.searchParams.set(key, value);
    }
    return url;
  }
  if (!params.path) {
    throw new Error("ACTAgentHub request path is required");
  }
  const url = new URL(`${normalizeBaseUrl(params.baseUrl)}/`);
  const basePath = url.pathname.replace(/\/+$/, "");
  const requestPath = params.path.startsWith("/") ? params.path : `/${params.path}`;
  url.pathname = `${basePath}${requestPath}`;
  for (const [key, value] of Object.entries(params.search ?? {})) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }
  return url;
}

async function actagenthubRequest(
  params: ACTAgentHubRequestParams,
): Promise<{ response: Response; url: URL; hasToken: boolean }> {
  const url = buildUrl(params);
  const token = params.skipAuth
    ? undefined
    : normalizeOptionalString(params.token) || (await resolveACTAgentHubAuthToken());
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(
          `ACTAgentHub request timed out after ${params.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS}ms`,
        ),
      ),
    params.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  );
  try {
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(params.json === undefined ? {} : { "Content-Type": "application/json" }),
    };
    const init: RequestInit = { signal: controller.signal };
    if (params.method) {
      init.method = params.method;
    }
    if (Object.keys(headers).length > 0) {
      init.headers = headers;
    }
    if (params.json !== undefined) {
      init.body = JSON.stringify(params.json);
    }
    const response = await (params.fetchImpl ?? fetch)(url, init);
    return { response, url, hasToken: Boolean(token) };
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    return text || response.statusText || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function buildACTAgentHubError(
  response: Response,
  url: URL,
  hasToken: boolean,
): Promise<ACTAgentHubRequestError> {
  let body = await readErrorBody(response);
  if (response.status === 429) {
    const suffix = formatRateLimitSuffix(response.headers, hasToken);
    if (suffix) {
      body = `${body} ${suffix}`;
    }
  }
  return new ACTAgentHubRequestError({
    path: url.pathname,
    status: response.status,
    body,
  });
}

function formatRateLimitSuffix(headers: Headers, hasToken: boolean): string {
  const reset =
    normalizeHeaderValue(headers.get("RateLimit-Reset")) ??
    normalizeHeaderValue(headers.get("Retry-After"));
  const segments: string[] = [];
  if (reset && Number.isFinite(Number(reset))) {
    segments.push(`(resets in ${reset}s)`);
  }
  if (!hasToken) {
    segments.push("Sign in for higher rate limits.");
  }
  return segments.join(" ");
}

async function fetchJson<T>(params: ACTAgentHubRequestParams): Promise<T> {
  const { response, url, hasToken } = await actagenthubRequest(params);
  if (!response.ok) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new Error(`ACTAgentHub ${url.pathname} returned malformed JSON`, { cause });
  }
}

async function readACTAgentHubResponseBytes(params: {
  response: Response;
  maxBytes?: number;
  timeoutMs?: number;
  resourceLabel: string;
}): Promise<Uint8Array> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  return await readResponseWithLimit(params.response, params.maxBytes ?? Number.MAX_SAFE_INTEGER, {
    chunkTimeoutMs: timeoutMs,
    onOverflow: ({ size, maxBytes }) =>
      new Error(
        `ACTAgentHub ${params.resourceLabel} exceeded ${maxBytes} bytes (${size} bytes received)`,
      ),
    onIdleTimeout: ({ chunkTimeoutMs }) =>
      new Error(`ACTAgentHub ${params.resourceLabel} body stalled after ${chunkTimeoutMs}ms`),
  });
}

/** Resolves the configured ACTAgentHub base URL, falling back to the default public host. */
export function resolveACTAgentHubBaseUrl(baseUrl?: string): string {
  return normalizeBaseUrl(baseUrl);
}

export function isDefaultACTAgentHubBaseUrl(baseUrl?: string): boolean {
  return normalizeBaseUrl(baseUrl) === normalizeBaseUrl(DEFAULT_ACTAGENTHUB_URL);
}

function buildVersionOrTagSearch(params: {
  version?: string;
  tag?: string;
}): { version?: string; tag?: string } | undefined {
  const version = normalizeOptionalString(params.version);
  if (version) {
    return { version };
  }
  const tag = normalizeOptionalString(params.tag);
  return tag ? { tag } : undefined;
}

function buildGitHubZipUrl(repo: string, commit: string): string {
  const url = new URL(`${normalizeGitHubCodeloadBaseUrl()}/`);
  const basePath = url.pathname.replace(/\/+$/, "");
  const repoPath = repo
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  url.pathname = `${basePath}/${repoPath}/zip/${encodeURIComponent(commit)}`;
  return url.toString();
}

function formatSha256Integrity(bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest("base64");
  return `sha256-${digest}`;
}

function formatSha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function formatSha512Integrity(bytes: Uint8Array): string {
  const digest = createHash("sha512").update(bytes).digest("base64");
  return `sha512-${digest}`;
}

function formatSha1Hex(bytes: Uint8Array): string {
  return createHash("sha1").update(bytes).digest("hex");
}

function normalizeHeaderValue(value: string | null): string | undefined {
  const normalized = normalizeOptionalString(value);
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function safePackageTarballName(name: string, version: string): string {
  const base = name
    .replace(/^@/, "")
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-");
  return `${base || "package"}-${version}.tgz`;
}

/** Normalizes ACTAgentHub SHA-256 metadata into Subresource Integrity format. */
export function normalizeACTAgentHubSha256Integrity(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const prefixedBase64 = /^sha256-([A-Za-z0-9+/]+={0,1})$/.exec(trimmed);
  if (prefixedBase64?.[1]) {
    try {
      const decoded = Buffer.from(prefixedBase64[1], "base64");
      if (decoded.length === 32) {
        return `sha256-${decoded.toString("base64")}`;
      }
    } catch {
      return null;
    }
    return null;
  }
  const prefixedHex = /^sha256:([A-Fa-f0-9]{64})$/.exec(trimmed);
  if (prefixedHex?.[1]) {
    return `sha256-${Buffer.from(prefixedHex[1], "hex").toString("base64")}`;
  }
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return `sha256-${Buffer.from(trimmed, "hex").toString("base64")}`;
  }
  return null;
}

/** Normalizes ACTAgentHub SHA-256 metadata into lowercase hex form. */
export function normalizeACTAgentHubSha256Hex(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return null;
  }
  return normalizeLowercaseStringOrEmpty(trimmed);
}

export async function fetchACTAgentHubPackageDetail(params: {
  name: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubPackageDetail> {
  return await fetchJson<ACTAgentHubPackageDetail>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function fetchACTAgentHubPackageVersion(params: {
  name: string;
  version: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubPackageVersion> {
  return await fetchJson<ACTAgentHubPackageVersion>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}/versions/${encodeURIComponent(
      params.version,
    )}`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function fetchACTAgentHubPackageArtifact(params: {
  name: string;
  version: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubPackageArtifactResolverResponse> {
  return await fetchJson<ACTAgentHubPackageArtifactResolverResponse>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}/versions/${encodeURIComponent(
      params.version,
    )}/artifact`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function fetchACTAgentHubPackageSecurity(params: {
  name: string;
  version: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubPackageSecurityResponse> {
  return await fetchJson<ACTAgentHubPackageSecurityResponse>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}/versions/${encodeURIComponent(
      params.version,
    )}/security`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function fetchACTAgentHubPackageReadiness(params: {
  name: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubPackageReadiness> {
  return await fetchJson<ACTAgentHubPackageReadiness>({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}/readiness`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function searchACTAgentHubPackages(params: {
  query: string;
  family?: ACTAgentHubPackageFamily;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<ACTAgentHubPackageSearchResult[]> {
  const result = await fetchJson<{ results: ACTAgentHubPackageSearchResult[] }>({
    baseUrl: params.baseUrl,
    path: "/api/v1/packages/search",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      q: params.query.trim(),
      family: params.family,
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
  return result.results ?? [];
}

export async function searchACTAgentHubSkills(params: {
  query: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<ACTAgentHubSkillSearchResult[]> {
  const result = await fetchJson<{ results: ACTAgentHubSkillSearchResult[] }>({
    baseUrl: params.baseUrl,
    path: "/api/v1/search",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      q: params.query.trim(),
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
  return result.results ?? [];
}

export async function fetchACTAgentHubSkillDetail(params: {
  slug: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubSkillDetail> {
  return await fetchJson<ACTAgentHubSkillDetail>({
    baseUrl: params.baseUrl,
    path: `/api/v1/skills/${encodeURIComponent(params.slug)}`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function fetchACTAgentHubSkillInstallResolution(params: {
  slug: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  forceInstall?: boolean;
}): Promise<ACTAgentHubSkillInstallResolutionResponse> {
  const { response, url, hasToken } = await actagenthubRequest({
    baseUrl: params.baseUrl,
    path: `/api/v1/skills/${encodeURIComponent(params.slug)}/install`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      forceInstall: params.forceInstall ? "1" : undefined,
    },
  });
  const isStructuredBlock = [403, 409, 410, 423].includes(response.status);
  if (!response.ok && !isStructuredBlock) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
  try {
    return (await response.json()) as ACTAgentHubSkillInstallResolutionResponse;
  } catch (cause) {
    throw new Error(`ACTAgentHub ${url.pathname} returned malformed JSON`, { cause });
  }
}

export async function fetchACTAgentHubSkillVerification(params: {
  slug: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubSkillVerificationResponse> {
  return await fetchJson<ACTAgentHubSkillVerificationResponse>({
    baseUrl: params.baseUrl,
    path: `/api/v1/skills/${encodeURIComponent(params.slug)}/verify`,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: buildVersionOrTagSearch(params),
  });
}

export async function fetchACTAgentHubSkillSecurityVerdicts(params: {
  items: ACTAgentHubSkillSecurityVerdictRequestItem[];
  baseUrl?: string;
  token?: string;
  skipAuth?: boolean;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubSkillSecurityVerdictsResponse> {
  return await fetchJson<ACTAgentHubSkillSecurityVerdictsResponse>({
    baseUrl: params.baseUrl,
    path: "/api/v1/skills/-/security-verdicts",
    method: "POST",
    json: { items: params.items },
    token: params.token,
    skipAuth: params.skipAuth,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function fetchACTAgentHubSkillCard(params: {
  slug?: string;
  url?: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const cardUrl = normalizeOptionalString(params.url);
  const slug = normalizeOptionalString(params.slug);
  if (!cardUrl && !slug) {
    throw new Error("ACTAgentHub skill card fetch requires a slug or card URL");
  }
  const explicitToken = normalizeOptionalString(params.token);
  const skipAuth =
    cardUrl != null &&
    explicitToken == null &&
    new URL(cardUrl, `${normalizeBaseUrl(params.baseUrl)}/`).origin !==
      new URL(`${normalizeBaseUrl(params.baseUrl)}/`).origin;
  const { response, url, hasToken } = await actagenthubRequest({
    baseUrl: params.baseUrl,
    url: cardUrl,
    path: slug ? `/api/v1/skills/${encodeURIComponent(slug)}/card` : undefined,
    token: explicitToken,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: cardUrl ? undefined : buildVersionOrTagSearch(params),
    skipAuth,
  });
  if (!response.ok) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
  const bytes = await readACTAgentHubResponseBytes({
    response,
    maxBytes: SKILL_CARD_MAX_BYTES,
    timeoutMs: params.timeoutMs,
    resourceLabel: slug ? `skill card for ${slug}` : `skill card at ${url.pathname}`,
  });
  return new TextDecoder().decode(bytes);
}

export async function listACTAgentHubSkills(params: {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  limit?: number;
}): Promise<ACTAgentHubSkillListResponse> {
  return await fetchJson<ACTAgentHubSkillListResponse>({
    baseUrl: params.baseUrl,
    path: "/api/v1/skills",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
}

export async function downloadACTAgentHubPackageArchive(params: {
  name: string;
  version?: string;
  tag?: string;
  artifact?: "archive" | "actagentpack";
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubDownloadResult> {
  if (params.artifact === "actagentpack") {
    if (!params.version) {
      throw new Error("actagentpack package downloads require an explicit version.");
    }
    const { response, url, hasToken } = await actagenthubRequest({
      baseUrl: params.baseUrl,
      path: `/api/v1/packages/${encodeURIComponent(params.name)}/versions/${encodeURIComponent(
        params.version,
      )}/artifact/download`,
      token: params.token,
      timeoutMs: params.timeoutMs,
      fetchImpl: params.fetchImpl,
    });
    if (!response.ok) {
      throw await buildACTAgentHubError(response, url, hasToken);
    }
    const bytes = await readACTAgentHubResponseBytes({
      response,
      timeoutMs: params.timeoutMs,
      resourceLabel: `actagentpack download for ${params.name}@${params.version}`,
    });
    const sha256Hex = formatSha256Hex(bytes);
    const npmIntegrity = formatSha512Integrity(bytes);
    const npmShasum = formatSha1Hex(bytes);
    const headerSha256 = normalizeACTAgentHubSha256Hex(
      response.headers.get("X-ACTAgentHub-Artifact-Sha256") ??
        response.headers.get("X-ACTAgentHub-actagentpack-Sha256") ??
        "",
    );
    if (!headerSha256) {
      throw new Error(
        `ACTAgentHub actagentpack download for "${params.name}@${params.version}" is missing X-ACTAgentHub-Artifact-Sha256.`,
      );
    }
    if (headerSha256 !== sha256Hex) {
      throw new Error(
        `ACTAgentHub actagentpack download for "${params.name}@${params.version}" declared sha256 ${headerSha256}, got ${sha256Hex}.`,
      );
    }
    const headerNpmIntegrity = normalizeHeaderValue(
      response.headers.get("X-ACTAgentHub-Npm-Integrity"),
    );
    if (headerNpmIntegrity && headerNpmIntegrity !== npmIntegrity) {
      throw new Error(
        `ACTAgentHub actagentpack download for "${params.name}@${params.version}" declared npm integrity ${headerNpmIntegrity}, got ${npmIntegrity}.`,
      );
    }
    const headerNpmShasum = normalizeHeaderValue(response.headers.get("X-ACTAgentHub-Npm-Shasum"));
    if (headerNpmShasum && headerNpmShasum !== npmShasum) {
      throw new Error(
        `ACTAgentHub actagentpack download for "${params.name}@${params.version}" declared npm shasum ${headerNpmShasum}, got ${npmShasum}.`,
      );
    }
    const npmTarballName =
      normalizeHeaderValue(response.headers.get("X-ACTAgentHub-Npm-Tarball-Name")) ??
      safePackageTarballName(params.name, params.version);
    const rawSpecVersion = response.headers.get("X-ACTAgentHub-actagentpack-Spec-Version");
    const specVersion = parseStrictPositiveInteger(rawSpecVersion);
    const target = await createTempDownloadTarget({
      prefix: "actagent-actagenthub-actagentpack",
      fileName: npmTarballName,
      tmpDir: os.tmpdir(),
    });
    await fs.writeFile(target.path, bytes);
    return {
      archivePath: target.path,
      integrity: normalizeACTAgentHubSha256Integrity(sha256Hex) ?? formatSha256Integrity(bytes),
      sha256Hex,
      artifact: "actagentpack",
      actagentpackHeaderSha256: headerSha256,
      ...(typeof specVersion === "number" && Number.isSafeInteger(specVersion) && specVersion >= 0
        ? { actagentpackHeaderSpecVersion: specVersion }
        : {}),
      npmIntegrity,
      npmShasum,
      npmTarballName,
      cleanup: target.cleanup,
    };
  }
  const search = params.version
    ? { version: params.version }
    : params.tag
      ? { tag: params.tag }
      : undefined;
  const { response, url, hasToken } = await actagenthubRequest({
    baseUrl: params.baseUrl,
    path: `/api/v1/packages/${encodeURIComponent(params.name)}/download`,
    search,
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  if (!response.ok) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
  const bytes = await readACTAgentHubResponseBytes({
    response,
    timeoutMs: params.timeoutMs,
    resourceLabel: `package archive download for ${params.name}`,
  });
  const sha256Hex = formatSha256Hex(bytes);
  const target = await createTempDownloadTarget({
    prefix: "actagent-actagenthub-package",
    fileName: `${params.name}.zip`,
    tmpDir: os.tmpdir(),
  });
  await fs.writeFile(target.path, bytes);
  return {
    archivePath: target.path,
    integrity: formatSha256Integrity(bytes),
    sha256Hex,
    artifact: "archive",
    cleanup: target.cleanup,
  };
}

export async function downloadACTAgentHubSkillArchive(params: {
  slug: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubDownloadResult> {
  const { response, url, hasToken } = await actagenthubRequest({
    baseUrl: params.baseUrl,
    path: "/api/v1/download",
    token: params.token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      slug: params.slug,
      version: params.version,
      tag: params.version ? undefined : params.tag,
    },
  });
  if (!response.ok) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
  const bytes = await readACTAgentHubResponseBytes({
    response,
    timeoutMs: params.timeoutMs,
    resourceLabel: `skill archive download for ${params.slug}`,
  });
  const sha256Hex = formatSha256Hex(bytes);
  const target = await createTempDownloadTarget({
    prefix: "actagent-actagenthub-skill",
    fileName: `${params.slug}.zip`,
    tmpDir: os.tmpdir(),
  });
  await fs.writeFile(target.path, bytes);
  return {
    archivePath: target.path,
    integrity: formatSha256Integrity(bytes),
    sha256Hex,
    artifact: "archive",
    cleanup: target.cleanup,
  };
}

export async function downloadACTAgentHubSkillArchiveUrl(params: {
  url: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubDownloadResult> {
  const explicitToken = normalizeOptionalString(params.token);
  const requestUrl = new URL(params.url, `${normalizeBaseUrl(params.baseUrl)}/`);
  const registryOrigin = new URL(`${normalizeBaseUrl(params.baseUrl)}/`).origin;
  const skipAuth = explicitToken == null && requestUrl.origin !== registryOrigin;
  const { response, url, hasToken } = await actagenthubRequest({
    baseUrl: params.baseUrl,
    url: params.url,
    token: explicitToken,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    skipAuth,
  });
  if (!response.ok) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
  const bytes = await readACTAgentHubResponseBytes({
    response,
    timeoutMs: params.timeoutMs,
    resourceLabel: `skill archive download at ${url.pathname}`,
  });
  const sha256Hex = formatSha256Hex(bytes);
  const target = await createTempDownloadTarget({
    prefix: "actagent-actagenthub-skill",
    fileName: "skill.zip",
    tmpDir: os.tmpdir(),
  });
  await fs.writeFile(target.path, bytes);
  return {
    archivePath: target.path,
    integrity: formatSha256Integrity(bytes),
    sha256Hex,
    artifact: "archive",
    cleanup: target.cleanup,
  };
}

export async function downloadACTAgentHubGitHubSkillArchive(params: {
  repo: string;
  commit: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ACTAgentHubDownloadResult> {
  const downloadUrl = buildGitHubZipUrl(params.repo, params.commit);
  const { response, url, hasToken } = await actagenthubRequest({
    url: downloadUrl,
    skipAuth: true,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  if (!response.ok) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
  const bytes = await readACTAgentHubResponseBytes({
    response,
    timeoutMs: params.timeoutMs,
    resourceLabel: `GitHub source archive for ${params.repo}@${params.commit}`,
  });
  const sha256Hex = formatSha256Hex(bytes);
  const target = await createTempDownloadTarget({
    prefix: "actagent-actagenthub-github-skill",
    fileName: `${params.commit}.zip`,
    tmpDir: os.tmpdir(),
  });
  await fs.writeFile(target.path, bytes);
  return {
    archivePath: target.path,
    integrity: formatSha256Integrity(bytes),
    sha256Hex,
    artifact: "archive",
    cleanup: target.cleanup,
  };
}

export async function reportACTAgentHubSkillInstallTelemetry(params: {
  baseUrl?: string;
  token?: string;
  root: string;
  skills: Record<string, ACTAgentHubInstallTelemetrySkill>;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<void> {
  const token = normalizeOptionalString(params.token) ?? (await resolveACTAgentHubAuthToken());
  if (!token || isACTAgentHubTelemetryDisabled()) {
    return;
  }
  const skills = Object.entries(params.skills)
    .map(([slug, entry]) => ({
      slug,
      version: entry.version ?? null,
    }))
    .filter((entry) => entry.slug.length > 0);

  const { response, url, hasToken } = await actagenthubRequest({
    baseUrl: params.baseUrl,
    path: "/api/cli/telemetry/install",
    method: "POST",
    token,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    json: {
      roots: [
        {
          rootId: createHash("sha256").update(path.resolve(params.root)).digest("hex"),
          label: formatTelemetryRootLabel(params.root),
          skills,
        },
      ],
    },
  });
  if (!response.ok) {
    throw await buildACTAgentHubError(response, url, hasToken);
  }
}

function isACTAgentHubTelemetryDisabled(): boolean {
  const raw = process.env.ACTAGENTHUB_DISABLE_TELEMETRY ?? process.env.actagentdHUB_DISABLE_TELEMETRY;
  if (!raw) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function formatTelemetryRootLabel(root: string): string {
  const home = os.homedir();
  const absolute = path.resolve(root);
  if (absolute === home) {
    return "~";
  }
  const normalized = absolute.replaceAll("\\", "/");
  const normalizedHome = home.replaceAll("\\", "/");
  const withinHome = normalized.startsWith(`${normalizedHome}/`);
  const stripped = withinHome ? normalized.slice(normalizedHome.length + 1) : normalized;
  const tail = stripped.split("/").filter(Boolean).slice(-2).join("/");
  return withinHome ? `~/${tail}` : tail || absolute;
}

/** Resolves the preferred latest package version from detail metadata. */
export function resolveLatestVersionFromPackage(detail: ACTAgentHubPackageDetail): string | null {
  return detail.package?.latestVersion ?? detail.package?.tags?.latest ?? null;
}

/** Detects package or skill detail payloads that represent skill-family packages. */
export function isACTAgentHubFamilySkill(detail: ACTAgentHubPackageDetail | ACTAgentHubSkillDetail): boolean {
  if ("package" in detail) {
    return detail.package?.family === "skill";
  }
  return Boolean(detail.skill);
}

/** Checks whether a host plugin API version satisfies a ACTAgentHub plugin API range. */
export function satisfiesPluginApiRange(
  pluginApiVersion: string,
  pluginApiRange?: string | null,
): boolean {
  if (!pluginApiRange) {
    return true;
  }
  return satisfiesSemverRange(pluginApiVersion, pluginApiRange);
}

/** Checks whether the current gateway version satisfies a package minimum gateway version. */
export function satisfiesGatewayMinimum(
  currentVersion: string,
  minGatewayVersion?: string | null,
): boolean {
  if (!minGatewayVersion) {
    return true;
  }
  const current = parseSemver(currentVersion);
  const minimum = parseSemver(minGatewayVersion);
  if (!current || !minimum) {
    return false;
  }
  return isAtLeast(current, minimum);
}
