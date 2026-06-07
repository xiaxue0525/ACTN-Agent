// Npm Update Scripts script supports ACTAgent repository automation.
import { posixAgentWorkspaceScript, windowsAgentWorkspaceScript } from "./agent-workspace.ts";
import { shellQuote } from "./host-command.ts";
import { posixProviderOnlyPluginIsolationScript } from "./plugin-isolation.ts";
import {
  psSingleQuote,
  windowsAgentTurnConfigPatchScript,
  windowsACTAgentResolver,
  windowsScopedEnvFunction,
} from "./powershell.ts";
import {
  modelProviderConfigBatchJson,
  resolveParallelsModelTimeoutSeconds,
} from "./provider-auth.ts";
import type { Platform, ProviderAuth } from "./types.ts";

export interface NpmUpdateScriptInput {
  auth: ProviderAuth;
  expectedNeedle: string;
  updateTarget: string;
}

const windowsStalePostSwapImportRegex = String.raw`node_modules\\actagent\\dist\\[^\\]+-[A-Za-z0-9_-]+\.js`;
const macosGuestPath =
  "/opt/homebrew/bin:/opt/homebrew/opt/node/bin:/usr/local/bin:/usr/local/sbin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin";
const macosACTAgentCommand = '"$ACTAGENT_BIN"';

function posixModelProviderConfigCommands(
  command: string,
  modelId: string,
  platform: Platform,
): string {
  const batchJson = modelProviderConfigBatchJson(modelId, platform);
  if (!batchJson) {
    return "";
  }
  return `provider_config_batch="$(mktemp)"
cat >"$provider_config_batch" <<'JSON'
${batchJson}
JSON
set +e
${command} config set --batch-file "$provider_config_batch" --strict-json
provider_config_exit=$?
set -e
rm -f "$provider_config_batch"
if [ "$provider_config_exit" -ne 0 ]; then exit "$provider_config_exit"; fi`;
}

function posixAssertAgentOkScript(command: string, input: NpmUpdateScriptInput, sessionId: string) {
  return `${posixProviderOnlyPluginIsolationScript({
    fallbackPluginId: input.auth.modelId.split("/", 1)[0] || "openai",
    modelId: input.auth.modelId,
  })}
agent_ok=false
for attempt in 1 2; do
  session_id=${shellQuote(sessionId)}
  if [ "$attempt" -gt 1 ]; then session_id=${shellQuote(`${sessionId}-retry`)}"-$attempt"; fi
  rm -f "$HOME/.actagent/agents/main/sessions/$session_id.jsonl"
  output_file="$(mktemp)"
  set +e
  ACTAGENT_ALLOW_ROOT="\${ACTAGENT_ALLOW_ROOT:-}" ${input.auth.apiKeyEnv}=${shellQuote(input.auth.apiKeyValue)} ${command} agent --local --agent main --session-id "$session_id" --message 'Reply with exact ASCII text OK only.' --thinking off --json >"$output_file" 2>&1
  rc=$?
  set -e
  cat "$output_file"
  if [ "$rc" -ne 0 ]; then
    rm -f "$output_file"
    exit "$rc"
  fi
  if grep -Eq '"finalAssistant(Raw|Visible)Text"[[:space:]]*:[[:space:]]*"OK"' "$output_file"; then
    agent_ok=true
    rm -f "$output_file"
    break
  fi
  rm -f "$output_file"
  if [ "$attempt" -lt 2 ]; then
    echo "agent turn attempt $attempt finished without OK response; retrying"
    sleep 3
  fi
done
if [ "$agent_ok" != true ]; then
  echo "actagent agent finished without OK response" >&2
  exit 1
fi`;
}

