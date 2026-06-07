#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "actagent-npm-telegram-rtt-e2e" ACTAGENT_NPM_TELEGRAM_RTT_E2E_IMAGE)"
DOCKER_TARGET="${ACTAGENT_NPM_TELEGRAM_DOCKER_TARGET:-build}"
PACKAGE_SPEC="${ACTAGENT_NPM_TELEGRAM_PACKAGE_SPEC:-actagent@beta}"
PACKAGE_TGZ="${ACTAGENT_NPM_TELEGRAM_PACKAGE_TGZ:-${ACTAGENT_CURRENT_PACKAGE_TGZ:-}}"
PACKAGE_LABEL="${ACTAGENT_NPM_TELEGRAM_PACKAGE_LABEL:-}"
RUN_ID="${ACTAGENT_NPM_TELEGRAM_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
OUTPUT_DIR="${ACTAGENT_NPM_TELEGRAM_OUTPUT_DIR:-.artifacts/qa-e2e/npm-telegram-rtt/$RUN_ID}"

resolve_credential_source() {
  if [ -n "${ACTAGENT_NPM_TELEGRAM_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$ACTAGENT_NPM_TELEGRAM_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${ACTAGENT_QA_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$ACTAGENT_QA_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${CI:-}" ] && [ -n "${ACTAGENT_QA_CONVEX_SITE_URL:-}" ]; then
    if [ -n "${ACTAGENT_QA_CONVEX_SECRET_CI:-}" ] || [ -n "${ACTAGENT_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
      printf "convex"
    fi
  fi
}

resolve_credential_role() {
  if [ -n "${ACTAGENT_NPM_TELEGRAM_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$ACTAGENT_NPM_TELEGRAM_CREDENTIAL_ROLE"
    return 0
  fi
  if [ -n "${ACTAGENT_QA_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$ACTAGENT_QA_CREDENTIAL_ROLE"
  fi
}

validate_actagent_package_spec() {
  local spec="$1"
  if [[ "$spec" =~ ^actagent@(main|alpha|beta|latest|[0-9]{4}\.[1-9][0-9]*\.[1-9][0-9]*(-[1-9][0-9]*|-(alpha|beta)\.[1-9][0-9]*)?)$ ]]; then
    return 0
  fi
  echo "ACTAGENT_NPM_TELEGRAM_PACKAGE_SPEC must be actagent@main, actagent@alpha, actagent@beta, actagent@latest, or an exact ACTAgent release version; got: $spec" >&2
  exit 1
}

resolve_package_tgz() {
  local candidate="$1"
  if [ -z "$candidate" ]; then
    return 0
  fi
  if [ ! -f "$candidate" ]; then
    echo "ACTAGENT_NPM_TELEGRAM_PACKAGE_TGZ must point to an existing .tgz file; got: $candidate" >&2
    exit 1
  fi
  case "$candidate" in
    *.tgz) ;;
    *)
      echo "ACTAGENT_NPM_TELEGRAM_PACKAGE_TGZ must point to a .tgz file; got: $candidate" >&2
      exit 1
      ;;
  esac
  local dir
  local base
  dir="$(cd "$(dirname "$candidate")" && pwd)"
  base="$(basename "$candidate")"
  printf "%s/%s" "$dir" "$base"
}

package_mount_args=()
package_install_source="$PACKAGE_SPEC"
resolved_package_tgz="$(resolve_package_tgz "$PACKAGE_TGZ")"
if [ -n "$resolved_package_tgz" ]; then
  package_install_source="/package-under-test/$(basename "$resolved_package_tgz")"
  package_mount_args=(-v "$resolved_package_tgz:$package_install_source:ro")
else
  validate_actagent_package_spec "$PACKAGE_SPEC"
fi
if [ -z "$PACKAGE_LABEL" ]; then
  if [ -n "$resolved_package_tgz" ]; then
    PACKAGE_LABEL="$(basename "$resolved_package_tgz")"
  else
    PACKAGE_LABEL="$PACKAGE_SPEC"
  fi
fi

credential_source="$(resolve_credential_source)"
credential_role="$(resolve_credential_role)"
if [ -z "$credential_role" ] && [ "$credential_source" = "convex" ]; then
  if [ -n "${CI:-}" ]; then
    credential_role="ci"
  else
    credential_role="maintainer"
  fi
fi

validate_credential_source() {
  case "$credential_source" in
    "" | env | convex) ;;
    *)
      echo "ACTAGENT_NPM_TELEGRAM_CREDENTIAL_SOURCE must be env or convex; got: $credential_source" >&2
      exit 1
      ;;
  esac
}

