#!/usr/bin/env bash
# Live ACTAgentHub skill install proof for package-backed Docker/Testbox lanes.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/lib/actagent-e2e-instance.sh"

ACTAGENT_TEST_STATE_SCRIPT_B64="${ACTAGENT_TEST_STATE_SCRIPT_B64:-}"
actagent_skill_install_owns_home=0
cleanup_actagenthub_skill_install_home() {
  if [ "$actagent_skill_install_owns_home" = "1" ] && [ -n "${HOME:-}" ]; then
    rm -rf "$HOME"
  fi
}
trap cleanup_actagenthub_skill_install_home EXIT

if [ -n "$ACTAGENT_TEST_STATE_SCRIPT_B64" ]; then
  actagent_e2e_eval_test_state_from_b64 "$ACTAGENT_TEST_STATE_SCRIPT_B64"
else
  export HOME="$(mktemp -d "${TMPDIR:-/tmp}/actagent-skill-install-home.XXXXXX")"
  actagent_skill_install_owns_home=1
  export USERPROFILE="$HOME"
  export ACTAGENT_HOME="$HOME"
  export ACTAGENT_STATE_DIR="$HOME/.actagent"
  export ACTAGENT_CONFIG_PATH="$ACTAGENT_STATE_DIR/actagent.json"
  mkdir -p "$ACTAGENT_STATE_DIR"
fi

if [ -n "${ACTAGENT_CURRENT_PACKAGE_TGZ:-}" ]; then
  export NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$HOME/.npm-global}"
  export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
  actagent_e2e_install_package /tmp/actagent-skill-install-npm.log
fi

if [ -n "${ACTAGENT_CURRENT_PACKAGE_TGZ:-}" ] && command -v actagent >/dev/null 2>&1; then
  ACTAGENT_CMD=(actagent)
elif command -v pnpm >/dev/null 2>&1 && [ -f package.json ]; then
  if [ "${ACTAGENT_SKILL_INSTALL_E2E_BUILD_SOURCE:-0}" = "1" ]; then
    pnpm build >/tmp/actagent-skill-install-build.log 2>&1
  fi
  ACTAGENT_CMD=(pnpm --silent actagent)
elif command -v actagent >/dev/null 2>&1; then
  ACTAGENT_CMD=(actagent)
else
  echo "actagent command not found; install package first or run from repo with pnpm" >&2
  exit 1
fi

mkdir -p "$(dirname "$ACTAGENT_CONFIG_PATH")"
node --input-type=module - "$ACTAGENT_CONFIG_PATH" <<'NODE'
import fs from "node:fs";
const configPath = process.argv[2];
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {}
config.skills ??= {};
config.skills.install ??= {};
config.skills.install.allowUploadedArchives = false;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
NODE

query="${ACTAGENT_SKILL_INSTALL_E2E_QUERY:-homeassistant}"
requested_slug="${ACTAGENT_SKILL_INSTALL_E2E_SLUG:-}"
preferred_slug="${ACTAGENT_SKILL_INSTALL_E2E_PREFERRED_SLUG:-homeassistant-skill}"
search_json="/tmp/actagent-skill-install-search.json"
resolve_json="/tmp/actagent-skill-install-resolved.json"
install_log="/tmp/actagent-skill-install.log"
info_json="/tmp/actagent-skill-install-info.json"

echo "Searching live ACTAgentHub skills for: $query"
"${ACTAGENT_CMD[@]}" skills search "$query" --limit 8 --json >"$search_json"

node --input-type=module - "$search_json" "$resolve_json" "$requested_slug" "$preferred_slug" <<'NODE'
import fs from "node:fs";
const [searchPath, resolvePath, requestedSlug, preferredSlug] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(searchPath, "utf8"));
const results = Array.isArray(payload) ? payload : Array.isArray(payload.results) ? payload.results : [];
const slugs = results.map((entry) => String(entry.slug ?? "")).filter(Boolean);
let chosen;
if (requestedSlug) {
  chosen = results.find((entry) => entry.slug === requestedSlug);
  if (!chosen) {
    throw new Error(`Requested skill slug ${requestedSlug} not found. Search returned: ${slugs.join(", ") || "(none)"}`);
  }
} else {
  chosen =
    results.find((entry) => entry.slug === preferredSlug) ??
    results.find((entry) => String(entry.slug ?? "").includes("homeassistant")) ??
    results[0];
}
if (!chosen?.slug) {
  throw new Error(`No installable skill slug found. Search returned: ${slugs.join(", ") || "(none)"}`);
}
fs.writeFileSync(resolvePath, `${JSON.stringify({
  slug: chosen.slug,
  version: chosen.version ?? null,
  displayName: chosen.displayName ?? chosen.name ?? chosen.slug,
})}\n`);
NODE

slug="$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).slug)' "$resolve_json")"
echo "Installing live ACTAgentHub skill: $slug"
if ! "${ACTAGENT_CMD[@]}" skills install "$slug" --force >"$install_log" 2>&1; then
  echo "Skill install failed" >&2
  actagent_e2e_dump_logs /tmp/actagent-skill-install-npm.log "$search_json" "$resolve_json" "$install_log"
  exit 1
fi

workspace_dir="$HOME/.actagent/workspace"
skill_dir="$workspace_dir/skills/$slug"
origin_json="$skill_dir/.actagenthub/origin.json"
lock_json="$workspace_dir/.actagenthub/lock.json"

actagent_e2e_assert_file "$skill_dir/SKILL.md"
actagent_e2e_assert_file "$origin_json"
actagent_e2e_assert_file "$lock_json"

"${ACTAGENT_CMD[@]}" skills info "$slug" --json >"$info_json"

node --input-type=module - "$ACTAGENT_CONFIG_PATH" "$skill_dir" "$origin_json" "$lock_json" "$info_json" "$slug" <<'NODE'
import fs from "node:fs";
import path from "node:path";
const [configPath, skillDir, originPath, lockPath, infoPath, slug] = process.argv.slice(2);
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const config = read(configPath);
if (config.skills?.install?.allowUploadedArchives !== false) {
  throw new Error("skills.install.allowUploadedArchives must remain false during ACTAgentHub install proof");
}
const origin = read(originPath);
if (origin.slug !== slug || origin.registry !== "https://actagenthub.ai" || !origin.installedVersion) {
  throw new Error(`Unexpected origin metadata: ${JSON.stringify(origin)}`);
}
const lock = read(lockPath);
if (lock.skills?.[slug]?.version !== origin.installedVersion) {
  throw new Error(`Lockfile missing ${slug}@${origin.installedVersion}`);
}
const info = read(infoPath);
const infoFilePath = info.filePath ?? info.skill?.filePath;
const infoBaseDir = info.baseDir ?? info.skill?.baseDir;
if (
  info.skillKey !== slug &&
  (!infoFilePath || !path.resolve(infoFilePath).startsWith(path.resolve(skillDir)))
) {
  throw new Error(`skills info did not report installed skill ${slug}: ${JSON.stringify(info)}`);
}
if (infoBaseDir && path.resolve(infoBaseDir) !== path.resolve(skillDir)) {
  throw new Error(`skills info reported unexpected baseDir: ${infoBaseDir}`);
}
const skillText = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
if (!/^name:\s*/m.test(skillText)) {
  throw new Error("Installed SKILL.md is missing frontmatter name");
}
process.stdout.write(`E2E_OK installed=${slug} version=${origin.installedVersion} uploadArchives=false\n`);
NODE
