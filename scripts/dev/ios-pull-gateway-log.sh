#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <device-udid> <bundle-id> [dest]" >&2
  echo "       ACTAGENT_IOS_DEVICE_UDID=... ACTAGENT_IOS_BUNDLE_ID=... $0" >&2
}

DEVICE_UDID="${1:-${ACTAGENT_IOS_DEVICE_UDID:-}}"
BUNDLE_ID="${2:-${ACTAGENT_IOS_BUNDLE_ID:-}}"
DEST="${3:-${ACTAGENT_IOS_GATEWAY_LOG_DEST:-}}"

if [[ -z "$DEVICE_UDID" || -z "$BUNDLE_ID" ]]; then
  usage
  exit 2
fi

if [[ -z "$DEST" ]]; then
  dest_dir="$(mktemp -d "${TMPDIR:-/tmp}/actagent-ios-gateway.XXXXXX")"
  DEST="$dest_dir/actagent-gateway.log"
fi

xcrun devicectl device copy from \
  --device "$DEVICE_UDID" \
  --domain-type appDataContainer \
  --domain-identifier "$BUNDLE_ID" \
  --source Documents/actagent-gateway.log \
  --destination "$DEST" >/dev/null

echo "Pulled to: $DEST"
tail -n 200 "$DEST"
