// ACTAgentHub lifecycle helpers fetch skill registry metadata and package details.
import fsSync from "node:fs";
import path from "node:path";
import type { ACTAgentConfig } from "../../config/types.actagent.js";
import {
  downloadACTAgentHubGitHubSkillArchive,
  downloadACTAgentHubSkillArchive,
  downloadACTAgentHubSkillArchiveUrl,
  fetchACTAgentHubSkillDetail,
  fetchACTAgentHubSkillInstallResolution,
  isDefaultACTAgentHubBaseUrl,
  reportACTAgentHubSkillInstallTelemetry,
  resolveACTAgentHubBaseUrl,
  searchACTAgentHubSkills,
  type ACTAgentHubSkillDetail,
  type ACTAgentHubSkillInstallResolutionResponse,
  type ACTAgentHubSkillSearchResult,
} from "../../infra/actagenthub.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { pathExists } from "../../infra/fs-safe.js";
import { withExtractedArchiveRoot } from "../../infra/install-flow.js";
import { readJsonIfExists, tryReadJson, writeJson } from "../../infra/json-files.js";
import {
  ACTAGENTHUB_SKILL_ARCHIVE_ROOT_MARKERS,
  installExtractedSkillRoot,
  normalizeTrackedSkillSlug,
  resolveWorkspaceSkillInstallDir,
  validateRequestedSkillSlug,
} from "./archive-install.js";

const DOT_DIR = ".actagenthub";
const LEGACY_DOT_DIR = ".actagentdhub";
const SKILL_ORIGIN_RELATIVE_PATH = path.join(DOT_DIR, "origin.json");
const LOCAL_SKILL_CARD_FILENAME = "skill-card.md";
const LOCAL_SKILL_CARD_MAX_BYTES = 256 * 1024;

export type ACTAgentHubSkillOrigin = {
  version: 1;
  registry: string;
  slug: string;
  installedVersion: string;
  installedAt: number;
};

export type ACTAgentHubSkillsLockfile = {
  version: 1;
  skills: Record<
    string,
    {
      version: string;
      installedAt: number;
      registry?: string;
    }
  >;
};

export type ACTAgentHubSkillsLockfileStatusRead =
  | { kind: "found"; lock: ACTAgentHubSkillsLockfile; path: string }
  | { kind: "missing" }
  | { kind: "malformed"; path: string; error: string };

export type ACTAgentHubSkillStatusLink =
  | {
      status: "linked";
      valid: true;
      registry: string;
      slug: string;
      installedVersion: string;
      installedAt: number;
      originPath: string;
      lockPath: string;
    }
  | {
      status: "invalid";
      valid: false;
      reason: string;
      registry?: string;
      slug?: string;
      installedVersion?: string;
      installedAt?: number;
      originPath?: string;
      lockPath?: string;
    };

export type LocalSkillCardStatus = {
  present: true;
  path: string;
  sizeBytes: number;
};

type LocalSkillCardRead = LocalSkillCardStatus & {
  content?: string;
};

export type InstallACTAgentHubSkillResult =
  | {
      ok: true;
      slug: string;
      version: string;
      targetDir: string;
      detail?: ACTAgentHubSkillDetail;
    }
  | { ok: false; error: string };

export type UpdateACTAgentHubSkillResult =
  | {
      ok: true;
      slug: string;
      previousVersion: string | null;
      version: string;
      changed: boolean;
      targetDir: string;
    }
  | { ok: false; error: string };

type Logger = {
  info?: (message: string) => void;
};

async function resolveRequestedUpdateSlug(params: {
  workspaceDir: string;
  requestedSlug: string;
  lock: ACTAgentHubSkillsLockfile;
}): Promise<string> {
  const trackedSlug = normalizeTrackedSkillSlug(params.requestedSlug);
  const trackedTargetDir = resolveWorkspaceSkillInstallDir(params.workspaceDir, trackedSlug);
  const trackedOrigin = await readACTAgentHubSkillOrigin(trackedTargetDir);
  if (trackedOrigin || params.lock.skills[trackedSlug]) {
    return trackedSlug;
  }
  return validateRequestedSkillSlug(params.requestedSlug);
}

type ACTAgentHubInstallParams = {
  workspaceDir: string;
  slug: string;
  version?: string;
  baseUrl?: string;
  force?: boolean;
  forceInstall?: boolean;
  logger?: Logger;
  config?: ACTAgentConfig;
};

type TrackedUpdateTarget =
  | {
      ok: true;
      slug: string;
      baseUrl?: string;
      previousVersion: string | null;
    }
  | {
      ok: false;
      slug: string;
      error: string;
    };

