// Product/package naming constants that bridge current ACTAgent manifests with
// legacy actagentdbot keys still seen in older configs and packages.
export const PROJECT_NAME = "actagent" as const;

const LEGACY_PROJECT_NAMES = ["actagentdbot"] as const;

export const MANIFEST_KEY = PROJECT_NAME;

/** Manifest keys accepted only for legacy compatibility. */
export const LEGACY_MANIFEST_KEYS = LEGACY_PROJECT_NAMES;

export const MACOS_APP_SOURCES_DIR = "apps/macos/Sources/ACTAgent" as const;
