# actagentdock <!-- omit in toc -->

Stop typing `docker-compose` commands. Just type `actagentdock-start`.

Inspired by Simon Willison's [Running ACTAgent in Docker](https://til.simonwillison.net/llms/actagent-docker).

- [Quickstart](#quickstart)
- [Available Commands](#available-commands)
  - [Basic Operations](#basic-operations)
  - [Container Access](#container-access)
  - [Web UI \& Devices](#web-ui--devices)
  - [Setup \& Configuration](#setup--configuration)
  - [Maintenance](#maintenance)
  - [Utilities](#utilities)
- [Configuration \& Secrets](#configuration--secrets)
  - [Docker Files](#docker-files)
  - [Config Files](#config-files)
  - [Initial Setup](#initial-setup)
  - [How It Works in Docker](#how-it-works-in-docker)
  - [Env Precedence](#env-precedence)
- [Common Workflows](#common-workflows)
  - [Check Status and Logs](#check-status-and-logs)
  - [Set Up WhatsApp Bot](#set-up-whatsapp-bot)
  - [Troubleshooting Device Pairing](#troubleshooting-device-pairing)
  - [Fix Token Mismatch Issues](#fix-token-mismatch-issues)
  - [Permission Denied](#permission-denied)
- [Requirements](#requirements)
- [Development](#development)

## Quickstart

**Install:**

```bash
mkdir -p ~/.actagentdock && curl -sL https://raw.githubusercontent.com/actagent/actagent/main/scripts/actagentdock/actagentdock-helpers.sh -o ~/.actagentdock/actagentdock-helpers.sh
```

```bash
echo 'source ~/.actagentdock/actagentdock-helpers.sh' >> ~/.zshrc && source ~/.zshrc
```

Canonical docs page: https://docs.actagent.ai/install/actagentdock

If you previously installed actagentdock from `scripts/shell-helpers/actagentdock-helpers.sh`, rerun the install command above. The old raw GitHub path has been removed.

**See what you get:**

```bash
actagentdock-help
```

On first command, actagentdock auto-detects your ACTAgent directory:

- Checks common paths (`~/actagent`, `~/workspace/actagent`, etc.)
- If found, asks you to confirm
- Saves to `~/.actagentdock/config`

**First time setup:**

```bash
actagentdock-start
```

```bash
actagentdock-fix-token
```

```bash
actagentdock-dashboard
```

If you see "pairing required":

```bash
actagentdock-devices
```

And approve the request for the specific device:

```bash
actagentdock-approve <request-id>
```

## Available Commands

### Basic Operations

| Command            | Description                     |
| ------------------ | ------------------------------- |
| `actagentdock-start`   | Start the gateway               |
| `actagentdock-stop`    | Stop the gateway                |
| `actagentdock-restart` | Restart the gateway             |
| `actagentdock-status`  | Check container status          |
| `actagentdock-logs`    | View live logs (follows output) |

### Container Access

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `actagentdock-shell`          | Interactive shell inside the gateway container |
| `actagentdock-cli <command>`  | Run ACTAgent CLI commands                      |
| `actagentdock-exec <command>` | Execute arbitrary commands in the container    |

### Web UI & Devices

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `actagentdock-dashboard`    | Open web UI in browser with authentication |
| `actagentdock-devices`      | List device pairing requests               |
| `actagentdock-approve <id>` | Approve a device pairing request           |

### Setup & Configuration

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `actagentdock-fix-token` | Configure gateway authentication token (run once) |

### Maintenance

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `actagentdock-update`  | Pull latest, rebuild image, and restart (one command) |
| `actagentdock-rebuild` | Rebuild the Docker image only                         |
| `actagentdock-clean`   | Remove all containers and volumes (destructive!)      |

### Utilities

| Command                | Description                               |
| ---------------------- | ----------------------------------------- |
| `actagentdock-health`      | Run gateway health check                  |
| `actagentdock-token`       | Display the gateway authentication token  |
| `actagentdock-cd`          | Jump to the ACTAgent project directory    |
| `actagentdock-config`      | Open the ACTAgent config directory        |
| `actagentdock-show-config` | Print config files with redacted values   |
| `actagentdock-workspace`   | Open the workspace directory              |
| `actagentdock-help`        | Show all available commands with examples |

## Configuration & Secrets

The Docker setup uses three config files on the host. The container never stores secrets — everything is bind-mounted from local files.

### Docker Files

| File                          | Purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `Dockerfile`                  | Builds the `actagent:local` image (Node 22, pnpm, non-root `node` user)        |
| `docker-compose.yml`          | Defines `actagent-gateway` and `actagent-cli` services, bind-mounts, ports     |
| `docker-compose.override.yml` | Standard Docker Compose overrides — auto-loaded by actagentdock helpers if present |
| `docker-compose.extra.yml`    | Additional overrides — loaded after the standard override if present           |
| `scripts/docker/setup.sh`     | First-time setup — builds image, creates `.env` from `.env.example`            |
| `.env.example`                | Template for `<project>/.env` with all supported vars and docs                 |

### Config Files

| File                        | Purpose                                          | Examples                                                                                                |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `<project>/.env`            | **Docker infra** — image, ports, gateway token   | `ACTAGENT_GATEWAY_TOKEN`, `ACTAGENT_IMAGE`, `ACTAGENT_GATEWAY_PORT`, `ACTAGENT_AUTH_PROFILE_SECRET_DIR` |
| `~/.actagent/.env`          | **Secrets** — API keys and bot tokens            | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`                                             |
| `~/.actagent/actagent.json` | **Behavior config** — models, channels, policies | Model selection, WhatsApp allowlists, agent settings                                                    |

**Do NOT** put API keys or bot tokens in `actagent.json`. Use `~/.actagent/.env` for all secrets.

### Initial Setup

`./scripts/docker/setup.sh` handles first-time Docker configuration:

- Builds the `actagent:local` image from `Dockerfile`
- Creates `<project>/.env` from `.env.example` with a generated gateway token
- Creates the auth-profile secret key directory
- Sets up `~/.actagent` directories if they don't exist

```bash
./scripts/docker/setup.sh
```

After setup, add your API keys:

```bash
vim ~/.actagent/.env
```

See `.env.example` for all supported keys.

The `Dockerfile` supports optional build args:

- `ACTAGENT_IMAGE_APT_PACKAGES` — extra apt packages to install (e.g. `ffmpeg`); also accepts legacy `ACTAGENT_DOCKER_APT_PACKAGES`
- `ACTAGENT_IMAGE_PIP_PACKAGES` — extra Python packages to install (e.g. `requests==2.32.5`); pin versions and use only package indexes you trust
- `ACTAGENT_INSTALL_BROWSER=1` — pre-install Chromium for browser automation (adds ~300MB, but skips the 60-90s Playwright install on each container start)

### How It Works in Docker

`docker-compose.yml` bind-mounts both config and workspace from the host:

```yaml
volumes:
  - ${ACTAGENT_CONFIG_DIR}:/home/node/.actagent
  - ${ACTAGENT_WORKSPACE_DIR}:/home/node/.actagent/workspace
  - ${ACTAGENT_AUTH_PROFILE_SECRET_DIR}:/home/node/.config/actagent
```

This means:

- `~/.actagent/.env` is available inside the container at `/home/node/.actagent/.env` — ACTAgent loads it automatically as the global env fallback
- `~/.actagent/actagent.json` is available at `/home/node/.actagent/actagent.json` — the gateway watches it and hot-reloads most changes
- `~/.actagent-auth-profile-secrets` is available at `/home/node/.config/actagent` — ACTAgent stores the auth-profile encryption key there
- Downloadable external plugin packages and install records live under the mounted ACTAgent home
- Bundled ACTAgent channel plugins, such as Discord when present in the image,
  should normally load from the image-matched bundled copy. Avoid installing
  pinned `@actagent/*` channel packages into the mounted home unless you
  deliberately want an external npm override.
- No need to add API keys to `docker-compose.yml` or configure anything inside the container
- Keys survive `actagentdock-update`, `actagentdock-rebuild`, and `actagentdock-clean` because they live on the host

The project `.env` feeds Docker Compose directly (gateway token, image name, ports). The `~/.actagent/.env` feeds the ACTAgent process inside the container.

### Example `~/.actagent/.env`

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
```

### Example `<project>/.env`

```bash
ACTAGENT_CONFIG_DIR=/Users/you/.actagent
ACTAGENT_WORKSPACE_DIR=/Users/you/.actagent/workspace
ACTAGENT_GATEWAY_PORT=19199
ACTAGENT_BRIDGE_PORT=18790
ACTAGENT_GATEWAY_BIND=lan
ACTAGENT_GATEWAY_TOKEN=<generated-by-docker-setup>
ACTAGENT_AUTH_PROFILE_SECRET_DIR=/Users/you/.actagent-auth-profile-secrets
ACTAGENT_IMAGE=actagent:local
```

### Env Precedence

ACTAgent loads env vars in this order (highest wins, never overrides existing):

1. **Process environment** — `docker-compose.yml` `environment:` block (gateway token, session keys)
2. **`.env` in CWD** — project root `.env` (Docker infra vars)
3. **`~/.actagent/.env`** — global secrets (API keys, bot tokens)
4. **`actagent.json` `env` block** — inline vars, applied only if still missing
5. **Shell env import** — optional login-shell scrape (`ACTAGENT_LOAD_SHELL_ENV=1`)

## Common Workflows

### Update ACTAgent

> **Important:** `actagent update` does not work inside Docker.
> The container runs as a non-root user with a source-built image, so `npm i -g` fails with EACCES.
> Use `actagentdock-update` instead — it pulls, rebuilds, and restarts from the host.

```bash
actagentdock-update
```

This runs `git pull` → `docker compose build` → `docker compose down/up` in one step.

If you only want to rebuild without pulling:

```bash
actagentdock-rebuild && actagentdock-stop && actagentdock-start
```

### Check Status and Logs

**Restart the gateway:**

```bash
actagentdock-restart
```

**Check container status:**

```bash
actagentdock-status
```

**View live logs:**

```bash
actagentdock-logs
```

### Set Up WhatsApp Bot

**Shell into the container:**

```bash
actagentdock-shell
```

**Inside the container, login to WhatsApp:**

```bash
actagent channels login --channel whatsapp --verbose
```

Scan the QR code with WhatsApp on your phone.

**Verify connection:**

```bash
actagent status
```

### Troubleshooting Device Pairing

**Check for pending pairing requests:**

```bash
actagentdock-devices
```

**Copy the Request ID from the "Pending" table, then approve:**

```bash
actagentdock-approve <request-id>
```

Then refresh your browser.

### Fix Token Mismatch Issues

If you see "gateway token mismatch" errors:

```bash
actagentdock-fix-token
```

This will:

1. Read the token from your `.env` file
2. Configure it in the ACTAgent config
3. Restart the gateway
4. Verify the configuration

### Permission Denied

**Ensure Docker is running and you have permission:**

```bash
docker ps
```

## Requirements

- Docker and Docker Compose installed
- Bash or Zsh shell
- ACTAgent project (run `scripts/docker/setup.sh`)

## Development

**Test with fresh config (mimics first-time install):**

```bash
unset actagentdock_DIR && rm -f ~/.actagentdock/config && source scripts/actagentdock/actagentdock-helpers.sh
```

Then run any command to trigger auto-detect:

```bash
actagentdock-start
```
