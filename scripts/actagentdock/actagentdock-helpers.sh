#!/usr/bin/env bash
# actagentdock - Docker helpers for ACTAgent
# Inspired by Simon Willison's "Running ACTAgent in Docker"
# https://til.simonwillison.net/llms/actagent-docker
#
# Installation:
#   mkdir -p ~/.actagentdock && curl -sL https://raw.githubusercontent.com/actagent/actagent/main/scripts/actagentdock/actagentdock-helpers.sh -o ~/.actagentdock/actagentdock-helpers.sh
#   echo 'source ~/.actagentdock/actagentdock-helpers.sh' >> ~/.zshrc
#
# Usage:
#   actagentdock-help    # Show all available commands

# =============================================================================
# Colors
# =============================================================================
_CLR_RESET='\033[0m'
_CLR_BOLD='\033[1m'
_CLR_DIM='\033[2m'
_CLR_GREEN='\033[0;32m'
_CLR_YELLOW='\033[1;33m'
_CLR_BLUE='\033[0;34m'
_CLR_MAGENTA='\033[0;35m'
_CLR_CYAN='\033[0;36m'
_CLR_RED='\033[0;31m'

# Styled command output (green + bold)
_clr_cmd() {
  echo -e "${_CLR_GREEN}${_CLR_BOLD}$1${_CLR_RESET}"
}

# Inline command for use in sentences
_cmd() {
  echo "${_CLR_GREEN}${_CLR_BOLD}$1${_CLR_RESET}"
}

# =============================================================================
# Config
# =============================================================================
actagentdock_CONFIG="${HOME}/.actagentdock/config"

# Common paths to check for ACTAgent
actagentdock_COMMON_PATHS=(
  "${HOME}/actagent"
  "${HOME}/workspace/actagent"
  "${HOME}/projects/actagent"
  "${HOME}/dev/actagent"
  "${HOME}/code/actagent"
  "${HOME}/src/actagent"
)

_actagentdock_filter_warnings() {
  grep -v "^WARN\|^time="
}

_actagentdock_trim_quotes() {
  local value="$1"
  value="${value#\"}"
  value="${value%\"}"
  printf "%s" "$value"
}