export type ACTAgentHubSkillVerificationResolutionSource = "installed" | "registry";
export type ACTAgentHubSkillVerificationSelector = "installed-version" | "version" | "tag" | "latest";

export type ACTAgentHubSkillVerificationTargetResult =
  | {
      ok: true;
      slug: string;
      baseUrl: string;
      version: string | undefined;
      tag: string | undefined;
      resolution: {
        source: ACTAgentHubSkillVerificationResolutionSource;
        selector: ACTAgentHubSkillVerificationSelector;
        registry: string;
        skillDir: string | undefined;
        installedVersion: string | undefined;
      };
    }
  | {
      ok: false;
      error: string;
    };

export async function readACTAgentHubSkillsLockfile(
  workspaceDir: string,
): Promise<ACTAgentHubSkillsLockfile> {
  const candidates = [
    path.join(workspaceDir, DOT_DIR, "lock.json"),
    path.join(workspaceDir, LEGACY_DOT_DIR, "lock.json"),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await tryReadJson<Partial<ACTAgentHubSkillsLockfile>>(candidate);
      if (raw?.version === 1 && raw.skills && typeof raw.skills === "object") {
        return {
          version: 1,
          skills: raw.skills,
        };
      }
    } catch {
      // ignore
    }
  }
  return { version: 1, skills: {} };
}

async function writeACTAgentHubSkillsLockfile(
  workspaceDir: string,
  lockfile: ACTAgentHubSkillsLockfile,
): Promise<void> {
  const targetPath = path.join(workspaceDir, DOT_DIR, "lock.json");
  await writeJson(targetPath, lockfile, { trailingNewline: true });
}

function readJsonIfExistsSync(
  candidate: string,
): { exists: false } | { exists: true; value: unknown } {
  try {
    return { exists: true, value: JSON.parse(fsSync.readFileSync(candidate, "utf8")) };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return { exists: false };
    }
    throw err;
  }
}

function normalizeStoredRegistry(registry: string): string {
  const trimmed = registry.trim();
  return trimmed.replace(/\/+$/, "") || trimmed;
}

function readRealPathSync(candidate: string): string | undefined {
  try {
    return fsSync.realpathSync.native(candidate);
  } catch {
    return undefined;
  }
}

export function readACTAgentHubSkillsLockfileStatusSync(
  workspaceDir: string,
): ACTAgentHubSkillsLockfileStatusRead {
  const candidates = [
    path.join(workspaceDir, DOT_DIR, "lock.json"),
    path.join(workspaceDir, LEGACY_DOT_DIR, "lock.json"),
  ];
  for (const candidate of candidates) {
    let raw: Partial<ACTAgentHubSkillsLockfile> | null;
    try {
      const read = readJsonIfExistsSync(candidate);
      if (!read.exists) {
        continue;
      }
      raw = read.value as Partial<ACTAgentHubSkillsLockfile>;
    } catch (err) {
      return {
        kind: "malformed",
        path: candidate,
        error: formatErrorMessage(err),
      };
    }
    if (raw?.version === 1 && raw.skills && typeof raw.skills === "object") {
      return {
        kind: "found",
        path: candidate,
        lock: {
          version: 1,
          skills: raw.skills,
        },
      };
    }
    return {
      kind: "malformed",
      path: candidate,
      error: "expected version 1 lockfile with skills",
    };
  }
  return { kind: "missing" };
}

