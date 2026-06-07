#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-build.sh"
source "$ROOT_DIR/scripts/lib/docker-e2e-container.sh"
IMAGE_NAME="${ACTAGENT_INSTALL_E2E_IMAGE:-actagent-install-e2e:local}"
INSTALL_URL="${ACTAGENT_INSTALL_URL:-https://actagent.bot/install.sh}"
DOCKER_COMMAND_TIMEOUT="${DOCKER_COMMAND_TIMEOUT:-${ACTAGENT_INSTALL_E2E_DOCKER_TIMEOUT:-2700s}}"
PROFILE_FILE="${ACTAGENT_INSTALL_E2E_PROFILE_FILE:-${ACTAGENT_PROFILE_FILE:-${ACTAGENT_TESTBOX_PROFILE_FILE:-$HOME/.actagent-testbox-live.profile}}}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
ANTHROPIC_API_TOKEN="${ANTHROPIC_API_TOKEN:-}"
ACTAGENT_E2E_MODELS="${ACTAGENT_E2E_MODELS:-}"

if [ ! -f "$PROFILE_FILE" ] && [ -f "$HOME/.profile" ]; then
  PROFILE_FILE="$HOME/.profile"
fi

PROFILE_STATUS="none"

read_profile_env_value() {
  local key="$1"
  (
    set +u
    # shellcheck disable=SC1090
    source "$PROFILE_FILE" >/dev/null
    printf '%s' "${!key:-}"
  )
}

for key in OPENAI_API_KEY ANTHROPIC_API_KEY ANTHROPIC_API_TOKEN; do
  if [ -f "$PROFILE_FILE" ] && [ -r "$PROFILE_FILE" ] && [ -z "${!key:-}" ]; then
    printf -v "$key" '%s' "$(read_profile_env_value "$key")"
    PROFILE_STATUS="$PROFILE_FILE"
  fi
  if [[ "${!key:-}" == "undefined" || "${!key:-}" == "null" ]]; then
    printf -v "$key" '%s' ""
  fi
  export "$key"
done

echo "==> Build image: $IMAGE_NAME"
docker_build_run install-e2e-build \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/scripts/docker/install-sh-e2e/Dockerfile" \
  "$ROOT_DIR/scripts/docker"

echo "==> Run E2E installer test"
echo "Profile file: $PROFILE_STATUS"
docker_e2e_docker_run_cmd run --rm \
  -e ACTAGENT_INSTALL_URL="$INSTALL_URL" \
  -e ACTAGENT_INSTALL_TAG="${ACTAGENT_INSTALL_TAG:-latest}" \
  -e ACTAGENT_E2E_MODELS="$ACTAGENT_E2E_MODELS" \
  -e ACTAGENT_INSTALL_E2E_OPENAI_MODEL="${ACTAGENT_INSTALL_E2E_OPENAI_MODEL:-}" \
  -e ACTAGENT_INSTALL_E2E_OPENAI_PROVIDER_TIMEOUT_SECONDS="${ACTAGENT_INSTALL_E2E_OPENAI_PROVIDER_TIMEOUT_SECONDS:-}" \
  -e ACTAGENT_INSTALL_E2E_PREVIOUS="${ACTAGENT_INSTALL_E2E_PREVIOUS:-}" \
  -e ACTAGENT_INSTALL_E2E_SKIP_PREVIOUS="${ACTAGENT_INSTALL_E2E_SKIP_PREVIOUS:-0}" \
  -e ACTAGENT_INSTALL_E2E_AGENT_TURN_TIMEOUT_SECONDS="${ACTAGENT_INSTALL_E2E_AGENT_TURN_TIMEOUT_SECONDS:-300}" \
  -e ACTAGENT_INSTALL_E2E_AGENT_TURNS_PARALLEL="${ACTAGENT_INSTALL_E2E_AGENT_TURNS_PARALLEL:-1}" \
  -e ACTAGENT_INSTALL_E2E_AGENT_TOOL_SMOKE="${ACTAGENT_INSTALL_E2E_AGENT_TOOL_SMOKE:-1}" \
  -e ACTAGENT_NO_ONBOARD=1 \
  -e OPENAI_API_KEY \
  -e ANTHROPIC_API_KEY \
  -e ANTHROPIC_API_TOKEN \
  "$IMAGE_NAME"
