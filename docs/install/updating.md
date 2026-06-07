---
summary: "Updating ACTAgent safely (global install or source), plus rollback strategy"
read_when:
  - Updating ACTAgent
  - Something breaks after an update
title: "Updating"
---

Keep ACTAgent up to date.

## Recommended: `actagent update`

The fastest way to update. It detects your install type (npm or git), fetches the latest version, runs `actagent doctor`, and restarts the gateway.

```bash
actagent update
```

To switch channels or target a specific version:

```bash
actagent update --channel beta
actagent update --channel dev
actagent update --dry-run   # preview without applying
```

`actagent update` does not accept `--verbose`. For update diagnostics, use
`--dry-run` to preview the planned actions, `--json` for structured results, or
`actagent update status --json` to inspect channel and availability state. The
installer has its own `--verbose` flag, but that flag is not part of
`actagent update`.

`--channel beta` prefers beta, but the runtime falls back to stable/latest when
the beta tag is missing or older than the latest stable release. Use `--tag beta`
if you want the raw npm beta dist-tag for a one-off package update.

Use `--channel dev` for a persistent moving GitHub `main` checkout. For package
updates, `--tag main` maps to `github:actagent/actagent#main` for one run, and
GitHub/git source specs are packed into a temporary tarball before the staged
npm install.

For managed plugins, beta-channel fallback is a warning: the core update can
still succeed while a plugin uses its recorded default/latest release because no
plugin beta is available.

See [Development channels](/install/development-channels) for channel semantics.

## Switch between npm and git installs

Use channels when you want to change the install type. The updater keeps your
state, config, credentials, and workspace in `~/.actagent`; it only changes
which ACTAgent code install the CLI and gateway use.

```bash
# npm package install -> editable git checkout
actagent update --channel dev

# git checkout -> npm package install
actagent update --channel stable
```

Run with `--dry-run` first to preview the exact install-mode switch:

```bash
actagent update --channel dev --dry-run
actagent update --channel stable --dry-run
```

The `dev` channel ensures a git checkout, builds it, and installs the global CLI
from that checkout. The `stable` and `beta` channels use package installs. If the
gateway is already installed, `actagent update` refreshes the service metadata
and restarts it unless you pass `--no-restart`.

For package installs with a managed Gateway service, `actagent update` targets
the package root used by that service. If the shell `actagent` command comes
from a different install, the updater prints both roots and the managed service
Node path. The package update uses the package manager that owns the service
root and checks the managed service Node against the target release engine
before replacing the package.

## Alternative: re-run the installer

```bash
curl -fsSL https://actagent.ai/install.sh | bash
```

Add `--no-onboard` to skip onboarding. To force a specific install type through
the installer, pass `--install-method git --no-onboard` or
`--install-method npm --no-onboard`.

If `actagent update` fails after the npm package install phase, re-run the
installer. The installer does not call the old updater; it runs the global
package install directly and can recover a partially updated npm install.

```bash
curl -fsSL https://actagent.ai/install.sh | bash -s -- --install-method npm
```

To pin the recovery to a specific version or dist-tag, add `--version`:

```bash
curl -fsSL https://actagent.ai/install.sh | bash -s -- --install-method npm --version <version-or-dist-tag>
```

## Alternative: manual npm, pnpm, or bun

```bash
npm i -g actagent@latest
```

Prefer `actagent update` for supervised installs because it can coordinate the
package swap with the running Gateway service. If you update manually on a
supervised install, stop the managed Gateway before the package manager starts.
Package managers replace files in place, and a running Gateway can otherwise try
to load core or plugin files while the package tree is temporarily half-swapped.
Restart the Gateway after the package manager finishes so the service picks up
the new install.

For a root-owned Linux system-global install, if `actagent update` fails with
`EACCES` and you recover with system npm, keep the Gateway stopped through the
manual package replacement. Use the same `actagent` profile flags or environment
you normally use for that Gateway. Replace `/usr/bin/npm` with the system npm
that owns the root-owned global prefix on your host:

```bash
actagent gateway stop
sudo /usr/bin/npm i -g actagent@latest
actagent gateway install --force
actagent gateway restart
```

Then verify the service:

```bash
actagent --version
curl -fsS http://127.0.0.1:19199/readyz
actagent plugins list --json
actagent gateway status --deep --json
actagent doctor --lint --json
```

