run_plugins_actagenthub_scenario() {
  if [ "${ACTAGENT_PLUGINS_E2E_ACTAGENTHUB:-1}" = "0" ]; then
    echo "Skipping ACTAgentHub plugin install and uninstall (ACTAGENT_PLUGINS_E2E_ACTAGENTHUB=0)."
  else
    echo "Testing ACTAgentHub plugin install and uninstall..."
    ACTAGENTHUB_PLUGIN_SPEC="${ACTAGENT_PLUGINS_E2E_ACTAGENTHUB_SPEC:-actagenthub:@actagent/kitchen-sink}"
    ACTAGENTHUB_PLUGIN_ID="${ACTAGENT_PLUGINS_E2E_ACTAGENTHUB_ID:-actagent-kitchen-sink-fixture}"
    export ACTAGENTHUB_PLUGIN_SPEC ACTAGENTHUB_PLUGIN_ID

    start_actagenthub_fixture_server() {
      local fixture_dir="$1"
      local server_log="$fixture_dir/actagenthub-fixture.log"
      local server_port_file="$fixture_dir/actagenthub-fixture-port"
      local server_pid_file="$fixture_dir/actagenthub-fixture-pid"

      node scripts/e2e/lib/actagenthub-fixture-server.cjs plugins "$server_port_file" >"$server_log" 2>&1 &
      local server_pid="$!"
      echo "$server_pid" >"$server_pid_file"
      actagent_plugins_register_fixture_pid_file "$server_pid_file"

      for _ in $(seq 1 100); do
        if [[ -s "$server_port_file" ]]; then
          export ACTAGENT_ACTAGENTHUB_URL="http://127.0.0.1:$(cat "$server_port_file")"
          return 0
        fi
        if ! kill -0 "$server_pid" 2>/dev/null; then
          cat "$server_log"
          return 1
        fi
        sleep 0.1
      done

      cat "$server_log"
      echo "Timed out waiting for ACTAgentHub fixture server." >&2
      return 1
    }

    if [[ "${ACTAGENT_PLUGINS_E2E_LIVE_ACTAGENTHUB:-0}" = "1" ]]; then
      export ACTAGENT_ACTAGENTHUB_URL="${ACTAGENT_ACTAGENTHUB_URL:-${ACTAGENTHUB_URL:-https://actagenthub.ai}}"
      export NPM_CONFIG_REGISTRY="${ACTAGENT_PLUGINS_E2E_LIVE_NPM_REGISTRY:-https://registry.npmjs.org/}"
    else
      # Keep the release-path smoke hermetic; live ACTAgentHub can rate-limit CI.
      if [[ -n "${ACTAGENT_ACTAGENTHUB_URL:-}" || -n "${ACTAGENTHUB_URL:-}" ]]; then
        echo "Ignoring ambient ACTAgentHub URL for fixture-mode plugin E2E; set ACTAGENT_PLUGINS_E2E_LIVE_ACTAGENTHUB=1 for live ACTAgentHub."
      fi
      unset ACTAGENT_ACTAGENTHUB_URL ACTAGENTHUB_URL
      actagenthub_fixture_dir="$(mktemp -d "$ACTAGENT_PLUGINS_TMP_DIR/actagent-actagenthub-fixture.XXXXXX")"
      start_actagenthub_fixture_server "$actagenthub_fixture_dir"
    fi

    node scripts/e2e/lib/plugins/assertions.mjs actagenthub-preflight

    run_plugins_actagent_logged install-actagenthub plugins install "$ACTAGENTHUB_PLUGIN_SPEC"
    run_plugins_actagent_capture "$ACTAGENT_PLUGINS_TMP_DIR/plugins-actagenthub-installed.json" plugins list --json
    run_plugins_actagent_capture "$ACTAGENT_PLUGINS_TMP_DIR/plugins-actagenthub-inspect.json" plugins inspect "$ACTAGENTHUB_PLUGIN_ID" --json

    node scripts/e2e/lib/plugins/assertions.mjs actagenthub-installed

    actagent_e2e_maybe_timeout "$ACTAGENT_PLUGINS_CLI_TIMEOUT" node "$ACTAGENT_ENTRY" plugins update "$ACTAGENTHUB_PLUGIN_ID" >"$ACTAGENT_PLUGINS_TMP_DIR/plugins-actagenthub-update.log" 2>&1
    run_plugins_actagent_capture "$ACTAGENT_PLUGINS_TMP_DIR/plugins-actagenthub-updated.json" plugins list --json
    run_plugins_actagent_capture "$ACTAGENT_PLUGINS_TMP_DIR/plugins-actagenthub-updated-inspect.json" plugins inspect "$ACTAGENTHUB_PLUGIN_ID" --json

    node scripts/e2e/lib/plugins/assertions.mjs actagenthub-updated

    run_plugins_actagent_logged uninstall-actagenthub plugins uninstall "$ACTAGENTHUB_PLUGIN_SPEC" --force
    run_plugins_actagent_capture "$ACTAGENT_PLUGINS_TMP_DIR/plugins-actagenthub-uninstalled.json" plugins list --json

    node scripts/e2e/lib/plugins/assertions.mjs actagenthub-removed
  fi
}