function windowsUpdateWithBundledPluginsDisabled(input: NpmUpdateScriptInput): string {
  return `$script:ACTAgentUpdateExit = 0
$updateOutput = Invoke-WithScopedEnv @{ ACTAGENT_DISABLE_BUNDLED_PLUGINS = '1'; ACTAGENT_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS = '1' } {
  Invoke-ACTAgent update --tag ${psSingleQuote(input.updateTarget)} --yes --json --no-restart 2>&1
  $script:ACTAgentUpdateExit = $LASTEXITCODE
}
$updateExit = $script:ACTAgentUpdateExit
$updateOutput`;
}

function windowsGatewayReadyScript(): string {
  return `function Wait-ACTAgentGateway {
  $deadline = (Get-Date).AddSeconds(180)
  $attempt = 0
  while ((Get-Date) -lt $deadline) {
    Invoke-ACTAgent gateway status --deep --require-rpc --timeout 15000
    if ($LASTEXITCODE -eq 0) { return }
    $attempt += 1
    if ($attempt -eq 4) {
      Invoke-ACTAgent gateway start *>&1 | Out-Host
    }
    Start-Sleep -Seconds 5
  }
  throw "gateway did not become ready after update"
}
Invoke-ACTAgent gateway restart *>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  "gateway restart exited with code $LASTEXITCODE; probing readiness before failing" | Out-Host
}
Wait-ACTAgentGateway`;
}

function windowsAssertAgentOkScript(input: NpmUpdateScriptInput): string {
  return `${windowsAgentTurnConfigPatchScript(input.auth.modelId)}
$sessionPath = Join-Path $env:USERPROFILE '.actagent\\agents\\main\\sessions\\parallels-npm-update-windows.jsonl'
Remove-Item $sessionPath -Force -ErrorAction SilentlyContinue
${windowsAgentWorkspaceScript("Parallels npm update smoke test assistant.")}
Set-Item -Path ('Env:' + ${psSingleQuote(input.auth.apiKeyEnv)}) -Value ${psSingleQuote(input.auth.apiKeyValue)}
$agentOk = $false
for ($attempt = 1; $attempt -le 2; $attempt++) {
  $sessionId = if ($attempt -eq 1) { 'parallels-npm-update-windows' } else { "parallels-npm-update-windows-retry-$attempt" }
  $sessionsDir = Join-Path $env:USERPROFILE '.actagent\\agents\\main\\sessions'
  $sessionPath = Join-Path $sessionsDir "$sessionId.jsonl"
  Remove-Item $sessionPath -Force -ErrorAction SilentlyContinue
  $output = Invoke-ACTAgent agent --local --agent main --session-id $sessionId --model ${psSingleQuote(input.auth.modelId)} --message 'Reply with exact ASCII text OK only.' --thinking off --timeout ${resolveParallelsModelTimeoutSeconds("windows")} --json 2>&1
  if ($null -ne $output) { $output | ForEach-Object { $_ } }
  if ($LASTEXITCODE -ne 0) { throw "agent failed with exit code $LASTEXITCODE" }
  if (($output | Out-String) -match '"finalAssistant(Raw|Visible)Text":\\s*"OK"') {
    $agentOk = $true
    break
  }
  if ($attempt -lt 2) {
    Write-Host "agent turn attempt $attempt finished without OK response; retrying"
    Start-Sleep -Seconds 3
  }
}
if (-not $agentOk) { throw 'actagent agent finished without OK response' }`;
}