validate_credential_role() {
  case "$credential_role" in
    "" | maintainer | ci) ;;
    *)
      echo "ACTAGENT_NPM_TELEGRAM_CREDENTIAL_ROLE must be maintainer or ci; got: $credential_role" >&2
      exit 1
      ;;
  esac
}

validate_credential_source
validate_credential_role

validate_credential_preflight() {
  if [ "$credential_source" = "convex" ]; then
    if [ -z "${ACTAGENT_QA_CONVEX_SITE_URL:-}" ]; then
      echo "Missing required env for Convex credential mode: ACTAGENT_QA_CONVEX_SITE_URL" >&2
      exit 1
    fi
    if [ "$credential_role" = "ci" ]; then
      if [ -z "${ACTAGENT_QA_CONVEX_SECRET_CI:-}" ]; then
        echo "Missing required env for Convex ci credential mode: ACTAGENT_QA_CONVEX_SECRET_CI" >&2
        exit 1
      fi
      return 0
    fi
    if [ "$credential_role" = "maintainer" ]; then
      if [ -z "${ACTAGENT_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
        echo "Missing required env for Convex maintainer credential mode: ACTAGENT_QA_CONVEX_SECRET_MAINTAINER" >&2
        exit 1
      fi
      return 0
    fi
    if [ -z "${ACTAGENT_QA_CONVEX_SECRET_CI:-}" ] && [ -z "${ACTAGENT_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
      echo "Missing required env for Convex credential mode: ACTAGENT_QA_CONVEX_SECRET_CI or ACTAGENT_QA_CONVEX_SECRET_MAINTAINER" >&2
      exit 1
    fi
    return 0
  fi

  for key in \
    ACTAGENT_QA_TELEGRAM_GROUP_ID \
    ACTAGENT_QA_TELEGRAM_DRIVER_BOT_TOKEN \
    ACTAGENT_QA_TELEGRAM_SUT_BOT_TOKEN; do
    if [ -z "${!key:-}" ]; then
      echo "Missing required env: $key" >&2
      exit 1
    fi
  done
}

validate_credential_preflight

if [ -n "$credential_source" ]; then
  export ACTAGENT_QA_CREDENTIAL_SOURCE="$credential_source"
fi
if [ -n "$credential_role" ]; then
  export ACTAGENT_QA_CREDENTIAL_ROLE="$credential_role"
fi

if [ -z "$credential_source" ] || [ "$credential_source" = "env" ]; then
  for key in \
    ACTAGENT_QA_TELEGRAM_GROUP_ID \
    ACTAGENT_QA_TELEGRAM_DRIVER_BOT_TOKEN \
    ACTAGENT_QA_TELEGRAM_SUT_BOT_TOKEN; do
    if [ -z "${!key:-}" ]; then
      echo "Missing required env: $key" >&2
      exit 1
    fi
  done
fi

for value in "$credential_source" "$credential_role"; do
  if [[ "$value" == *[$'\n\r']* ]]; then
    echo "Credential source and role must be single-line values." >&2
    exit 1
  fi
done

docker_e2e_build_or_reuse "$IMAGE_NAME" npm-telegram-rtt "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "$DOCKER_TARGET"

mkdir -p "$ROOT_DIR/.artifacts/qa-e2e"
run_log="$(mktemp "${TMPDIR:-/tmp}/actagent-npm-telegram-rtt.XXXXXX")"
npm_prefix_host="$(mktemp -d "$ROOT_DIR/.artifacts/qa-e2e/npm-telegram-rtt-prefix.XXXXXX")"
trap 'rm -f "$run_log"; rm -rf "$npm_prefix_host"' EXIT

docker_env=(
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  -e ACTAGENT_NPM_TELEGRAM_INSTALL_SOURCE="$package_install_source"
  -e ACTAGENT_NPM_TELEGRAM_PACKAGE_LABEL="$PACKAGE_LABEL"
  -e ACTAGENT_NPM_TELEGRAM_OUTPUT_DIR="$OUTPUT_DIR"
  -e ACTAGENT_QA_TELEGRAM_GROUP_ID
  -e ACTAGENT_QA_TELEGRAM_DRIVER_BOT_TOKEN
  -e ACTAGENT_QA_TELEGRAM_SUT_BOT_TOKEN
  -e ACTAGENT_QA_TELEGRAM_CANARY_TIMEOUT_MS="${ACTAGENT_QA_TELEGRAM_CANARY_TIMEOUT_MS:-180000}"
  -e ACTAGENT_QA_TELEGRAM_SCENARIO_TIMEOUT_MS="${ACTAGENT_QA_TELEGRAM_SCENARIO_TIMEOUT_MS:-180000}"
  -e ACTAGENT_NPM_TELEGRAM_SCENARIOS="${ACTAGENT_NPM_TELEGRAM_SCENARIOS:-telegram-mentioned-message-reply}"
  -e ACTAGENT_NPM_TELEGRAM_PROVIDER_MODE="${ACTAGENT_NPM_TELEGRAM_PROVIDER_MODE:-mock-openai}"
  -e ACTAGENT_NPM_TELEGRAM_WARM_SAMPLES="${ACTAGENT_NPM_TELEGRAM_WARM_SAMPLES:-20}"
  -e ACTAGENT_NPM_TELEGRAM_SAMPLE_TIMEOUT_MS="${ACTAGENT_NPM_TELEGRAM_SAMPLE_TIMEOUT_MS:-30000}"
  -e ACTAGENT_NPM_TELEGRAM_MAX_FAILURES="${ACTAGENT_NPM_TELEGRAM_MAX_FAILURES:-${ACTAGENT_NPM_TELEGRAM_WARM_SAMPLES:-20}}"
  -e ACTAGENT_E2E_NPM_INSTALL_TIMEOUT="${ACTAGENT_E2E_NPM_INSTALL_TIMEOUT:-600s}"
)

forward_env_if_set() {
  local key="$1"
  if [ -n "${!key:-}" ]; then
    docker_env+=(-e "$key")
  fi
}

if [ -n "${ACTAGENT_QA_CREDENTIAL_SOURCE:-}" ]; then
  docker_env+=(-e ACTAGENT_QA_CREDENTIAL_SOURCE="$ACTAGENT_QA_CREDENTIAL_SOURCE")
fi
if [ -n "${ACTAGENT_QA_CREDENTIAL_ROLE:-}" ]; then
  docker_env+=(-e ACTAGENT_QA_CREDENTIAL_ROLE="$ACTAGENT_QA_CREDENTIAL_ROLE")
fi

install_env=("${docker_env[@]}")

for key in \
  ACTAGENT_QA_CONVEX_SITE_URL \
  ACTAGENT_QA_CONVEX_SECRET_CI \
  ACTAGENT_QA_CONVEX_SECRET_MAINTAINER \
  ACTAGENT_QA_CREDENTIAL_LEASE_TTL_MS \
  ACTAGENT_QA_CREDENTIAL_HEARTBEAT_INTERVAL_MS \
  ACTAGENT_QA_CREDENTIAL_ACQUIRE_TIMEOUT_MS \
  ACTAGENT_QA_CREDENTIAL_HTTP_TIMEOUT_MS \
  ACTAGENT_QA_CREDENTIAL_HTTP_MAX_BODY_BYTES \
  ACTAGENT_QA_CONVEX_ENDPOINT_PREFIX \
  ACTAGENT_QA_CREDENTIAL_OWNER_ID \
  ACTAGENT_QA_ALLOW_INSECURE_HTTP; do
  forward_env_if_set "$key"
done

run_logged() {
  if ! "$@" >"$run_log" 2>&1; then
    cat "$run_log"
    exit 1
  fi
  cat "$run_log"
  >"$run_log"
}

echo "Installing ${PACKAGE_LABEL} from ${package_install_source}..."
run_logged docker_e2e_docker_run_cmd run --rm \
  "${install_env[@]}" \
  ${package_mount_args[@]+"${package_mount_args[@]}"} \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail

export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

install_source="${ACTAGENT_NPM_TELEGRAM_INSTALL_SOURCE:?missing ACTAGENT_NPM_TELEGRAM_INSTALL_SOURCE}"
package_label="${ACTAGENT_NPM_TELEGRAM_PACKAGE_LABEL:-$install_source}"

npm_install_timeout="${ACTAGENT_E2E_NPM_INSTALL_TIMEOUT:-600s}"
run_npm_install() {
  if [ -z "$npm_install_timeout" ] || [ "$npm_install_timeout" = "0" ]; then
    npm install -g "$install_source" --no-fund --no-audit
    return
  fi

  local timeout_bin=""
  if command -v timeout >/dev/null 2>&1; then
    timeout_bin="timeout"
  elif command -v gtimeout >/dev/null 2>&1; then
    timeout_bin="gtimeout"
  fi
  if [ -z "$timeout_bin" ]; then
    echo "timeout or gtimeout is required for ACTAGENT_E2E_NPM_INSTALL_TIMEOUT=$npm_install_timeout" >&2
    return 127
  fi

  if "$timeout_bin" --kill-after=1s 1s true >/dev/null 2>&1; then
    "$timeout_bin" --kill-after=30s "$npm_install_timeout" npm install -g "$install_source" --no-fund --no-audit
  else
    "$timeout_bin" "$npm_install_timeout" npm install -g "$install_source" --no-fund --no-audit
  fi
}
run_npm_install
command -v actagent
actagent --version
node -p "require('/npm-global/lib/node_modules/actagent/package.json').version"
EOF

echo "Running package Telegram RTT Docker E2E ($PACKAGE_LABEL)..."
run_logged docker_e2e_docker_run_cmd run --rm \
  "${docker_env[@]}" \
  -v "$ROOT_DIR/scripts:/app/scripts:ro" \
  -v "$ROOT_DIR/.artifacts:/app/.artifacts" \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail

export HOME="$(mktemp -d "/tmp/actagent-npm-telegram-rtt.XXXXXX")"
export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export OPENAI_API_KEY="sk-actagent-rtt"
export GATEWAY_AUTH_TOKEN_REF="actagent-rtt"
export ACTAGENT_DISABLE_BONJOUR="1"

install_source="${ACTAGENT_NPM_TELEGRAM_INSTALL_SOURCE:?missing ACTAGENT_NPM_TELEGRAM_INSTALL_SOURCE}"
package_label="${ACTAGENT_NPM_TELEGRAM_PACKAGE_LABEL:-$install_source}"
mock_port="${ACTAGENT_NPM_TELEGRAM_MOCK_PORT:-44080}"
config_path="$HOME/.actagent/actagent.json"
gateway_log="/tmp/actagent-npm-telegram-rtt-gateway.log"
mock_log="/tmp/actagent-npm-telegram-rtt-mock.log"
export MOCK_PORT="$mock_port"
credential_env_file=""
credential_lease_file=""
credential_heartbeat_pid=""
rtt_shell_pid="$$"

dump_logs() {
  local status="$1"
  if [ "$status" -eq 0 ]; then
    return
  fi
  echo "package Telegram RTT failed with exit code $status" >&2
  for file in \
    "$mock_log" \
    "$gateway_log"; do
    if [ -f "$file" ]; then
      echo "--- $file ---" >&2
      sed -n '1,260p' "$file" >&2 || true
    fi
  done
}

cleanup() {
  local status="$?"
  kill ${gateway_pid:-} ${mock_pid:-} ${credential_heartbeat_pid:-} 2>/dev/null || true
  if [ -n "$credential_lease_file" ] && [ -f "$credential_lease_file" ]; then
    node /app/scripts/e2e/npm-telegram-rtt-credentials.mjs release --lease-file "$credential_lease_file" >/dev/null 2>&1 || true
  fi
  rm -f "$credential_env_file" "$credential_lease_file"
  dump_logs "$status"
  exit "$status"
}

start_credential_heartbeat() {
  (
    set +e
    node /app/scripts/e2e/npm-telegram-rtt-credentials.mjs heartbeat --lease-file "$credential_lease_file" &
    local heartbeat_child_pid="$!"
    trap 'kill "$heartbeat_child_pid" 2>/dev/null || true; wait "$heartbeat_child_pid" 2>/dev/null || true; exit 0' TERM INT
    wait "$heartbeat_child_pid"
    local heartbeat_status="$?"
    echo "Convex credential heartbeat exited with status $heartbeat_status" >&2
    kill -TERM "$rtt_shell_pid" 2>/dev/null || true
    exit "$heartbeat_status"
  ) &
  credential_heartbeat_pid="$!"
}

trap cleanup EXIT
trap 'exit 1' TERM INT

if [ "${ACTAGENT_QA_CREDENTIAL_SOURCE:-}" = "convex" ]; then
  credential_env_file="$(mktemp "/tmp/actagent-npm-telegram-rtt-credential-env.XXXXXX")"
  credential_lease_file="$(mktemp "/tmp/actagent-npm-telegram-rtt-credential-lease.XXXXXX")"
  rm -f "$credential_env_file" "$credential_lease_file"
  node /app/scripts/e2e/npm-telegram-rtt-credentials.mjs acquire \
    --credential-env-file "$credential_env_file" \
    --lease-file "$credential_lease_file"
  # shellcheck source=/dev/null
  source "$credential_env_file"
  start_credential_heartbeat
fi

export TELEGRAM_BOT_TOKEN="${ACTAGENT_QA_TELEGRAM_SUT_BOT_TOKEN:?missing ACTAGENT_QA_TELEGRAM_SUT_BOT_TOKEN}"

command -v actagent
actagent --version
installed_version="$(node -p "require('/npm-global/lib/node_modules/actagent/package.json').version")"

node /app/scripts/e2e/mock-openai-server.mjs >"$mock_log" 2>&1 &
mock_pid="$!"
mock_ready=0
for _ in $(seq 1 60); do
  if node --input-type=module -e '
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    try {
      const response = await fetch(process.argv[1], { signal: controller.signal });
      process.exit(response.ok ? 0 : 1);
    } catch {
      process.exit(1);
    } finally {
      clearTimeout(timer);
    }
  ' "http://127.0.0.1:${mock_port}/health"; then
    mock_ready=1
    break
  fi
  sleep 1
done
if [ "$mock_ready" != "1" ]; then
  echo "Mock OpenAI server did not become ready" >&2
  cat "$mock_log" >&2 || true
  exit 1
fi

mkdir -p "$(dirname "$config_path")" "$HOME/.actagent/workspace" "$HOME/.actagent/agents/main/sessions" "$HOME/workspace"

node /app/scripts/e2e/npm-telegram-rtt-config.mjs \
  "$config_path" \
  "$mock_port" \
  "$ACTAGENT_QA_TELEGRAM_GROUP_ID" \
  "$ACTAGENT_QA_TELEGRAM_DRIVER_BOT_TOKEN" \
  "$ACTAGENT_QA_TELEGRAM_SUT_BOT_TOKEN" \
  "$installed_version"

actagent gateway run --verbose >"$gateway_log" 2>&1 &
gateway_pid="$!"
for _ in $(seq 1 120); do
  if ! kill -0 "$gateway_pid" 2>/dev/null; then
    echo "gateway exited before readiness" >&2
    exit 1
  fi
  if bash -c ":</dev/tcp/127.0.0.1/19199" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! bash -c ":</dev/tcp/127.0.0.1/19199" >/dev/null 2>&1; then
  echo "gateway did not open port 19199" >&2
  exit 1
fi

node /app/scripts/e2e/npm-telegram-rtt-driver.mjs
EOF

echo "package Telegram RTT Docker E2E passed ($PACKAGE_LABEL)"
