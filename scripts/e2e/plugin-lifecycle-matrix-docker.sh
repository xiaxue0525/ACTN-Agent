#!/usr/bin/env bash
# Bare package-level plugin lifecycle matrix with resource metrics.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
source "$ROOT_DIR/scripts/lib/docker-e2e-package.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "actagent-plugin-lifecycle-matrix-e2e" ACTAGENT_PLUGIN_LIFECYCLE_MATRIX_E2E_IMAGE)"
SKIP_BUILD="${ACTAGENT_PLUGIN_LIFECYCLE_MATRIX_E2E_SKIP_BUILD:-0}"
cleanup() {
  docker_e2e_cleanup_package_tgz "${PACKAGE_TGZ:-}"
}
trap cleanup EXIT

PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz plugin-lifecycle-matrix "${ACTAGENT_CURRENT_PACKAGE_TGZ:-}")"
docker_e2e_package_mount_args "$PACKAGE_TGZ"

docker_e2e_build_or_reuse "$IMAGE_NAME" plugin-lifecycle-matrix "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "bare" "$SKIP_BUILD"
ACTAGENT_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 plugin-lifecycle-matrix empty)"
DOCKER_ENV_ARGS=(
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  -e ACTAGENT_SKIP_CHANNELS=1
  -e ACTAGENT_SKIP_PROVIDERS=1
  -e "ACTAGENT_TEST_STATE_SCRIPT_B64=$ACTAGENT_TEST_STATE_SCRIPT_B64"
)
if [ -n "${ACTAGENT_PLUGIN_LIFECYCLE_PHASE_TIMEOUT_MS:-}" ]; then
  DOCKER_ENV_ARGS+=(-e "ACTAGENT_PLUGIN_LIFECYCLE_PHASE_TIMEOUT_MS=$ACTAGENT_PLUGIN_LIFECYCLE_PHASE_TIMEOUT_MS")
fi
if [ -n "${ACTAGENT_PLUGIN_LIFECYCLE_TIMEOUT_KILL_GRACE_MS:-}" ]; then
  DOCKER_ENV_ARGS+=(-e "ACTAGENT_PLUGIN_LIFECYCLE_TIMEOUT_KILL_GRACE_MS=$ACTAGENT_PLUGIN_LIFECYCLE_TIMEOUT_KILL_GRACE_MS")
fi

echo "Running plugin lifecycle matrix Docker E2E..."
docker_e2e_run_with_harness \
  "${DOCKER_ENV_ARGS[@]}" \
  "${DOCKER_E2E_PACKAGE_ARGS[@]}" \
  "$IMAGE_NAME" \
  bash scripts/e2e/lib/plugin-lifecycle-matrix/sweep.sh

echo "Plugin lifecycle matrix Docker E2E passed."
