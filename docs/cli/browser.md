---
summary: "CLI reference for `actagent browser` (lifecycle, profiles, tabs, actions, state, and debugging)"
read_when:
  - You use `actagent browser` and want examples for common tasks
  - You want to control a browser running on another machine via a node host
  - You want to attach to your local signed-in Chrome via Chrome MCP
title: "Browser"
---

# `actagent browser`

Manage ACTAgent's browser control surface and run browser actions (lifecycle, profiles, tabs, snapshots, screenshots, navigation, input, state emulation, and debugging).

Related:

- Browser tool + API: [Browser tool](/tools/browser)

## Common flags

- `--url <gatewayWsUrl>`: Gateway WebSocket URL (defaults to config).
- `--token <token>`: Gateway token (if required).
- `--timeout <ms>`: request timeout (ms).
- `--expect-final`: wait for a final Gateway response.
- `--browser-profile <name>`: choose a browser profile (default from config).
- `--json`: machine-readable output (where supported).

## Quick start (local)

```bash
actagent browser profiles
actagent browser --browser-profile actagent start
actagent browser --browser-profile actagent open https://example.com
actagent browser --browser-profile actagent snapshot
```

Agents can run the same readiness check with `browser({ action: "doctor" })`.

## Quick troubleshooting

If `start` fails with `not reachable after start`, troubleshoot CDP readiness first. If `start` and `tabs` succeed but `open` or `navigate` fails, the browser control plane is healthy and the failure is usually navigation SSRF policy.

Minimal sequence:

```bash
actagent browser --browser-profile actagent doctor
actagent browser --browser-profile actagent start
actagent browser --browser-profile actagent tabs
actagent browser --browser-profile actagent open https://example.com
```

