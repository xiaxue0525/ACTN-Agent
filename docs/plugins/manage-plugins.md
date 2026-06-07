---
summary: "Quick examples for listing, installing, updating, inspecting, and uninstalling ACTAgent plugins"
read_when:
  - You want quick plugin list, install, update, inspect, or uninstall examples
  - You want to choose a plugin install source
  - You want the right reference for publishing plugin packages
title: "Manage plugins"
sidebarTitle: "Manage plugins"
doc-schema-version: 1
---

Use this page for common plugin management commands. For the exhaustive command
contract, flags, source-selection rules, and edge cases, see
[`actagent plugins`](/cli/plugins).

Most install workflows are:

1. find a package
2. install it from ACTAgentHub, npm, git, or a local path
3. let the managed Gateway auto-restart, or restart it manually when unmanaged
4. verify the plugin's runtime registrations

## List and search plugins

```bash
actagent plugins list
actagent plugins list --enabled
actagent plugins list --verbose
actagent plugins list --json
actagent plugins search "calendar"
```

Use `--json` for scripts:

```bash
actagent plugins list --json \
  | jq '.plugins[] | {id, enabled, format, source, dependencyStatus}'
```

`plugins list` is a cold inventory check. It shows what ACTAgent can discover
from config, manifests, and the plugin registry; it does not prove that an
already-running Gateway imported the plugin runtime. The JSON output includes
registry diagnostics and each plugin's static `dependencyStatus` when the
plugin package declares `dependencies` or `optionalDependencies`.

`plugins search` queries ACTAgentHub for installable plugin packages and prints
install hints such as `actagent plugins install actagenthub:<package>`.

## Install plugins

```bash
# Search ACTAgentHub for plugin packages.
actagent plugins search "calendar"

# Install from ACTAgentHub.
actagent plugins install actagenthub:<package>
actagent plugins install actagenthub:<package>@1.2.3
actagent plugins install actagenthub:<package>@beta

# Install from npm.
actagent plugins install npm:<package>
actagent plugins install npm:@scope/actagent-plugin@1.2.3
actagent plugins install npm:@actagent/codex

# Install from a local npm pack artifact.
actagent plugins install npm-pack:<path.tgz>

# Install from git or a local development checkout.
actagent plugins install git:github.com/acme/actagent-plugin@v1.0.0
actagent plugins install ./my-plugin
actagent plugins install --link ./my-plugin
```

Bare package specs install from npm during the launch cutover. Use `actagenthub:`,
`npm:`, `git:`, or `npm-pack:` when you need deterministic source selection.
If the bare name matches an official plugin id, ACTAgent can install the
catalog entry directly.

Use `--force` only when you intentionally want to overwrite an existing install
target. For routine upgrades of tracked npm, ACTAgentHub, or hook-pack installs, use
`actagent plugins update`.

## Restart and inspect

After installing, updating, or uninstalling plugin code, a running managed
Gateway with config reload enabled restarts automatically. If the Gateway is not
managed or reload is disabled, restart it yourself before checking live runtime
surfaces:

```bash
actagent gateway restart
actagent plugins inspect <plugin-id> --runtime --json
```

Use `inspect --runtime` when you need proof that the plugin registered runtime
surfaces such as tools, hooks, services, Gateway methods, HTTP routes, or
plugin-owned CLI commands. Plain `inspect` and `list` are cold manifest,
config, and registry checks.

## Update plugins

```bash
actagent plugins update <plugin-id>
actagent plugins update <npm-package-or-spec>
actagent plugins update --all
actagent plugins update <plugin-id> --dry-run
```

When you pass a plugin id, ACTAgent reuses the tracked install spec. Stored
dist-tags such as `@beta` and exact pinned versions continue to be used on
later `update <plugin-id>` runs.

For npm installs, you can pass an explicit package spec to switch the tracked
record:

