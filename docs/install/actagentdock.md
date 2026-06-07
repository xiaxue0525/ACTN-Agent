---
summary: "actagentdock shell helpers for Docker-based ACTAgent installs"
read_when:
  - You run ACTAgent with Docker often and want shorter day-to-day commands
  - You want a helper layer for dashboard, logs, token setup, and pairing flows
title: "actagentdock"
---

actagentdock is a small shell-helper layer for Docker-based ACTAgent installs.

It gives you short commands like `actagentdock-start`, `actagentdock-dashboard`, and `actagentdock-fix-token` instead of longer `docker compose ...` invocations.

If you have not set up Docker yet, start with [Docker](/install/docker).

## Install

Use the canonical helper path:

```bash
mkdir -p ~/.actagentdock && curl -sL https://raw.githubusercontent.com/actagent/actagent/main/scripts/actagentdock/actagentdock-helpers.sh -o ~/.actagentdock/actagentdock-helpers.sh
echo 'source ~/.actagentdock/actagentdock-helpers.sh' >> ~/.zshrc && source ~/.zshrc
```

If you previously installed actagentdock from `scripts/shell-helpers/actagentdock-helpers.sh`, reinstall from the new `scripts/actagentdock/actagentdock-helpers.sh` path. The old raw GitHub path was removed.

## What you get

### Basic operations

| Command            | Description            |
| ------------------ | ---------------------- |
| `actagentdock-start`   | Start the gateway      |
| `actagentdock-stop`    | Stop the gateway       |
| `actagentdock-restart` | Restart the gateway    |
| `actagentdock-status`  | Check container status |
| `actagentdock-logs`    | Follow gateway logs    |

### Container access

| Command                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| `actagentdock-shell`          | Open a shell inside the gateway container     |
| `actagentdock-cli <command>`  | Run ACTAgent CLI commands in Docker           |
| `actagentdock-exec <command>` | Execute an arbitrary command in the container |

### Web UI and pairing

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `actagentdock-dashboard`    | Open the Control UI URL      |
| `actagentdock-devices`      | List pending device pairings |
| `actagentdock-approve <id>` | Approve a pairing request    |

### Setup and maintenance

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `actagentdock-fix-token` | Configure the gateway token inside the container |
| `actagentdock-update`    | Pull, rebuild, and restart                       |
| `actagentdock-rebuild`   | Rebuild the Docker image only                    |
| `actagentdock-clean`     | Remove containers and volumes                    |

### Utilities

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `actagentdock-health`      | Run a gateway health check              |
| `actagentdock-token`       | Print the gateway token                 |
| `actagentdock-cd`          | Jump to the ACTAgent project directory  |
| `actagentdock-config`      | Open `~/.actagent`                      |
| `actagentdock-show-config` | Print config files with redacted values |
| `actagentdock-workspace`   | Open the workspace directory            |

## First-time flow

```bash
actagentdock-start
actagentdock-fix-token
actagentdock-dashboard
```

If the browser says pairing is required:

```bash
actagentdock-devices
actagentdock-approve <request-id>
```

## Config and secrets

actagentdock works with the same Docker config split described in [Docker](/install/docker):

- `<project>/.env` for Docker-specific values like image name, ports, and the gateway token
- `~/.actagent/.env` for env-backed provider keys and bot tokens
- `~/.actagent/agents/<agentId>/agent/auth-profiles.json` for stored provider OAuth/API-key auth
- `~/.actagent/actagent.json` for behavior config

Use `actagentdock-show-config` when you want to inspect the `.env` files and `actagent.json` quickly. It redacts `.env` values in its printed output.

## Related

<CardGroup cols={2}>
  <Card title="Docker" href="/install/docker" icon="docker">
    Canonical Docker install for ACTAgent.
  </Card>
  <Card title="Docker VM runtime" href="/install/docker-vm-runtime" icon="cube">
    Docker-managed VM runtime for hardened isolation.
  </Card>
  <Card title="Updating" href="/install/updating" icon="arrow-up-right-from-square">
    Updating the ACTAgent package and managed services.
  </Card>
</CardGroup>