export function macosUpdateScript(input: NpmUpdateScriptInput): string {
  return String.raw`set -euo pipefail
export PATH=${macosGuestPath}
resolve_required_command() {
  command -v "$1" || {
    echo "required command not found on PATH: $1" >&2
    exit 127
  }
}
ACTAGENT_BIN="$(resolve_required_command actagent)"
scrub_future_plugin_entries() {
  python3 - <<'PY'
import json
from pathlib import Path
path = Path.home() / ".actagent" / "actagent.json"
if not path.exists():
    raise SystemExit(0)
try:
    config = json.loads(path.read_text())
except Exception:
    raise SystemExit(0)
plugins = config.get("plugins")
if not isinstance(plugins, dict):
    raise SystemExit(0)
entries = plugins.get("entries")
if isinstance(entries, dict):
    entries.pop("feishu", None)
    entries.pop("whatsapp", None)
    entries.pop("openai", None)
allow = plugins.get("allow")
if isinstance(allow, list):
    plugins["allow"] = [item for item in allow if item not in {"feishu", "whatsapp", "openai"}]
path.write_text(json.dumps(config, indent=2) + "\n")
PY
}
stop_actagent_gateway_processes() {
  ACTAGENT_DISABLE_BUNDLED_PLUGINS=1 "$ACTAGENT_BIN" gateway stop || true
  pkill -f 'actagent.*gateway' >/dev/null 2>&1 || true
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:19199 -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      kill $pids >/dev/null 2>&1 || true
      sleep 2
      kill -9 $pids >/dev/null 2>&1 || true
    fi
  fi
}
start_actagent_gateway() {
  stop_actagent_gateway_processes
  rm -f /tmp/actagent-parallels-macos-gateway.log
  trap '' HUP
  /usr/bin/env ACTAGENT_HOME="$HOME" ACTAGENT_STATE_DIR="$HOME/.actagent" ACTAGENT_CONFIG_PATH="$HOME/.actagent/actagent.json" ${input.auth.apiKeyEnv}=${shellQuote(
    input.auth.apiKeyValue,
  )} "$ACTAGENT_BIN" gateway run --bind loopback --port 19199 --force >/tmp/actagent-parallels-macos-gateway.log 2>&1 </dev/null &
  sleep 1
}
wait_for_gateway() {
  deadline=$((SECONDS + 240))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if "$ACTAGENT_BIN" gateway status --deep --require-rpc --timeout 15000; then
      return
    fi
    sleep 2
  done
  cat /tmp/actagent-parallels-macos-gateway.log >&2 || true
  echo "gateway did not become ready after update" >&2
  exit 1
}
scrub_future_plugin_entries
stop_actagent_gateway_processes
ACTAGENT_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS=1 ACTAGENT_DISABLE_BUNDLED_PLUGINS=1 "$ACTAGENT_BIN" update --tag ${shellQuote(input.updateTarget)} --yes --json --no-restart
${posixVersionCheck(macosACTAgentCommand, input.expectedNeedle)}
start_actagent_gateway
wait_for_gateway
"$ACTAGENT_BIN" models set ${shellQuote(input.auth.modelId)}
${posixModelProviderConfigCommands(macosACTAgentCommand, input.auth.modelId, "macos")}
"$ACTAGENT_BIN" config set agents.defaults.skipBootstrap true --strict-json
"$ACTAGENT_BIN" config set tools.profile minimal
${posixAgentWorkspaceScript("Parallels npm update smoke test assistant.")}
${posixAssertAgentOkScript(macosACTAgentCommand, input, "parallels-npm-update-macos")}`;
}