When `actagent update` manages a global npm install, it installs the target into
a temporary npm prefix first, verifies the packaged `dist` inventory, then swaps
the clean package tree into the real global prefix. That avoids npm overlaying a
new package onto stale files from the old package. If the install command fails,
ACTAgent retries once with `--omit=optional`. That retry helps hosts where native
optional dependencies cannot compile, while keeping the original failure visible
if the fallback also fails.

ACTAgent-managed npm update and plugin-update commands also clear npm
`min-release-age` quarantine for the child npm process. npm may report that
policy as a derived `before` cutoff; both are useful for general supply-chain
quarantine policies, but an explicit ACTAgent update means "install the selected
ACTAgent release now."

```bash
pnpm add -g actagent@latest
```

```bash
bun add -g actagent@latest
```

### Advanced npm install topics

<AccordionGroup>
  <Accordion title="Read-only package tree">
    ACTAgent treats packaged global installs as read-only at runtime, even when the global package directory is writable by the current user. Plugin package installs live in ACTAgent-owned npm/git roots under the user config directory, and Gateway startup does not mutate the ACTAgent package tree.

    Some Linux npm setups install global packages under root-owned directories such as `/usr/lib/node_modules/actagent`. ACTAgent supports that layout because plugin install/update commands write outside that global package directory.

  </Accordion>
  <Accordion title="Hardened systemd units">
    Give ACTAgent write access to its config/state roots so explicit plugin installs, plugin updates, and doctor cleanup can persist their changes:

    ```ini
    ReadWritePaths=/var/lib/actagent /home/actagent/.actagent /tmp
    ```

  </Accordion>
  <Accordion title="Disk-space preflight">
    Before package updates and explicit plugin installs, ACTAgent tries a best-effort disk-space check for the target volume. Low space produces a warning with the checked path, but does not block the update because filesystem quotas, snapshots, and network volumes can change after the check. The actual package-manager install and post-install verification remain authoritative.
  </Accordion>
</AccordionGroup>

## Auto-updater

The auto-updater is off by default. Enable it in `~/.actagent/actagent.json`:

```json5
{
  update: {
    channel: "stable",
    auto: {
      enabled: true,
      stableDelayHours: 6,
      stableJitterHours: 12,
      betaCheckIntervalHours: 1,
    },
  },
}
```

| Channel  | Behavior                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| `stable` | Waits `stableDelayHours`, then applies with deterministic jitter across `stableJitterHours` (spread rollout). |
| `beta`   | Checks every `betaCheckIntervalHours` (default: hourly) and applies immediately.                              |
| `dev`    | No automatic apply. Use `actagent update` manually.                                                           |

The gateway also logs an update hint on startup (disable with `update.checkOnStart: false`).
For downgrade or incident recovery, set `ACTAGENT_NO_AUTO_UPDATE=1` in the gateway environment to block automatic applies even when `update.auto.enabled` is configured. Startup update hints can still run unless `update.checkOnStart` is also disabled.

Package-manager updates requested through the live Gateway control-plane handler
do not replace the package tree inside the running Gateway process. On managed
service installs, the Gateway starts a detached handoff, exits, and lets the
normal `actagent update --yes --json` CLI path stop the service, replace the
package, refresh service metadata, restart, verify the Gateway version and
reachability, and recover an installed-but-unloaded macOS LaunchAgent when
possible. If the Gateway cannot make that handoff safely, `update.run` reports a
safe shell command instead of running the package manager in-process.

## After updating

<Steps>

### Run doctor

```bash
actagent doctor
```

Migrates config, audits DM policies, and checks gateway health. Details: [Doctor](/gateway/doctor)

### Restart the gateway

```bash
actagent gateway restart
```

### Verify

```bash
actagent health
```

</Steps>

## Rollback

### Pin a version (npm)

```bash
npm i -g actagent@<version>
actagent doctor
actagent gateway restart
```

<Tip>
`npm view actagent version` shows the current published version.
</Tip>

### Pin a commit (source)

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
pnpm install && pnpm build
actagent gateway restart
```

To return to latest: `git checkout main && git pull`.

## If you are stuck

- Run `actagent doctor` again and read the output carefully.
- For `actagent update --channel dev` on source checkouts, the updater auto-bootstraps `pnpm` when needed. If you see a pnpm/corepack bootstrap error, install `pnpm` manually (or re-enable `corepack`) and rerun the update.
- Check: [Troubleshooting](/gateway/troubleshooting)
- Ask in Discord: [https://discord.gg/actagentd](https://discord.gg/actagentd)

## Related

- [Install overview](/install): all installation methods.
- [Doctor](/gateway/doctor): health checks after updates.
- [Migrating](/install/migrating): major version migration guides.