Detailed guidance: [Browser troubleshooting](/tools/browser#cdp-startup-failure-vs-navigation-ssrf-block)

## Lifecycle

```bash
actagent browser status
actagent browser doctor
actagent browser doctor --deep
actagent browser start
actagent browser start --headless
actagent browser stop
actagent browser --browser-profile actagent reset-profile
```

Notes:

- `doctor --deep` adds a live snapshot probe. It is useful when basic CDP
  readiness is green but you want proof that the current tab can be inspected.
- For `attachOnly` and remote CDP profiles, `actagent browser stop` closes the
  active control session and clears temporary emulation overrides even when
  ACTAgent did not launch the browser process itself.
- For local managed profiles, `actagent browser stop` stops the spawned browser
  process.
- `actagent browser start --headless` applies only to that start request and
  only when ACTAgent launches a local managed browser. It does not rewrite
  `browser.headless` or profile config, and it is a no-op for an already-running
  browser.
- On Linux hosts without `DISPLAY` or `WAYLAND_DISPLAY`, local managed profiles
  run headless automatically unless `ACTAGENT_BROWSER_HEADLESS=0`,
  `browser.headless=false`, or `browser.profiles.<name>.headless=false`
  explicitly requests a visible browser.

## If the command is missing

If `actagent browser` is an unknown command, check `plugins.allow` in
`~/.actagent/actagent.json`.

When `plugins.allow` is present, list the bundled browser plugin explicitly
unless the config already has a root `browser` block:

```json5
{
  plugins: {
    allow: ["telegram", "browser"],
  },
}
```

An explicit root `browser` block, for example `browser.enabled=true` or
`browser.profiles.<name>`, also activates the bundled browser plugin under a
restrictive plugin allowlist.

Related: [Browser tool](/tools/browser#missing-browser-command-or-tool)

## Profiles

Profiles are named browser routing configs. In practice:

- `actagent`: launches or attaches to a dedicated ACTAgent-managed Chrome instance (isolated user data dir).
- `user`: controls your existing signed-in Chrome session via Chrome DevTools MCP.
- custom CDP profiles: point at a local or remote CDP endpoint.

```bash
actagent browser profiles
actagent browser create-profile --name work --color "#FF5A36"
actagent browser create-profile --name chrome-live --driver existing-session
actagent browser create-profile --name remote --cdp-url https://browser-host.example.com
actagent browser delete-profile --name work
```

Use a specific profile:

```bash
actagent browser --browser-profile work tabs
```

## Tabs

```bash
actagent browser tabs
actagent browser tab new --label docs
actagent browser tab label t1 docs
actagent browser tab select 2
actagent browser tab close 2
actagent browser open https://docs.actagent.ai --label docs
actagent browser focus docs
actagent browser close t1
```

`tabs` returns `suggestedTargetId` first, then the stable `tabId` such as `t1`,
the optional label, and the raw `targetId`. Agents should pass
`suggestedTargetId` back into `focus`, `close`, snapshots, and actions. You can
assign a label with `open --label`, `tab new --label`, or `tab label`; labels,
tab ids, raw target ids, and unique target-id prefixes are all accepted.
The request field is still named `targetId` for compatibility, but it accepts
these tab references. Treat raw target ids as diagnostic handles, not durable
agent memory.
When Chromium replaces the underlying raw target during a navigation or form
submit, ACTAgent keeps the stable `tabId`/label attached to the replacement tab
when it can prove the match. Raw target ids remain volatile; prefer
`suggestedTargetId`.

## Snapshot / screenshot / actions

Snapshot:

```bash
actagent browser snapshot
actagent browser snapshot --urls
```

Screenshot:

```bash
actagent browser screenshot
actagent browser screenshot --full-page
actagent browser screenshot --ref e12
actagent browser screenshot --labels
```

Notes:

- `--full-page` is for page captures only; it cannot be combined with `--ref`
  or `--element`.
- `existing-session` / `user` profiles support page screenshots and `--ref`
  screenshots from snapshot output, but not CSS `--element` screenshots.
- `--labels` overlays current snapshot refs on the screenshot.
- `snapshot --urls` appends discovered link destinations to AI snapshots so
  agents can choose direct navigation targets instead of guessing from link
  text alone.

Navigate/click/type (ref-based UI automation):

```bash
actagent browser navigate https://example.com
actagent browser click <ref>
actagent browser click-coords 120 340
actagent browser type <ref> "hello"
actagent browser press Enter
actagent browser hover <ref>
actagent browser scrollintoview <ref>
actagent browser drag <startRef> <endRef>
actagent browser select <ref> OptionA OptionB
actagent browser fill --fields '[{"ref":"1","value":"Ada"}]'
actagent browser wait --text "Done"
actagent browser evaluate --fn '(el) => el.textContent' --ref <ref>
actagent browser evaluate --timeout-ms 30000 --fn 'async () => { await window.ready; return true; }'
```

Use `evaluate --timeout-ms <ms>` when the page-side function may need longer
than the default evaluate timeout.

Action responses return the current raw `targetId` after action-triggered page
replacement when ACTAgent can prove the replacement tab. Scripts should still
store and pass `suggestedTargetId`/labels for long-lived workflows.

File + dialog helpers:

```bash
actagent browser upload /tmp/actagent/uploads/file.pdf --ref <ref>
actagent browser upload media://inbound/file.pdf --ref <ref>
actagent browser waitfordownload
actagent browser download <ref> report.pdf
actagent browser dialog --accept
actagent browser dialog --dismiss --dialog-id d1
```

Managed Chrome profiles save ordinary click-triggered downloads into the ACTAgent
downloads directory (`/tmp/actagent/downloads` by default, or the configured temp
root). Use `waitfordownload` or `download` when the agent needs to wait for a
specific file and return its path; those explicit waiters own the next download.
Uploads accept files from the ACTAgent temp uploads root and ACTAgent-managed
inbound media, including `media://inbound/<id>` and sandbox-relative
`media/inbound/<id>` references. Nested media refs, traversal, and arbitrary
local paths remain rejected.
When an action opens a modal dialog, the action response returns
`blockedByDialog` with `browserState.dialogs.pending`; pass `--dialog-id` to
answer it directly. Dialogs handled outside ACTAgent appear under
`browserState.dialogs.recent`.

## State and storage

Viewport + emulation:

```bash
actagent browser resize 1280 720
actagent browser set viewport 1280 720
actagent browser set offline on
actagent browser set media dark
actagent browser set timezone Europe/London
actagent browser set locale en-GB
actagent browser set geo 51.5074 -0.1278 --accuracy 25
actagent browser set device "iPhone 14"
actagent browser set headers '{"x-test":"1"}'
actagent browser set credentials myuser mypass
```

Cookies + storage:

```bash
actagent browser cookies
actagent browser cookies set session abc123 --url https://example.com
actagent browser cookies clear
actagent browser storage local get
actagent browser storage local set token abc123
actagent browser storage session clear
```

## Debugging

```bash
actagent browser console --level error
actagent browser pdf
actagent browser responsebody "**/api"
actagent browser highlight <ref>
actagent browser errors --clear
actagent browser requests --filter api
actagent browser trace start
actagent browser trace stop --out trace.zip
```

## Existing Chrome via MCP

Use the built-in `user` profile, or create your own `existing-session` profile:

```bash
actagent browser --browser-profile user tabs
actagent browser create-profile --name chrome-live --driver existing-session
actagent browser create-profile --name brave-live --driver existing-session --user-data-dir "~/Library/Application Support/BraveSoftware/Brave-Browser"
actagent browser --browser-profile chrome-live tabs
```

This path is host-only. For Docker, headless servers, Browserless, or other remote setups, use a CDP profile instead.

Current existing-session limits:

- snapshot-driven actions use refs, not CSS selectors
- `browser.actionTimeoutMs` defaults supported `act` requests to 60000 ms when
  callers omit `timeoutMs`; per-call `timeoutMs` still wins.
- `click` is left-click only
- `type` does not support `slowly=true`
- `press` does not support `delayMs`
- `hover`, `scrollintoview`, `drag`, `select`, `fill`, and `evaluate` reject
  per-call timeout overrides
- `select` supports one value only
- `wait --load networkidle` is not supported
- file uploads require `--ref` / `--input-ref`, do not support CSS
  `--element`, and currently support one file at a time
- dialog hooks do not support `--timeout`
- screenshots support page captures and `--ref`, but not CSS `--element`
- `responsebody`, download interception, PDF export, and batch actions still
  require a managed browser or raw CDP profile

## Remote browser control (node host proxy)

If the Gateway runs on a different machine than the browser, run a **node host** on the machine that has Chrome/Brave/Edge/Chromium. The Gateway will proxy browser actions to that node (no separate browser control server required).

Use `gateway.nodes.browser.mode` to control auto-routing and `gateway.nodes.browser.node` to pin a specific node if multiple are connected.

Security + remote setup: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)

## Related

- [CLI reference](/cli)
- [Browser](/tools/browser)
