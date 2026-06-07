// Plugin ACTAgentHub Release script supports ACTAgent repository automation.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { validateExternalCodePluginPackageJson } from "../../packages/plugin-package-contract/src/index.ts";
import { readBoundedResponseText } from "./bounded-response.ts";
import {
  collectExtensionPackageJsonCandidates,
  collectChangedPathsFromGitRange,
  collectChangedExtensionIdsFromPaths,
  collectPublishablePluginPackageErrors,
  parsePluginReleaseArgs,
  resolvePublishablePluginVersion,
  resolveGitCommitSha,
  resolveChangedPublishablePluginPackages,
  resolveSelectedPublishablePluginPackages,
  type GitRangeSelection,
  type PluginReleaseSelectionMode,
} from "./plugin-npm-release.ts";

export { parsePluginReleaseArgs };

type PluginPackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
  actagent?: {
    extensions?: string[];
    install?: {
      npmSpec?: string;
    };
    compat?: {
      pluginApi?: string;
      minGatewayVersion?: string;
    };
    build?: {
      actagentVersion?: string;
      pluginSdkVersion?: string;
    };
    release?: {
      publishToACTAgentHub?: boolean;
      publishToNpm?: boolean;
    };
  };
};

export type PublishablePluginPackage = {
  extensionId: string;
  packageDir: string;
  packageName: string;
  version: string;
  channel: "stable" | "alpha" | "beta";
  publishTag: "latest" | "alpha" | "beta";
};

type PluginReleasePlanItem = PublishablePluginPackage & {
  alreadyPublished: boolean;
};

type PluginReleasePlan = {
  all: PluginReleasePlanItem[];
  candidates: PluginReleasePlanItem[];
  skippedPublished: PluginReleasePlanItem[];
};

type ACTAgentHubPackageOwnerDetail = {
  owner?: {
    handle?: unknown;
  } | null;
};

type ACTAgentHubPublishablePluginPackageFilters = {
  extensionIds?: readonly string[];
  packageNames?: readonly string[];
};

const ACTAGENTHUB_DEFAULT_REGISTRY = "https://actagenthub.ai";
const ACTAGENTHUB_RESPONSE_BODY_MAX_BYTES = 1024 * 1024;
const SAFE_EXTENSION_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const ACTAGENTHUB_SHARED_RELEASE_INPUT_PATHS = [
  ".github/workflows/plugin-actagenthub-release.yml",
  ".github/actions/setup-node-env",
  "package.json",
  "pnpm-lock.yaml",
  "packages/plugin-package-contract/src/index.ts",
  "scripts/lib/bounded-response.ts",
  "scripts/lib/npm-publish-plan.mjs",
  "scripts/lib/plugin-npm-release.ts",
  "scripts/lib/plugin-actagenthub-release.ts",
  "scripts/plugin-actagenthub-owner-preflight.ts",
  "scripts/actagent-npm-release-check.ts",
  "scripts/plugin-actagenthub-publish.sh",
  "scripts/plugin-actagenthub-release-check.ts",
  "scripts/plugin-actagenthub-release-plan.ts",
] as const;

function getRegistryBaseUrl(explicit?: string) {
  return (
    explicit?.trim() ||
    process.env.ACTAGENTHUB_REGISTRY?.trim() ||
    process.env.ACTAGENTHUB_SITE?.trim() ||
    ACTAGENTHUB_DEFAULT_REGISTRY
  );
}

async function readACTAgentHubPackageOwnerDetail(
  response: Response,
  packageName: string,
): Promise<ACTAgentHubPackageOwnerDetail> {
  return JSON.parse(
    await readBoundedResponseText(
      response,
      `ACTAgentHub package owner response for ${packageName}`,
      ACTAGENTHUB_RESPONSE_BODY_MAX_BYTES,
    ),
  ) as ACTAgentHubPackageOwnerDetail;
}