export function windowsUpdateScript(input: NpmUpdateScriptInput): string {
  return `$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
${windowsACTAgentResolver}
${windowsScopedEnvFunction}
function Remove-FuturePluginEntries {
  $configPath = Join-Path $env:USERPROFILE '.actagent\\actagent.json'
  if (-not (Test-Path $configPath)) { return }
  try { $config = Get-Content $configPath -Raw | ConvertFrom-Json } catch { return }
  $plugins = Get-ACTAgentJsonProperty $config 'plugins'
  if ($null -eq $plugins) { return }
  $entries = Get-ACTAgentJsonProperty $plugins 'entries'
  if ($null -ne $entries) {
    foreach ($pluginId in @('feishu', 'whatsapp', 'openai')) {
      Remove-ACTAgentJsonProperty $entries $pluginId
    }
  }
  $allow = Get-ACTAgentJsonProperty $plugins 'allow'
  if ($allow -is [array]) {
    Set-ACTAgentJsonProperty $plugins 'allow' @($allow | Where-Object { $_ -notin @('feishu', 'whatsapp', 'openai') })
  }
  $config | ConvertTo-Json -Depth 100 | Set-Content -Path $configPath -Encoding UTF8
}
function Get-ACTAgentJsonProperty {
  param([object]$Object, [string]$Name)
  if ($null -eq $Object) { return $null }
  if ($Object -is [System.Collections.IDictionary]) { return $Object[$Name] }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}
function Set-ACTAgentJsonProperty {
  param([object]$Object, [string]$Name, [object]$Value)
  if ($Object -is [System.Collections.IDictionary]) {
    $Object[$Name] = $Value
    return
  }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property) {
    $property.Value = $Value
    return
  }
  $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
}
function Remove-ACTAgentJsonProperty {
  param([object]$Object, [string]$Name)
  if ($null -eq $Object) { return }
  if ($Object -is [System.Collections.IDictionary]) {
    if ($Object.Contains($Name)) { $Object.Remove($Name) }
    return
  }
  if ($null -ne $Object.PSObject.Properties[$Name]) {
    $Object.PSObject.Properties.Remove($Name)
  }
}
function Stop-ACTAgentGatewayProcesses {
  Invoke-ACTAgent gateway stop *>&1 | Out-Host
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'actagent.*gateway' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-NetTCPConnection -LocalPort 19199 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}
Remove-FuturePluginEntries
Stop-ACTAgentGatewayProcesses
${windowsUpdateWithBundledPluginsDisabled(input)}
if ($updateExit -ne 0) {
  $updateText = $updateOutput | Out-String
  $stalePostSwapImport = $updateText -match 'ERR_MODULE_NOT_FOUND' -and $updateText -match ${psSingleQuote(windowsStalePostSwapImportRegex)}
  if (-not $stalePostSwapImport) { throw "actagent update failed with exit code $updateExit" }
  Write-Host "actagent update returned a stale post-swap module import; continuing to post-update health checks"
}
${windowsVersionCheck(input.expectedNeedle)}
${windowsGatewayReadyScript()}
${windowsAssertAgentOkScript(input)}`;
}

export function linuxUpdateScript(input: NpmUpdateScriptInput): string {
  return String.raw`set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/snap/bin
export ACTAGENT_ALLOW_ROOT=1
scrub_future_plugin_entries() {
  node - <<'JS'
const fs = require("node:fs");
const path = require("node:path");
const configPath = path.join(process.env.HOME || "/root", ".actagent", "actagent.json");
if (!fs.existsSync(configPath)) process.exit(0);
let config;
try { config = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { process.exit(0); }
const plugins = config.plugins;
if (!plugins || typeof plugins !== "object") process.exit(0);
if (plugins.entries && typeof plugins.entries === "object") {
  delete plugins.entries.feishu;
  delete plugins.entries.whatsapp;
  delete plugins.entries.openai;
}
if (Array.isArray(plugins.allow)) {
  plugins.allow = plugins.allow.filter((id) => id !== "feishu" && id !== "whatsapp" && id !== "openai");
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
JS
}
stop_actagent_gateway_processes() {
  ACTAGENT_DISABLE_BUNDLED_PLUGINS=1 ACTAGENT_ALLOW_ROOT=1 actagent gateway stop || true
  pkill -f 'actagent.*gateway' >/dev/null 2>&1 || true
}
start_actagent_gateway() {
  pkill -f "actagent gateway run" >/dev/null 2>&1 || true
  rm -f /tmp/actagent-parallels-linux-gateway.log
  setsid sh -lc ${shellQuote(
    `exec env ACTAGENT_HOME=/root ACTAGENT_STATE_DIR=/root/.actagent ACTAGENT_CONFIG_PATH=/root/.actagent/actagent.json ACTAGENT_DISABLE_BONJOUR=1 ACTAGENT_ALLOW_ROOT=1 ${input.auth.apiKeyEnv}=${shellQuote(
      input.auth.apiKeyValue,
    )} actagent gateway run --bind loopback --port 19199 --force >/tmp/actagent-parallels-linux-gateway.log 2>&1`,
  )} >/dev/null 2>&1 < /dev/null &
}
wait_for_gateway() {
  deadline=$((SECONDS + 240))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if actagent gateway status --deep --require-rpc --timeout 15000; then
      return
    fi
    sleep 2
  done
  cat /tmp/actagent-parallels-linux-gateway.log >&2 || true
  echo "gateway did not become ready after update" >&2
  exit 1
}
scrub_future_plugin_entries
stop_actagent_gateway_processes
ACTAGENT_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS=1 ACTAGENT_DISABLE_BUNDLED_PLUGINS=1 actagent update --tag ${shellQuote(input.updateTarget)} --yes --json --no-restart
${posixVersionCheck("actagent", input.expectedNeedle)}
start_actagent_gateway
wait_for_gateway
actagent models set ${shellQuote(input.auth.modelId)}
${posixModelProviderConfigCommands("actagent", input.auth.modelId, "linux")}
actagent config set agents.defaults.skipBootstrap true --strict-json
actagent config set tools.profile minimal
${posixAgentWorkspaceScript("Parallels npm update smoke test assistant.")}
${posixAssertAgentOkScript("actagent", input, "parallels-npm-update-linux")}`;
}

