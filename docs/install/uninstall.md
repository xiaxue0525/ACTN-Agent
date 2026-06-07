---
summary: "Uninstall ACTAgent completely (CLI, service, state, workspace)"
read_when:
  - You want to remove ACTAgent from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

Two paths:

- **Easy path** if `actagent` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
actagent uninstall
```

When using the CLI, state removal preserves configured workspace directories unless you also select `--workspace`.

Non-interactive (automation / npx):

```bash
actagent uninstall --all --yes --non-interactive
npx -y actagent uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
actagent gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
actagent gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${ACTAGENT_STATE_DIR:-$HOME/.actagent}"
```

If you set `ACTAGENT_CONFIG_PATH` to a custom location outside the state dir, delete that file too.
If you want to keep a workspace inside the state dir, such as `~/.actagent/workspace`, move it aside before running `rm -rf` or delete state contents selectively.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.actagent/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g actagent
pnpm remove -g actagent
bun remove -g actagent
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/ACTAgent.app
```

Notes:

- If you used profiles (`--profile` / `ACTAGENT_PROFILE`), repeat step 3 for each state dir (defaults are `~/.actagent-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `actagent` is missing.

### macOS (launchd)

Default label is `ai.actagent.gateway` (or `ai.actagent.<profile>`; legacy `com.actagent.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.actagent.gateway
rm -f ~/Library/LaunchAgents/ai.actagent.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.actagent.<profile>`. Remove any legacy `com.actagent.*` plists if present.

### Linux (systemd user unit)

Default unit name is `actagent-gateway.service` (or `actagent-gateway-<profile>.service`):

```bash
systemctl --user disable --now actagent-gateway.service
rm -f ~/.config/systemd/user/actagent-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `ACTAgent Gateway` (or `ACTAgent Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "ACTAgent Gateway"
Remove-Item -Force "$env:USERPROFILE\.actagent\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.actagent-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://actagent.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g actagent@latest`.
Remove it with `npm rm -g actagent` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `actagent ...` / `bun run actagent ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.

## Related

- [Install overview](/install)
- [Migration guide](/install/migrating)