```bash
actagent plugins update @scope/actagent-plugin@beta
actagent plugins update @scope/actagent-plugin
```

The second command moves a plugin back to the registry's default release line
when it was previously pinned to an exact version or tag.

When `actagent update` runs on the beta channel, plugin records can prefer
matching `@beta` releases. For the exact fallback and pinning rules, see
[`actagent plugins`](/cli/plugins#update).

## Uninstall plugins

```bash
actagent plugins uninstall <plugin-id> --dry-run
actagent plugins uninstall <plugin-id>
actagent plugins uninstall <plugin-id> --keep-files
```

Uninstall removes the plugin's config entry, persisted plugin index record,
allow/deny list entries, and linked load paths when applicable. Managed install
directories are removed unless you pass `--keep-files`. A running managed
Gateway restarts automatically when the uninstall changes plugin source.

In Nix mode (`ACTAGENT_NIX_MODE=1`), plugin install, update, uninstall, enable,
and disable commands are disabled. Manage those choices in the Nix source for
the install instead.

## Choose a source

| Source      | Use when                                                                    | Example                                                        |
| ----------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ACTAgentHub     | You want ACTAgent-native discovery, scan summaries, versions, and hints     | `actagent plugins install actagenthub:<package>`                   |
| npmjs.com   | You already ship JavaScript packages or need npm dist-tags/private registry | `actagent plugins install npm:@acme/actagent-plugin`           |
| git         | You want a branch, tag, or commit from a repository                         | `actagent plugins install git:github.com/<owner>/<repo>@<ref>` |
| local path  | You are developing or testing a plugin on the same machine                  | `actagent plugins install --link ./my-plugin`                  |
| npm pack    | You are proving a local package artifact through npm install semantics      | `actagent plugins install npm-pack:<path.tgz>`                 |
| marketplace | You are installing a Claude-compatible marketplace plugin                   | `actagent plugins install <plugin> --marketplace <source>`     |

Managed local path installs must be plugin directories or archives. Put
standalone plugin files in `plugins.load.paths` instead of installing them with
`plugins install`.

## Publish plugins

ACTAgentHub is the primary public discovery surface for ACTAgent plugins. Publish
there when you want users to find plugin metadata, version history, registry
scan results, and install hints before they install.

```bash
npm i -g actagenthub
actagenthub login
actagenthub package publish your-org/your-plugin --dry-run
actagenthub package publish your-org/your-plugin
actagenthub package publish your-org/your-plugin@v1.0.0
```

Native npm plugins must include a plugin manifest and package metadata before
publishing:

```json package.json
{
  "name": "@acme/actagent-plugin",
  "version": "1.0.0",
  "type": "module",
  "actagent": {
    "extensions": ["./dist/index.js"]
  }
}
```

```bash
npm publish --access public
actagent plugins install npm:@acme/actagent-plugin
actagent plugins install npm:@acme/actagent-plugin@beta
actagent plugins install npm:@acme/actagent-plugin@1.0.0
```

Use these pages for the full publishing contract instead of treating this page
as the publishing reference:

- [ACTAgentHub publishing](/actagenthub/publishing) explains owners, scopes, releases,
  review, package validation, and package transfer.
- [Building plugins](/plugins/building-plugins) shows the plugin package shape
  and first publish workflow.
- [Plugin manifest](/plugins/manifest) defines native plugin manifest fields.

If the same package is available on both ACTAgentHub and npm, use the explicit
`actagenthub:` or `npm:` prefix when you need to force one source.

## Related

- [Plugins](/tools/plugin) - install, configure, restart, and troubleshoot
- [`actagent plugins`](/cli/plugins) - full CLI reference
- [Community plugins](/plugins/community) - public discovery and ACTAgentHub publishing
- [ACTAgentHub](/actagenthub/cli) - registry CLI operations
- [Building plugins](/plugins/building-plugins) - create a plugin package
- [Plugin manifest](/plugins/manifest) - manifest and package metadata
