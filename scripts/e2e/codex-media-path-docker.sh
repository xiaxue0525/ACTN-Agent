#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "actagent-codex-media-path-e2e" ACTAGENT_CODEX_MEDIA_PATH_E2E_IMAGE)"
PORT="${ACTAGENT_CODEX_MEDIA_PATH_PORT:-18790}"
TOKEN="codex-media-path-e2e-$$"
CODEX_PLUGIN_SPEC="${ACTAGENT_CODEX_MEDIA_PATH_PLUGIN_SPEC:-npm:@actagent/codex}"

docker_e2e_build_or_reuse "$IMAGE_NAME" codex-media-path "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR"
ACTAGENT_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 codex-media-path empty)"

echo "Running Codex media-path Docker E2E..."
docker_e2e_run_logged_with_harness codex-media-path \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e "ACTAGENT_CODEX_MEDIA_PATH_PLUGIN_SPEC=$CODEX_PLUGIN_SPEC" \
  -e "ACTAGENT_CODEX_MEDIA_PATH_TIMEOUT_SECONDS=${ACTAGENT_CODEX_MEDIA_PATH_TIMEOUT_SECONDS:-180}" \
  -e "ACTAGENT_ALLOW_INSECURE_PRIVATE_WS=1" \
  -e "ACTAGENT_GATEWAY_TOKEN=$TOKEN" \
  -e "ACTAGENT_TEST_STATE_SCRIPT_B64=$ACTAGENT_TEST_STATE_SCRIPT_B64" \
  -e "PORT=$PORT" \
  -v "$ROOT_DIR/src:/app/src:ro" \
  -v "$ROOT_DIR/test/helpers:/app/test/helpers:ro" \
  "$IMAGE_NAME" \
  bash scripts/e2e/lib/codex-media-path/scenario.sh