function posixVersionCheck(command: string, expectedNeedle: string): string {
  const quotedNeedle = shellQuote(expectedNeedle);
  if (!expectedNeedle) {
    return `hash -r || true
version_deadline=$((SECONDS + 60))
while true; do
  if version="$(${command} --version 2>&1)"; then
    version_status=0
    printf '%s\\n' "$version"
    break
  else
    version_status=$?
    printf '%s\\n' "$version"
  fi
  if [ "$SECONDS" -ge "$version_deadline" ]; then
    exit "$version_status"
  fi
  sleep 2
done`;
  }
  return `hash -r || true
version_deadline=$((SECONDS + 60))
while true; do
  if version="$(${command} --version 2>&1)"; then
    version_status=0
    printf '%s\\n' "$version"
    case "$version" in *${quotedNeedle}*) break ;; esac
  else
    version_status=$?
    printf '%s\\n' "$version"
  fi
  if [ "$SECONDS" -ge "$version_deadline" ]; then
    if [ "$version_status" -ne 0 ]; then
      exit "$version_status"
    fi
    echo "version mismatch: expected ${expectedNeedle}" >&2
    exit 1
  fi
  sleep 2
done`;
}

function windowsVersionCheck(expectedNeedle: string): string {
  if (!expectedNeedle) {
    return `$versionDeadline = (Get-Date).AddSeconds(60)
while ($true) {
  $version = Invoke-ACTAgent --version
  $version
  if ($LASTEXITCODE -eq 0) { break }
  if ((Get-Date) -ge $versionDeadline) { throw "actagent --version failed with exit code $LASTEXITCODE" }
  Start-Sleep -Seconds 2
}`;
  }
  const expectedPattern = psSingleQuote(`*${expectedNeedle}*`);
  const mismatch = psSingleQuote(`version mismatch: expected ${expectedNeedle}`);
  return `$versionDeadline = (Get-Date).AddSeconds(60)
while ($true) {
  $version = Invoke-ACTAgent --version
  $version
  if ($LASTEXITCODE -eq 0 -and (($version | Out-String) -like ${expectedPattern})) { break }
  if ((Get-Date) -ge $versionDeadline) {
    if ($LASTEXITCODE -ne 0) { throw "actagent --version failed with exit code $LASTEXITCODE" }
    throw ${mismatch}
  }
  Start-Sleep -Seconds 2
}`;
}