export function collectACTAgentHubPublishablePluginPackages(
  rootDir = resolve("."),
  filters: ACTAgentHubPublishablePluginPackageFilters = {},
): PublishablePluginPackage[] {
  const publishable: PublishablePluginPackage[] = [];
  const validationErrors: string[] = [];
  const selectedExtensionIds = new Set(filters.extensionIds ?? []);
  const selectedPackageNames = new Set(filters.packageNames ?? []);
  const hasSelectedExtensionIds = Array.isArray(filters.extensionIds);
  const hasSelectedPackageNames = Array.isArray(filters.packageNames);

  for (const candidate of collectExtensionPackageJsonCandidates(rootDir)) {
    const { extensionId, packageDir, packageJson } = candidate;
    if (hasSelectedExtensionIds && !selectedExtensionIds.has(extensionId)) {
      continue;
    }
    const packageName = packageJson.name?.trim() ?? "";
    if (hasSelectedPackageNames && !selectedPackageNames.has(packageName)) {
      continue;
    }
    if (packageJson.actagent?.release?.publishToACTAgentHub !== true) {
      continue;
    }
    if (!SAFE_EXTENSION_ID_RE.test(extensionId)) {
      validationErrors.push(
        `${extensionId}: extension directory name must match ^[a-z0-9][a-z0-9._-]*$ for ACTAgentHub publish.`,
      );
      continue;
    }

    const errors = collectPublishablePluginPackageErrors({
      extensionId,
      packageDir,
      packageJson,
    });
    if (errors.length > 0) {
      validationErrors.push(...errors.map((error) => `${extensionId}: ${error}`));
      continue;
    }
    const contractValidation = validateExternalCodePluginPackageJson(packageJson);
    if (contractValidation.issues.length > 0) {
      validationErrors.push(
        ...contractValidation.issues.map((issue) => `${extensionId}: ${issue.message}`),
      );
      continue;
    }

    const resolvedVersion = resolvePublishablePluginVersion({
      extensionId,
      packageJson,
      validationErrors,
    });
    if (!resolvedVersion) {
      continue;
    }
    const { version, parsedVersion } = resolvedVersion;

    publishable.push({
      extensionId,
      packageDir,
      packageName,
      version,
      channel: parsedVersion.channel,
      publishTag:
        parsedVersion.channel === "alpha"
          ? "alpha"
          : parsedVersion.channel === "beta"
            ? "beta"
            : "latest",
    });
  }

  if (validationErrors.length > 0) {
    throw new Error(
      `Publishable ACTAgentHub plugin metadata validation failed:\n${validationErrors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  return publishable.toSorted((left, right) => left.packageName.localeCompare(right.packageName));
}

export function collectPluginACTAgentHubReleasePathsFromGitRange(params: {
  rootDir?: string;
  gitRange: GitRangeSelection;
}): string[] {
  return collectPluginACTAgentHubReleasePathsFromGitRangeForPathspecs(params, ["extensions"]);
}

function collectPluginACTAgentHubRelevantPathsFromGitRange(params: {
  rootDir?: string;
  gitRange: GitRangeSelection;
}): string[] {
  return collectPluginACTAgentHubReleasePathsFromGitRangeForPathspecs(params, [
    "extensions",
    ...ACTAGENTHUB_SHARED_RELEASE_INPUT_PATHS,
  ]);
}

function collectPluginACTAgentHubReleasePathsFromGitRangeForPathspecs(
  params: {
    rootDir?: string;
    gitRange: GitRangeSelection;
  },
  pathspecs: readonly string[],
): string[] {
  return collectChangedPathsFromGitRange({
    rootDir: params.rootDir,
    gitRange: params.gitRange,
    pathspecs,
  });
}

function hasSharedACTAgentHubReleaseInputChanges(changedPaths: readonly string[]) {
  return changedPaths.some((path) =>
    ACTAGENTHUB_SHARED_RELEASE_INPUT_PATHS.some(
      (sharedPath) => path === sharedPath || path.startsWith(`${sharedPath}/`),
    ),
  );
}

export function resolveChangedACTAgentHubPublishablePluginPackages(params: {
  plugins: PublishablePluginPackage[];
  changedPaths: readonly string[];
}): PublishablePluginPackage[] {
  return resolveChangedPublishablePluginPackages({
    plugins: params.plugins,
    changedExtensionIds: collectChangedExtensionIdsFromPaths(params.changedPaths),
  });
}

export function resolveSelectedACTAgentHubPublishablePluginPackages(params: {
  plugins: PublishablePluginPackage[];
  selection?: string[];
  selectionMode?: PluginReleaseSelectionMode;
  gitRange?: GitRangeSelection;
  rootDir?: string;
}): PublishablePluginPackage[] {
  if (params.selectionMode === "all-publishable") {
    return params.plugins;
  }
  if (params.selection && params.selection.length > 0) {
    return resolveSelectedPublishablePluginPackages({
      plugins: params.plugins,
      selection: params.selection,
    });
  }
  if (params.gitRange) {
    const changedPaths = collectPluginACTAgentHubRelevantPathsFromGitRange({
      rootDir: params.rootDir,
      gitRange: params.gitRange,
    });
    if (hasSharedACTAgentHubReleaseInputChanges(changedPaths)) {
      return params.plugins;
    }
    return resolveChangedACTAgentHubPublishablePluginPackages({
      plugins: params.plugins,
      changedPaths,
    });
  }
  return params.plugins;
}

function readPackageManifestAtGitRef(params: {
  rootDir?: string;
  ref: string;
  packageDir: string;
}): PluginPackageJson | null {
  const rootDir = params.rootDir ?? resolve(".");
  const commitSha = resolveGitCommitSha(rootDir, params.ref, "ref");
  try {
    const raw = execFileSync("git", ["show", `${commitSha}:${params.packageDir}/package.json`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(raw) as PluginPackageJson;
  } catch {
    return null;
  }
}

export function collectACTAgentHubVersionGateErrors(params: {
  plugins: PublishablePluginPackage[];
  gitRange: GitRangeSelection;
  rootDir?: string;
}): string[] {
  const changedPaths = collectPluginACTAgentHubReleasePathsFromGitRange({
    rootDir: params.rootDir,
    gitRange: params.gitRange,
  });
  const changedPlugins = resolveChangedACTAgentHubPublishablePluginPackages({
    plugins: params.plugins,
    changedPaths,
  });

  const errors: string[] = [];
  for (const plugin of changedPlugins) {
    const baseManifest = readPackageManifestAtGitRef({
      rootDir: params.rootDir,
      ref: params.gitRange.baseRef,
      packageDir: plugin.packageDir,
    });
    if (baseManifest?.actagent?.release?.publishToACTAgentHub !== true) {
      continue;
    }
    const baseVersion =
      typeof baseManifest.version === "string" && baseManifest.version.trim()
        ? baseManifest.version.trim()
        : null;
    if (baseVersion === null || baseVersion !== plugin.version) {
      continue;
    }
    errors.push(
      `${plugin.packageName}@${plugin.version}: changed publishable plugin still has the same version in package.json.`,
    );
  }

  return errors;
}

async function isPluginVersionPublishedOnACTAgentHub(
  packageName: string,
  version: string,
  options: {
    fetchImpl?: typeof fetch;
    registryBaseUrl?: string;
  } = {},
): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(
    `/api/v1/packages/${encodeURIComponent(packageName)}/versions/${encodeURIComponent(version)}`,
    getRegistryBaseUrl(options.registryBaseUrl),
  );
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return false;
  }
  if (response.ok) {
    return true;
  }

  throw new Error(
    `Failed to query ACTAgentHub for ${packageName}@${version}: ${response.status} ${response.statusText}`,
  );
}

export async function collectACTAgentHubACTAgentOwnerErrors(params: {
  plugins: readonly Pick<PublishablePluginPackage, "packageName">[];
  requiredOwnerHandle?: string;
  registryBaseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const requiredOwnerHandle = params.requiredOwnerHandle ?? "actagent";
  const errors: string[] = [];

  await Promise.all(
    params.plugins.map(async (plugin) => {
      if (!plugin.packageName.startsWith("@actagent/")) {
        return;
      }

      const url = new URL(
        `/api/v1/packages/${encodeURIComponent(plugin.packageName)}`,
        getRegistryBaseUrl(params.registryBaseUrl),
      );
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 404) {
        errors.push(
          `${plugin.packageName}: ACTAgentHub package row must already exist under @${requiredOwnerHandle} before ACTAgent release publish.`,
        );
        return;
      }
      if (!response.ok) {
        errors.push(
          `${plugin.packageName}: failed to query ACTAgentHub owner: ${response.status} ${response.statusText}`,
        );
        return;
      }

      const detail = await readACTAgentHubPackageOwnerDetail(response, plugin.packageName);
      const ownerHandle = typeof detail.owner?.handle === "string" ? detail.owner.handle : null;
      if (ownerHandle !== requiredOwnerHandle) {
        errors.push(
          `${plugin.packageName}: ACTAgentHub package owner must be @${requiredOwnerHandle}; got ${ownerHandle ? `@${ownerHandle}` : "<missing>"}.`,
        );
      }
    }),
  );

  return errors.toSorted();
}

export async function collectPluginACTAgentHubReleasePlan(params?: {
  rootDir?: string;
  selection?: string[];
  selectionMode?: PluginReleaseSelectionMode;
  gitRange?: GitRangeSelection;
  registryBaseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<PluginReleasePlan> {
  const rootDir = params?.rootDir;
  const selection = params?.selection ?? [];
  const changedPaths = params?.gitRange
    ? collectPluginACTAgentHubRelevantPathsFromGitRange({
        rootDir,
        gitRange: params.gitRange,
      })
    : [];
  const sharedInputChanged = hasSharedACTAgentHubReleaseInputChanges(changedPaths);
  const extensionIds =
    params?.selectionMode === "all-publishable" || !params?.gitRange || sharedInputChanged
      ? undefined
      : collectChangedExtensionIdsFromPaths(changedPaths);
  const allPublishable = collectACTAgentHubPublishablePluginPackages(rootDir, {
    extensionIds,
    packageNames: selection.length > 0 ? selection : undefined,
  });
  const selectedPublishable = resolveSelectedACTAgentHubPublishablePluginPackages({
    plugins: allPublishable,
    selection,
    selectionMode: params?.selectionMode,
    gitRange: params?.gitRange,
    rootDir,
  });

  const all = await Promise.all(
    selectedPublishable.map(async (plugin) =>
      Object.assign({}, plugin, {
        alreadyPublished: await isPluginVersionPublishedOnACTAgentHub(
          plugin.packageName,
          plugin.version,
          { registryBaseUrl: params?.registryBaseUrl, fetchImpl: params?.fetchImpl },
        ),
      }),
    ),
  );

  return {
    all,
    candidates: all.filter((plugin) => !plugin.alreadyPublished),
    skippedPublished: all.filter((plugin) => plugin.alreadyPublished),
  };
}