function normalizeOptionalSelector(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeACTAgentHubSkillOrigin(
  raw: Partial<ACTAgentHubSkillOrigin> | null,
): ACTAgentHubSkillOrigin | null {
  if (
    raw?.version === 1 &&
    typeof raw.registry === "string" &&
    raw.registry.trim().length > 0 &&
    typeof raw.slug === "string" &&
    raw.slug.trim().length > 0 &&
    typeof raw.installedVersion === "string" &&
    raw.installedVersion.trim().length > 0 &&
    typeof raw.installedAt === "number"
  ) {
    return {
      version: 1,
      registry: normalizeStoredRegistry(raw.registry),
      slug: raw.slug,
      installedVersion: raw.installedVersion,
      installedAt: raw.installedAt,
    };
  }
  return null;
}

async function readACTAgentHubSkillOrigin(skillDir: string): Promise<ACTAgentHubSkillOrigin | null> {
  const candidates = [
    path.join(skillDir, DOT_DIR, "origin.json"),
    path.join(skillDir, LEGACY_DOT_DIR, "origin.json"),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await tryReadJson<Partial<ACTAgentHubSkillOrigin>>(candidate);
      const origin = normalizeACTAgentHubSkillOrigin(raw);
      if (origin) {
        return origin;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function readACTAgentHubSkillOriginStatusSync(skillDir: string): StrictOriginReadResult {
  const candidates = [
    path.join(skillDir, DOT_DIR, "origin.json"),
    path.join(skillDir, LEGACY_DOT_DIR, "origin.json"),
  ];
  for (const candidate of candidates) {
    let raw: Partial<ACTAgentHubSkillOrigin> | null;
    try {
      const read = readJsonIfExistsSync(candidate);
      if (!read.exists) {
        continue;
      }
      raw = read.value as Partial<ACTAgentHubSkillOrigin>;
    } catch (err) {
      return {
        kind: "malformed",
        path: candidate,
        error: formatErrorMessage(err),
      };
    }
    const origin = normalizeACTAgentHubSkillOrigin(raw);
    if (origin) {
      return { kind: "found", origin, path: candidate };
    }
    return {
      kind: "malformed",
      path: candidate,
      error: "expected version 1 origin with registry, slug, installedVersion, and installedAt",
    };
  }
  return { kind: "missing" };
}

type StrictOriginReadResult =
  | { kind: "found"; origin: ACTAgentHubSkillOrigin; path: string }
  | { kind: "missing" }
  | { kind: "malformed"; path: string; error: string };

async function readACTAgentHubSkillOriginStrict(skillDir: string): Promise<StrictOriginReadResult> {
  const candidates = [
    path.join(skillDir, DOT_DIR, "origin.json"),
    path.join(skillDir, LEGACY_DOT_DIR, "origin.json"),
  ];
  for (const candidate of candidates) {
    let raw: Partial<ACTAgentHubSkillOrigin> | null;
    try {
      raw = await readJsonIfExists<Partial<ACTAgentHubSkillOrigin>>(candidate);
    } catch (err) {
      return {
        kind: "malformed",
        path: candidate,
        error: formatErrorMessage(err),
      };
    }
    if (!raw) {
      continue;
    }
    const origin = normalizeACTAgentHubSkillOrigin(raw);
    if (origin) {
      return { kind: "found", origin, path: candidate };
    }
    return {
      kind: "malformed",
      path: candidate,
      error: "expected version 1 origin with registry, slug, installedVersion, and installedAt",
    };
  }
  return { kind: "missing" };
}

export function resolveACTAgentHubSkillStatusLinkSync(params: {
  workspaceDir: string;
  skillDir: string;
  skillKey: string;
  lockRead?: ACTAgentHubSkillsLockfileStatusRead;
}): ACTAgentHubSkillStatusLink | undefined {
  const originRead = readACTAgentHubSkillOriginStatusSync(params.skillDir);
  const lockRead = params.lockRead ?? readACTAgentHubSkillsLockfileStatusSync(params.workspaceDir);

  if (originRead.kind === "missing") {
    let trackedSlug: string;
    try {
      trackedSlug = normalizeTrackedSkillSlug(params.skillKey);
    } catch {
      return undefined;
    }
    const locked = lockRead.kind === "found" ? lockRead.lock.skills[trackedSlug] : undefined;
    if (!locked) {
      return undefined;
    }
    return {
      status: "invalid",
      valid: false,
      reason: `Skill "${trackedSlug}" is tracked by the workspace ACTAgentHub lockfile but is missing local ACTAgentHub origin metadata.`,
      slug: trackedSlug,
      installedVersion: locked.version,
      installedAt: locked.installedAt,
      registry: normalizeStoredRegistry(locked.registry ?? resolveACTAgentHubBaseUrl()),
      lockPath: lockRead.kind === "found" ? lockRead.path : undefined,
    };
  }

  if (originRead.kind === "malformed") {
    return {
      status: "invalid",
      valid: false,
      reason: `Malformed ACTAgentHub origin metadata at ${originRead.path}: ${originRead.error}`,
      originPath: originRead.path,
      lockPath: lockRead.kind === "found" ? lockRead.path : undefined,
    };
  }

  let trackedSlug: string;
  try {
    trackedSlug = normalizeTrackedSkillSlug(originRead.origin.slug);
  } catch (err) {
    return {
      status: "invalid",
      valid: false,
      reason: `Invalid ACTAgentHub origin slug "${originRead.origin.slug}": ${formatErrorMessage(err)}`,
      registry: originRead.origin.registry,
      slug: originRead.origin.slug,
      installedVersion: originRead.origin.installedVersion,
      installedAt: originRead.origin.installedAt,
      originPath: originRead.path,
      lockPath: lockRead.kind === "found" ? lockRead.path : undefined,
    };
  }

  if (lockRead.kind === "missing") {
    return {
      status: "invalid",
      valid: false,
      reason: `Skill "${trackedSlug}" has ACTAgentHub origin metadata but is not tracked by the workspace ACTAgentHub lockfile.`,
      registry: originRead.origin.registry,
      slug: trackedSlug,
      installedVersion: originRead.origin.installedVersion,
      installedAt: originRead.origin.installedAt,
      originPath: originRead.path,
    };
  }
  if (lockRead.kind === "malformed") {
    return {
      status: "invalid",
      valid: false,
      reason: `Malformed workspace ACTAgentHub lockfile at ${lockRead.path}: ${lockRead.error}`,
      registry: originRead.origin.registry,
      slug: trackedSlug,
      installedVersion: originRead.origin.installedVersion,
      installedAt: originRead.origin.installedAt,
      originPath: originRead.path,
      lockPath: lockRead.path,
    };
  }
  const locked = lockRead.lock.skills[trackedSlug];
  if (!locked) {
    return {
      status: "invalid",
      valid: false,
      reason: `Skill "${trackedSlug}" has ACTAgentHub origin metadata but is not tracked by the workspace ACTAgentHub lockfile.`,
      registry: originRead.origin.registry,
      slug: trackedSlug,
      installedVersion: originRead.origin.installedVersion,
      installedAt: originRead.origin.installedAt,
      originPath: originRead.path,
      lockPath: lockRead.path,
    };
  }
  const expectedSkillDir = resolveWorkspaceSkillInstallDir(params.workspaceDir, trackedSlug);
  const expectedSkillDirRealPath = readRealPathSync(expectedSkillDir);
  const actualSkillDirRealPath = readRealPathSync(params.skillDir);
  if (!expectedSkillDirRealPath || actualSkillDirRealPath !== expectedSkillDirRealPath) {
    return {
      status: "invalid",
      valid: false,
      reason: `Skill "${trackedSlug}" ACTAgentHub origin metadata is not in the expected ACTAgentHub install directory.`,
      registry: originRead.origin.registry,
      slug: trackedSlug,
      installedVersion: originRead.origin.installedVersion,
      installedAt: originRead.origin.installedAt,
      originPath: originRead.path,
      lockPath: lockRead.path,
    };
  }
  const originRegistry = normalizeStoredRegistry(originRead.origin.registry);
  const lockedRegistry =
    locked.registry === undefined ? originRegistry : normalizeStoredRegistry(locked.registry);
  if (
    locked.version !== originRead.origin.installedVersion ||
    locked.installedAt !== originRead.origin.installedAt ||
    lockedRegistry !== originRegistry
  ) {
    return {
      status: "invalid",
      valid: false,
      reason: `Skill "${trackedSlug}" ACTAgentHub origin metadata does not match the workspace ACTAgentHub lockfile.`,
      registry: lockedRegistry,
      slug: trackedSlug,
      installedVersion: originRead.origin.installedVersion,
      installedAt: originRead.origin.installedAt,
      originPath: originRead.path,
      lockPath: lockRead.path,
    };
  }
  return {
    status: "linked",
    valid: true,
    registry: lockedRegistry,
    slug: trackedSlug,
    installedVersion: locked.version,
    installedAt: locked.installedAt,
    originPath: originRead.path,
    lockPath: lockRead.path,
  };
}

export function resolveLocalSkillCardStatusSync(
  skillDir: string,
): LocalSkillCardStatus | undefined {
  return readLocalSkillCardSync(skillDir);
}

function isPathInsideDir(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function readLocalSkillCardSync(
  skillDir: string,
  includeContent = false,
): LocalSkillCardRead | undefined {
  const cardPath = path.join(skillDir, LOCAL_SKILL_CARD_FILENAME);
  let lstat: fsSync.Stats;
  try {
    lstat = fsSync.lstatSync(cardPath);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return undefined;
    }
    return undefined;
  }
  if (!lstat.isFile() || lstat.size > LOCAL_SKILL_CARD_MAX_BYTES) {
    return undefined;
  }
  let fd: number | undefined;
  try {
    const rootRealPath = fsSync.realpathSync.native(skillDir);
    const cardRealPath = fsSync.realpathSync.native(cardPath);
    if (!isPathInsideDir(cardRealPath, rootRealPath)) {
      return undefined;
    }
    const noFollowFlag = fsSync.constants.O_NOFOLLOW ?? 0;
    fd = fsSync.openSync(cardPath, fsSync.constants.O_RDONLY | noFollowFlag);
    const fdStat = fsSync.fstatSync(fd);
    if (!fdStat.isFile() || fdStat.size > LOCAL_SKILL_CARD_MAX_BYTES) {
      return undefined;
    }
    const result: LocalSkillCardRead = {
      present: true,
      path: cardPath,
      sizeBytes: fdStat.size,
    };
    if (includeContent) {
      result.content = fsSync.readFileSync(fd, "utf8");
    }
    return result;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) {
      try {
        fsSync.closeSync(fd);
      } catch {
        // ignore close errors while reporting the card as unavailable
      }
    }
  }
}

export function readLocalSkillCardContentSync(skillDir: string): string | undefined {
  return readLocalSkillCardSync(skillDir, true)?.content;
}

async function writeACTAgentHubSkillOrigin(
  skillDir: string,
  origin: ACTAgentHubSkillOrigin,
): Promise<void> {
  const targetPath = path.join(skillDir, SKILL_ORIGIN_RELATIVE_PATH);
  await writeJson(targetPath, origin, { trailingNewline: true });
}

export async function searchSkillsFromACTAgentHub(params: {
  query?: string;
  limit?: number;
  baseUrl?: string;
}): Promise<ACTAgentHubSkillSearchResult[]> {
  return await searchACTAgentHubSkills({
    query: params.query?.trim() || "*",
    limit: params.limit,
    baseUrl: params.baseUrl,
  });
}

export async function resolveACTAgentHubSkillVerificationTarget(params: {
  workspaceDir: string;
  slug: string;
  version?: string;
  tag?: string;
  baseUrl?: string;
}): Promise<ACTAgentHubSkillVerificationTargetResult> {
  try {
    const version = normalizeOptionalSelector(params.version);
    const tag = normalizeOptionalSelector(params.tag);
    if (version && tag) {
      return { ok: false, error: "Use either --version or --tag." };
    }

    const trackedSlug = normalizeTrackedSkillSlug(params.slug);
    const skillDir = resolveWorkspaceSkillInstallDir(params.workspaceDir, trackedSlug);
    const originRead = await readACTAgentHubSkillOriginStrict(skillDir);
    if (originRead.kind === "malformed") {
      return {
        ok: false,
        error: `Malformed ACTAgentHub origin metadata at ${originRead.path}: ${originRead.error}`,
      };
    }

    if (originRead.kind === "found") {
      const lock = await readACTAgentHubSkillsLockfile(params.workspaceDir);
      const locked = lock.skills[trackedSlug];
      if (!locked) {
        return {
          ok: false,
          error: `Skill "${trackedSlug}" has ACTAgentHub origin metadata but is not tracked by the workspace ACTAgentHub lockfile. Reinstall it from ACTAgentHub before verifying it as an installed ACTAgentHub skill.`,
        };
      }
      const originSlug = normalizeTrackedSkillSlug(originRead.origin.slug);
      if (originSlug !== trackedSlug) {
        return {
          ok: false,
          error: `Skill "${trackedSlug}" has ACTAgentHub origin metadata for "${originRead.origin.slug}". Reinstall it from ACTAgentHub before verifying it as an installed ACTAgentHub skill.`,
        };
      }
      const originRegistry = normalizeStoredRegistry(originRead.origin.registry);
      const lockedRegistry =
        locked.registry === undefined ? originRegistry : normalizeStoredRegistry(locked.registry);
      if (
        locked.version !== originRead.origin.installedVersion ||
        locked.installedAt !== originRead.origin.installedAt ||
        lockedRegistry !== originRegistry
      ) {
        return {
          ok: false,
          error: `Skill "${trackedSlug}" ACTAgentHub origin metadata does not match the workspace ACTAgentHub lockfile. Reinstall it from ACTAgentHub before verifying it as an installed ACTAgentHub skill.`,
        };
      }
      const selector: ACTAgentHubSkillVerificationSelector = version
        ? "version"
        : tag
          ? "tag"
          : "installed-version";
      return {
        ok: true,
        slug: trackedSlug,
        baseUrl: lockedRegistry,
        version: version ?? (tag ? undefined : locked.version),
        tag,
        resolution: {
          source: "installed",
          selector,
          registry: lockedRegistry,
          skillDir,
          installedVersion: locked.version,
        },
      };
    }

    const lockRead = readACTAgentHubSkillsLockfileStatusSync(params.workspaceDir);
    if (lockRead.kind === "malformed") {
      return {
        ok: false,
        error: `Malformed workspace ACTAgentHub lockfile at ${lockRead.path}: ${lockRead.error}`,
      };
    }
    if (lockRead.kind === "found" && lockRead.lock.skills[trackedSlug]) {
      return {
        ok: false,
        error: `Skill "${trackedSlug}" is tracked by the workspace ACTAgentHub lockfile but is missing ACTAgentHub origin metadata. Reinstall it from ACTAgentHub before verifying it as an installed ACTAgentHub skill.`,
      };
    }

    const slug = validateRequestedSkillSlug(params.slug);
    const registry = resolveACTAgentHubBaseUrl(params.baseUrl);
    const selector: ACTAgentHubSkillVerificationSelector = version ? "version" : tag ? "tag" : "latest";
    return {
      ok: true,
      slug,
      baseUrl: registry,
      version,
      tag,
      resolution: {
        source: "registry",
        selector,
        registry,
        skillDir: undefined,
        installedVersion: undefined,
      },
    };
  } catch (err) {
    return { ok: false, error: formatErrorMessage(err) };
  }
}

async function resolveInstallVersion(params: {
  slug: string;
  version?: string;
  baseUrl?: string;
}): Promise<{ detail: ACTAgentHubSkillDetail; version: string }> {
  const detail = await fetchACTAgentHubSkillDetail({
    slug: params.slug,
    baseUrl: params.baseUrl,
  });
  if (!detail.skill) {
    throw new Error(`Skill "${params.slug}" not found on ACTAgentHub.`);
  }
  const resolvedVersion = params.version ?? detail.latestVersion?.version;
  if (!resolvedVersion) {
    throw new Error(`Skill "${params.slug}" has no installable version.`);
  }
  return {
    detail,
    version: resolvedVersion,
  };
}

function normalizeGitHubSourcePath(raw: string): string {
  const parts = raw.replaceAll("\\", "/").split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid GitHub skill source path: ${raw}`);
  }
  return parts.join("/");
}

function resolveGitHubSkillSourceDir(repoRoot: string, sourcePath: string): string {
  const normalized = normalizeGitHubSourcePath(sourcePath);
  return path.join(repoRoot, ...normalized.split("/"));
}

async function installArchiveResolution(params: {
  workspaceDir: string;
  slug: string;
  version: string;
  archivePath: string;
  registry: string;
  authority: "actagent" | "third-party";
  force?: boolean;
  logger?: Logger;
  config?: ACTAgentConfig;
}) {
  return await withExtractedArchiveRoot({
    archivePath: params.archivePath,
    tempDirPrefix: "actagent-skill-actagenthub-",
    timeoutMs: 120_000,
    rootMarkers: ACTAGENTHUB_SKILL_ARCHIVE_ROOT_MARKERS,
    onExtracted: async (rootDir) =>
      await installExtractedSkillRoot({
        workspaceDir: params.workspaceDir,
        slug: params.slug,
        extractedRoot: rootDir,
        mode: params.force ? "update" : "install",
        logger: params.logger,
        policy: {
          config: params.config,
          installId: "actagenthub",
          origin: {
            type: "actagenthub",
            registry: params.registry,
            slug: params.slug,
            version: params.version,
          },
          source: {
            kind: "actagenthub",
            authority: params.authority,
            mutable: false,
            network: true,
          },
          requestedSpecifier: `actagenthub:${params.slug}@${params.version}`,
        },
        rootMarkers: ACTAGENTHUB_SKILL_ARCHIVE_ROOT_MARKERS,
      }),
  });
}

async function installGitHubResolution(params: {
  workspaceDir: string;
  slug: string;
  sourcePath: string;
  archivePath: string;
  registry: string;
  repo: string;
  commit: string;
  force?: boolean;
  logger?: Logger;
  config?: ACTAgentConfig;
}) {
  return await withExtractedArchiveRoot({
    archivePath: params.archivePath,
    tempDirPrefix: "actagent-skill-actagenthub-github-",
    timeoutMs: 120_000,
    onExtracted: async (repoRoot) =>
      await installExtractedSkillRoot({
        workspaceDir: params.workspaceDir,
        slug: params.slug,
        extractedRoot: resolveGitHubSkillSourceDir(repoRoot, params.sourcePath),
        mode: params.force ? "update" : "install",
        logger: params.logger,
        policy: {
          config: params.config,
          installId: "actagenthub",
          origin: {
            type: "actagenthub",
            registry: params.registry,
            slug: params.slug,
            version: params.commit,
            repo: params.repo,
            path: params.sourcePath,
            commit: params.commit,
          },
          source: {
            kind: "git",
            authority: "third-party",
            mutable: false,
            network: true,
          },
          requestedSpecifier: `actagenthub:${params.slug}@${params.commit}`,
        },
        rootMarkers: ACTAGENTHUB_SKILL_ARCHIVE_ROOT_MARKERS,
      }),
  });
}

function assertInstallResolutionAllowed(
  resolution: ACTAgentHubSkillInstallResolutionResponse,
): Extract<ACTAgentHubSkillInstallResolutionResponse, { ok: true }> {
  if (resolution.ok) {
    return resolution;
  }
  throw new Error(resolution.message || `Skill "${resolution.slug}" is not installable.`);
}

async function performACTAgentHubSkillInstall(
  params: ACTAgentHubInstallParams,
): Promise<InstallACTAgentHubSkillResult> {
  try {
    const targetDir = resolveWorkspaceSkillInstallDir(params.workspaceDir, params.slug);
    const registry = resolveACTAgentHubBaseUrl(params.baseUrl);
    const actagenthubAuthority = isDefaultACTAgentHubBaseUrl(params.baseUrl) ? "actagent" : "third-party";
    if (!params.force && (await pathExists(targetDir))) {
      return {
        ok: false,
        error: `Skill already exists at ${targetDir}. Re-run with force/update.`,
      };
    }

    let version!: string;
    let detail: ACTAgentHubSkillDetail | undefined;
    let latestResolution: Extract<ACTAgentHubSkillInstallResolutionResponse, { ok: true }> | undefined;
    let install: Awaited<ReturnType<typeof installArchiveResolution>>;

    const archive = params.version
      ? await (async () => {
          const resolved = await resolveInstallVersion({
            slug: params.slug,
            version: params.version,
            baseUrl: params.baseUrl,
          });
          detail = resolved.detail;
          version = resolved.version;
          params.logger?.info?.(`Downloading ${params.slug}@${version} from ACTAgentHub…`);
          return await downloadACTAgentHubSkillArchive({
            slug: params.slug,
            version,
            baseUrl: params.baseUrl,
          });
        })()
      : await (async () => {
          latestResolution = assertInstallResolutionAllowed(
            await fetchACTAgentHubSkillInstallResolution({
              slug: params.slug,
              baseUrl: params.baseUrl,
              forceInstall: params.forceInstall,
            }),
          );
          if (latestResolution.installKind === "github") {
            version = latestResolution.github.commit;
            params.logger?.info?.(`Downloading ${params.slug}@${version} from GitHub…`);
            return await downloadACTAgentHubGitHubSkillArchive({
              repo: latestResolution.github.repo,
              commit: latestResolution.github.commit,
            });
          }
          version = latestResolution.archive.version;
          params.logger?.info?.(`Downloading ${params.slug}@${version} from ACTAgentHub…`);
          return await downloadACTAgentHubSkillArchiveUrl({
            url: latestResolution.archive.downloadUrl,
            baseUrl: params.baseUrl,
          });
        })();
    try {
      if (!params.version) {
        if (!latestResolution) {
          throw new Error(`Skill "${params.slug}" has no install resolution.`);
        }
        install =
          latestResolution.installKind === "github"
            ? await installGitHubResolution({
                workspaceDir: params.workspaceDir,
                slug: params.slug,
                sourcePath: latestResolution.github.path,
                archivePath: archive.archivePath,
                registry,
                repo: latestResolution.github.repo,
                commit: latestResolution.github.commit,
                force: params.force,
                logger: params.logger,
                config: params.config,
              })
            : await installArchiveResolution({
                workspaceDir: params.workspaceDir,
                slug: params.slug,
                version,
                archivePath: archive.archivePath,
                registry,
                authority: actagenthubAuthority,
                force: params.force,
                logger: params.logger,
                config: params.config,
              });
      } else {
        install = await installArchiveResolution({
          workspaceDir: params.workspaceDir,
          slug: params.slug,
          version,
          archivePath: archive.archivePath,
          registry,
          authority: actagenthubAuthority,
          force: params.force,
          logger: params.logger,
          config: params.config,
        });
      }
      if (!install.ok) {
        return { ok: false, error: install.error };
      }

      const installedAt = Date.now();
      await writeACTAgentHubSkillOrigin(install.targetDir, {
        version: 1,
        registry: resolveACTAgentHubBaseUrl(params.baseUrl),
        slug: params.slug,
        installedVersion: version,
        installedAt,
      });
      const lock = await readACTAgentHubSkillsLockfile(params.workspaceDir);
      lock.skills[params.slug] = {
        version,
        installedAt,
        registry: resolveACTAgentHubBaseUrl(params.baseUrl),
      };
      await writeACTAgentHubSkillsLockfile(params.workspaceDir, lock);
      await reportACTAgentHubSkillInstallTelemetry({
        baseUrl: params.baseUrl,
        root: params.workspaceDir,
        skills: lock.skills,
      }).catch(() => undefined);

      return {
        ok: true,
        slug: params.slug,
        version,
        targetDir: install.targetDir,
        ...(detail ? { detail } : {}),
      };
    } finally {
      await archive.cleanup().catch(() => undefined);
    }
  } catch (err) {
    return {
      ok: false,
      error: formatErrorMessage(err),
    };
  }
}

async function installRequestedSkillFromACTAgentHub(
  params: ACTAgentHubInstallParams,
): Promise<InstallACTAgentHubSkillResult> {
  try {
    return await performACTAgentHubSkillInstall({
      ...params,
      slug: validateRequestedSkillSlug(params.slug),
    });
  } catch (err) {
    return {
      ok: false,
      error: formatErrorMessage(err),
    };
  }
}

async function installTrackedSkillFromACTAgentHub(
  params: ACTAgentHubInstallParams,
): Promise<InstallACTAgentHubSkillResult> {
  try {
    return await performACTAgentHubSkillInstall({
      ...params,
      slug: normalizeTrackedSkillSlug(params.slug),
    });
  } catch (err) {
    return {
      ok: false,
      error: formatErrorMessage(err),
    };
  }
}

async function resolveTrackedUpdateTarget(params: {
  workspaceDir: string;
  slug: string;
  lock: ACTAgentHubSkillsLockfile;
  baseUrl?: string;
}): Promise<TrackedUpdateTarget> {
  const targetDir = resolveWorkspaceSkillInstallDir(params.workspaceDir, params.slug);
  const origin = (await readACTAgentHubSkillOrigin(targetDir)) ?? null;
  if (!origin && !params.lock.skills[params.slug]) {
    return {
      ok: false,
      slug: params.slug,
      error: `Skill "${params.slug}" is not tracked as a ACTAgentHub install.`,
    };
  }
  return {
    ok: true,
    slug: params.slug,
    baseUrl: origin?.registry ?? params.baseUrl,
    previousVersion: origin?.installedVersion ?? params.lock.skills[params.slug]?.version ?? null,
  };
}

export async function installSkillFromACTAgentHub(params: {
  workspaceDir: string;
  slug: string;
  version?: string;
  baseUrl?: string;
  force?: boolean;
  forceInstall?: boolean;
  logger?: Logger;
  config?: ACTAgentConfig;
}): Promise<InstallACTAgentHubSkillResult> {
  return await installRequestedSkillFromACTAgentHub(params);
}

export async function updateSkillsFromACTAgentHub(params: {
  workspaceDir: string;
  slug?: string;
  baseUrl?: string;
  forceInstall?: boolean;
  logger?: Logger;
  config?: ACTAgentConfig;
}): Promise<UpdateACTAgentHubSkillResult[]> {
  const lock = await readACTAgentHubSkillsLockfile(params.workspaceDir);
  const slugs = params.slug
    ? [
        await resolveRequestedUpdateSlug({
          workspaceDir: params.workspaceDir,
          requestedSlug: params.slug,
          lock,
        }),
      ]
    : Object.keys(lock.skills).map((slug) => normalizeTrackedSkillSlug(slug));
  const results: UpdateACTAgentHubSkillResult[] = [];
  for (const slug of slugs) {
    const tracked = await resolveTrackedUpdateTarget({
      workspaceDir: params.workspaceDir,
      slug,
      lock,
      baseUrl: params.baseUrl,
    });
    if (!tracked.ok) {
      results.push({
        ok: false,
        error: tracked.error,
      });
      continue;
    }
    const install = await installTrackedSkillFromACTAgentHub({
      workspaceDir: params.workspaceDir,
      slug: tracked.slug,
      baseUrl: tracked.baseUrl,
      force: true,
      forceInstall: params.forceInstall,
      logger: params.logger,
      config: params.config,
    });
    if (!install.ok) {
      results.push(install);
      continue;
    }
    results.push({
      ok: true,
      slug: tracked.slug,
      previousVersion: tracked.previousVersion,
      version: install.version,
      changed: tracked.previousVersion !== install.version,
      targetDir: install.targetDir,
    });
  }
  return results;
}

export async function readTrackedACTAgentHubSkillSlugs(workspaceDir: string): Promise<string[]> {
  const lock = await readACTAgentHubSkillsLockfile(workspaceDir);
  return Object.keys(lock.skills).toSorted();
}

export async function untrackACTAgentHubSkill(workspaceDir: string, slug: string): Promise<void> {
  const trackedSlug = normalizeTrackedSkillSlug(slug);
  const lock = await readACTAgentHubSkillsLockfile(workspaceDir);
  if (!lock.skills[trackedSlug]) {
    return;
  }
  delete lock.skills[trackedSlug];
  await writeACTAgentHubSkillsLockfile(workspaceDir, lock);
}
