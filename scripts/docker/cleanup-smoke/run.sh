#!/usr/bin/env bash
set -euo pipefail

cd /repo

export ACTAGENT_STATE_DIR="/tmp/actagent-test"
export ACTAGENT_CONFIG_PATH="${ACTAGENT_STATE_DIR}/actagent.json"

echo "==> Build"
if ! pnpm build >/tmp/actagent-cleanup-build.log 2>&1; then
  cat /tmp/actagent-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${ACTAGENT_STATE_DIR}/credentials"
mkdir -p "${ACTAGENT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${ACTAGENT_CONFIG_PATH}"
echo 'creds' >"${ACTAGENT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${ACTAGENT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm actagent reset --scope config+creds+sessions --yes --non-interactive >/tmp/actagent-cleanup-reset.log 2>&1; then
  cat /tmp/actagent-cleanup-reset.log
  exit 1
fi

test ! -f "${ACTAGENT_CONFIG_PATH}"
test ! -d "${ACTAGENT_STATE_DIR}/credentials"
test ! -d "${ACTAGENT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${ACTAGENT_STATE_DIR}/credentials"
echo '{}' >"${ACTAGENT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm actagent uninstall --state --yes --non-interactive >/tmp/actagent-cleanup-uninstall.log 2>&1; then
  cat /tmp/actagent-cleanup-uninstall.log
  exit 1
fi

test ! -d "${ACTAGENT_STATE_DIR}"

echo "OK"