_actagentdock_mask_value() {
  local value="$1"
  local length=${#value}
  if (( length == 0 )); then
    printf "%s" "<empty>"
    return 0
  fi
  if (( length == 1 )); then
    printf "%s" "<redacted:1 char>"
    return 0
  fi
  printf "%s" "<redacted:${length} chars>"
}

_actagentdock_read_config_dir() {
  if [[ ! -f "$actagentdock_CONFIG" ]]; then
    return 1
  fi
  local raw
  raw=$(sed -n 's/^actagentdock_DIR=//p' "$actagentdock_CONFIG" | head -n 1)
  if [[ -z "$raw" ]]; then
    return 1
  fi
  _actagentdock_trim_quotes "$raw"
}

# Ensure actagentdock_DIR is set and valid
_actagentdock_ensure_dir() {
  # Already set and valid?
  if [[ -n "$actagentdock_DIR" && -f "${actagentdock_DIR}/docker-compose.yml" ]]; then
    return 0
  fi

  # Try loading from config
  local config_dir
  config_dir=$(_actagentdock_read_config_dir)
  if [[ -n "$config_dir" && -f "${config_dir}/docker-compose.yml" ]]; then
    actagentdock_DIR="$config_dir"
    return 0
  fi

  # Auto-detect from common paths
  local found_path=""
  for path in "${actagentdock_COMMON_PATHS[@]}"; do
    if [[ -f "${path}/docker-compose.yml" ]]; then
      found_path="$path"
      break
    fi
  done

  if [[ -n "$found_path" ]]; then
    echo ""
    echo "🐲 Found ACTAgent at: $found_path"
    echo -n "   Use this location? [Y/n] "
    read -r response
    if [[ "$response" =~ ^[Nn] ]]; then
      echo ""
      echo "Set actagentdock_DIR manually:"
      echo "  export actagentdock_DIR=/path/to/actagent"
      return 1
    fi
    actagentdock_DIR="$found_path"
  else
    echo ""
    echo "❌ ACTAgent not found in common locations."
    echo ""
    echo "Clone it first:"
    echo ""
    echo "  git clone https://github.com/actagent/actagent.git ~/actagent"
    echo "  cd ~/actagent && ./scripts/docker/setup.sh"
    echo ""
    echo "Or set actagentdock_DIR if it's elsewhere:"
    echo ""
    echo "  export actagentdock_DIR=/path/to/actagent"
    echo ""
    return 1
  fi

  # Save to config
  if [[ ! -d "${HOME}/.actagentdock" ]]; then
    /bin/mkdir -p "${HOME}/.actagentdock"
  fi
  echo "actagentdock_DIR=\"$actagentdock_DIR\"" > "$actagentdock_CONFIG"
  echo "✅ Saved to $actagentdock_CONFIG"
  echo ""
  return 0
}

# Wrapper to run docker compose commands
_actagentdock_compose() {
  _actagentdock_ensure_dir || return 1
  local compose_args=(-f "${actagentdock_DIR}/docker-compose.yml")
  if [[ -f "${actagentdock_DIR}/docker-compose.override.yml" ]]; then
    compose_args+=(-f "${actagentdock_DIR}/docker-compose.override.yml")
  fi
  if [[ -f "${actagentdock_DIR}/docker-compose.extra.yml" ]]; then
    compose_args+=(-f "${actagentdock_DIR}/docker-compose.extra.yml")
  fi
  command docker compose "${compose_args[@]}" "$@"
}

_actagentdock_read_env_token() {
  _actagentdock_ensure_dir || return 1
  if [[ ! -f "${actagentdock_DIR}/.env" ]]; then
    return 1
  fi
  local raw
  raw=$(sed -n 's/^ACTAGENT_GATEWAY_TOKEN=//p' "${actagentdock_DIR}/.env" | head -n 1)
  if [[ -z "$raw" ]]; then
    return 1
  fi
  _actagentdock_trim_quotes "$raw"
}

# Basic Operations
actagentdock-start() {
  _actagentdock_compose up -d actagent-gateway
}

actagentdock-stop() {
  _actagentdock_compose down
}

actagentdock-restart() {
  _actagentdock_compose restart actagent-gateway
}

actagentdock-logs() {
  _actagentdock_compose logs -f actagent-gateway
}

actagentdock-status() {
  _actagentdock_compose ps
}

# Navigation
actagentdock-cd() {
  _actagentdock_ensure_dir || return 1
  cd "${actagentdock_DIR}"
}

actagentdock-config() {
  cd ~/.actagent
}

actagentdock-show-config() {
  _actagentdock_ensure_dir >/dev/null 2>&1 || true
  local config_dir="${HOME}/.actagent"
  echo -e "${_CLR_BOLD}Config directory:${_CLR_RESET} ${_CLR_CYAN}${config_dir}${_CLR_RESET}"
  echo ""

  # Show actagent.json
  if [[ -f "${config_dir}/actagent.json" ]]; then
    echo -e "${_CLR_BOLD}${config_dir}/actagent.json${_CLR_RESET}"
    echo -e "${_CLR_DIM}$(cat "${config_dir}/actagent.json")${_CLR_RESET}"
  else
    echo -e "${_CLR_YELLOW}No actagent.json found${_CLR_RESET}"
  fi
  echo ""

  # Show .env (mask secret values)
  if [[ -f "${config_dir}/.env" ]]; then
    echo -e "${_CLR_BOLD}${config_dir}/.env${_CLR_RESET}"
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
        echo -e "${_CLR_DIM}${line}${_CLR_RESET}"
      elif [[ "$line" == *=* ]]; then
        local key="${line%%=*}"
        local val="${line#*=}"
        echo -e "${_CLR_CYAN}${key}${_CLR_RESET}=${_CLR_DIM}$(_actagentdock_mask_value "$val")${_CLR_RESET}"
      else
        echo -e "${_CLR_DIM}${line}${_CLR_RESET}"
      fi
    done < "${config_dir}/.env"
  else
    echo -e "${_CLR_YELLOW}No .env found${_CLR_RESET}"
  fi
  echo ""

  # Show project .env if available
  if [[ -n "$actagentdock_DIR" && -f "${actagentdock_DIR}/.env" ]]; then
    echo -e "${_CLR_BOLD}${actagentdock_DIR}/.env${_CLR_RESET}"
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
        echo -e "${_CLR_DIM}${line}${_CLR_RESET}"
      elif [[ "$line" == *=* ]]; then
        local key="${line%%=*}"
        local val="${line#*=}"
        echo -e "${_CLR_CYAN}${key}${_CLR_RESET}=${_CLR_DIM}$(_actagentdock_mask_value "$val")${_CLR_RESET}"
      else
        echo -e "${_CLR_DIM}${line}${_CLR_RESET}"
      fi
    done < "${actagentdock_DIR}/.env"
  fi
  echo ""
}

actagentdock-workspace() {
  cd ~/.actagent/workspace
}

# Container Access
actagentdock-shell() {
  _actagentdock_compose exec actagent-gateway \
    bash -c 'echo "alias actagent=\"./actagent.mjs\"" > /tmp/.bashrc_actagent && bash --rcfile /tmp/.bashrc_actagent'
}

actagentdock-exec() {
  _actagentdock_compose exec actagent-gateway "$@"
}

actagentdock-cli() {
  _actagentdock_compose run --rm actagent-cli "$@"
}

# Maintenance
actagentdock-update() {
  _actagentdock_ensure_dir || return 1

  echo "🔄 Updating ACTAgent..."

  echo ""
  echo "📥 Pulling latest source..."
  git -C "${actagentdock_DIR}" pull || { echo "❌ git pull failed"; return 1; }

  echo ""
  echo "🔨 Rebuilding Docker image (this may take a few minutes)..."
  _actagentdock_compose build actagent-gateway || { echo "❌ Build failed"; return 1; }

  echo ""
  echo "♻️  Recreating container with new image..."
  _actagentdock_compose down 2>&1 | _actagentdock_filter_warnings
  _actagentdock_compose up -d actagent-gateway 2>&1 | _actagentdock_filter_warnings

  echo ""
  echo "⏳ Waiting for gateway to start..."
  sleep 5

  echo "✅ Update complete!"
  echo -e "   Verify: $(_cmd actagentdock-cli status)"
}

actagentdock-rebuild() {
  _actagentdock_compose build actagent-gateway
}

actagentdock-clean() {
  _actagentdock_compose down -v --remove-orphans
}

# Health check
actagentdock-health() {
  _actagentdock_ensure_dir || return 1
  local token
  token=$(_actagentdock_read_env_token)
  if [[ -z "$token" ]]; then
    echo "❌ Error: Could not find gateway token"
    echo "   Check: ${actagentdock_DIR}/.env"
    return 1
  fi
  _actagentdock_compose exec -e "ACTAGENT_GATEWAY_TOKEN=$token" actagent-gateway \
    node dist/index.js health
}

# Show gateway token
actagentdock-token() {
  _actagentdock_read_env_token
}

# Fix token configuration (run this once after setup)
actagentdock-fix-token() {
  _actagentdock_ensure_dir || return 1

  echo "🔧 Configuring gateway token..."
  local token
  token=$(actagentdock-token)
  if [[ -z "$token" ]]; then
    echo "❌ Error: Could not find gateway token"
    echo "   Check: ${actagentdock_DIR}/.env"
    return 1
  fi

  echo "📝 Setting token: ${token:0:20}..."

  _actagentdock_compose exec -e "TOKEN=$token" actagent-gateway \
    bash -c './actagent.mjs config set gateway.remote.token "$TOKEN" && ./actagent.mjs config set gateway.auth.token "$TOKEN"' 2>&1 | _actagentdock_filter_warnings

  echo "🔍 Verifying token was saved..."
  local saved_token
  saved_token=$(_actagentdock_compose exec actagent-gateway \
    bash -c "./actagent.mjs config get gateway.remote.token 2>/dev/null" 2>&1 | _actagentdock_filter_warnings | tr -d '\r\n' | head -c 64)

  if [[ "$saved_token" == "$token" ]]; then
    echo "✅ Token saved correctly!"
  else
    echo "⚠️  Token mismatch detected"
    echo "   Expected: ${token:0:20}..."
    echo "   Got: ${saved_token:0:20}..."
  fi

  echo "🔄 Restarting gateway..."
  _actagentdock_compose restart actagent-gateway 2>&1 | _actagentdock_filter_warnings

  echo "⏳ Waiting for gateway to start..."
  sleep 5

  echo "✅ Configuration complete!"
  echo -e "   Try: $(_cmd actagentdock-devices)"
}

# Open dashboard in browser
actagentdock-dashboard() {
  _actagentdock_ensure_dir || return 1

  echo "🐲 Getting dashboard URL..."
  local output exit_status url
  output=$(_actagentdock_compose run --rm actagent-cli dashboard --no-open 2>&1)
  exit_status=$?
  url=$(printf "%s\n" "$output" | _actagentdock_filter_warnings | grep -o 'http[s]\?://[^[:space:]]*' | head -n 1)
  if [[ $exit_status -ne 0 ]]; then
    echo "❌ Failed to get dashboard URL"
    echo -e "   Try restarting: $(_cmd actagentdock-restart)"
    return 1
  fi

  if [[ -n "$url" ]]; then
    echo -e "✅ Opening: ${_CLR_CYAN}${url}${_CLR_RESET}"
    open "$url" 2>/dev/null || xdg-open "$url" 2>/dev/null || echo -e "   Please open manually: ${_CLR_CYAN}${url}${_CLR_RESET}"
    echo ""
    echo -e "${_CLR_CYAN}💡 If you see ${_CLR_RED}'pairing required'${_CLR_CYAN} error:${_CLR_RESET}"
    echo -e "   1. Run: $(_cmd actagentdock-devices)"
    echo "   2. Copy the Request ID from the Pending table"
    echo -e "   3. Run: $(_cmd 'actagentdock-approve <request-id>')"
  else
    echo "❌ Failed to get dashboard URL"
    echo -e "   Try restarting: $(_cmd actagentdock-restart)"
  fi
}

# List device pairings
actagentdock-devices() {
  _actagentdock_ensure_dir || return 1

  echo "🔍 Checking device pairings..."
  local output exit_status
  output=$(_actagentdock_compose exec actagent-gateway node dist/index.js devices list 2>&1)
  exit_status=$?
  printf "%s\n" "$output" | _actagentdock_filter_warnings
  if [ $exit_status -ne 0 ]; then
    echo ""
    echo -e "${_CLR_CYAN}💡 If you see token errors above:${_CLR_RESET}"
    echo -e "   1. Verify token is set: $(_cmd actagentdock-token)"
    echo -e "   2. Try fixing the token automatically: $(_cmd actagentdock-fix-token)"
    echo "   3. If you still see errors, try manual config inside container:"
    echo -e "      $(_cmd actagentdock-shell)"
    echo -e "      $(_cmd 'actagent config get gateway.remote.token')"
    return 1
  fi

  echo ""
  echo -e "${_CLR_CYAN}💡 To approve a pairing request:${_CLR_RESET}"
  echo -e "   $(_cmd 'actagentdock-approve <request-id>')"
}

# Approve device pairing request
actagentdock-approve() {
  _actagentdock_ensure_dir || return 1

  if [[ -z "$1" ]]; then
    echo -e "❌ Usage: $(_cmd 'actagentdock-approve <request-id>')"
    echo ""
    echo -e "${_CLR_CYAN}💡 How to approve a device:${_CLR_RESET}"
    echo -e "   1. Run: $(_cmd actagentdock-devices)"
    echo "   2. Find the Request ID in the Pending table (long UUID)"
    echo -e "   3. Run: $(_cmd 'actagentdock-approve <that-request-id>')"
    echo ""
    echo "Example:"
    echo -e "   $(_cmd 'actagentdock-approve 6f9db1bd-a1cc-4d3f-b643-2c195262464e')"
    return 1
  fi

  echo "✅ Approving device: $1"
  _actagentdock_compose exec actagent-gateway \
    node dist/index.js devices approve "$1" 2>&1 | _actagentdock_filter_warnings

  echo ""
  echo "✅ Device approved! Refresh your browser."
}

# Show all available actagentdock helper commands
actagentdock-help() {
  echo -e "\n${_CLR_BOLD}${_CLR_CYAN}🐲 actagentdock - Docker Helpers for ACTAgent${_CLR_RESET}\n"

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}⚡ Basic Operations${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-start)       ${_CLR_DIM}Start the gateway${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-stop)        ${_CLR_DIM}Stop the gateway${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-restart)     ${_CLR_DIM}Restart the gateway${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-status)      ${_CLR_DIM}Check container status${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-logs)        ${_CLR_DIM}View live logs (follows)${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🐚 Container Access${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-shell)       ${_CLR_DIM}Shell into container (actagent alias ready)${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-cli)         ${_CLR_DIM}Run CLI commands (e.g., actagentdock-cli status)${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-exec) ${_CLR_CYAN}<cmd>${_CLR_RESET}  ${_CLR_DIM}Execute command in gateway container${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🌐 Web UI & Devices${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-dashboard)   ${_CLR_DIM}Open web UI in browser ${_CLR_CYAN}(auto-guides you)${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-devices)     ${_CLR_DIM}List device pairings ${_CLR_CYAN}(auto-guides you)${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-approve) ${_CLR_CYAN}<id>${_CLR_RESET} ${_CLR_DIM}Approve device pairing ${_CLR_CYAN}(with examples)${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}⚙️  Setup & Configuration${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-fix-token)   ${_CLR_DIM}Configure gateway token ${_CLR_CYAN}(run once)${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🔧 Maintenance${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-update)      ${_CLR_DIM}Pull, rebuild, and restart ${_CLR_CYAN}(one-command update)${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-rebuild)     ${_CLR_DIM}Rebuild Docker image only${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-clean)       ${_CLR_RED}⚠️  Remove containers & volumes (nuclear)${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🛠️  Utilities${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-health)      ${_CLR_DIM}Run health check${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-token)       ${_CLR_DIM}Show gateway auth token${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-cd)          ${_CLR_DIM}Jump to actagent project directory${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-config)      ${_CLR_DIM}Open config directory (~/.actagent)${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-show-config) ${_CLR_DIM}Print config files with redacted values${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-workspace)   ${_CLR_DIM}Open workspace directory${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${_CLR_RESET}"
  echo -e "${_CLR_BOLD}${_CLR_GREEN}🚀 First Time Setup${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  1.${_CLR_RESET} $(_cmd actagentdock-start)          ${_CLR_DIM}# Start the gateway${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  2.${_CLR_RESET} $(_cmd actagentdock-fix-token)      ${_CLR_DIM}# Configure token${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  3.${_CLR_RESET} $(_cmd actagentdock-dashboard)      ${_CLR_DIM}# Open web UI${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  4.${_CLR_RESET} $(_cmd actagentdock-devices)        ${_CLR_DIM}# If pairing needed${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  5.${_CLR_RESET} $(_cmd actagentdock-approve) ${_CLR_CYAN}<id>${_CLR_RESET}   ${_CLR_DIM}# Approve pairing${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_GREEN}💬 WhatsApp Setup${_CLR_RESET}"
  echo -e "  $(_cmd actagentdock-shell)"
  echo -e "    ${_CLR_BLUE}>${_CLR_RESET} $(_cmd 'actagent channels login --channel whatsapp')"
  echo -e "    ${_CLR_BLUE}>${_CLR_RESET} $(_cmd 'actagent status')"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_CYAN}💡 All commands guide you through next steps!${_CLR_RESET}"
  echo -e "${_CLR_BLUE}📚 Docs: ${_CLR_RESET}${_CLR_CYAN}https://docs.actagent.ai${_CLR_RESET}"
  echo ""
}
