---
summary: "Where ACTAgent loads environment variables and the precedence order"
read_when:
  - You need to know which env vars are loaded, and in what order
  - You are debugging missing API keys in the Gateway
  - You are documenting provider auth or deployment environments
title: "Environment variables"
---

ACTAgent pulls environment variables from multiple sources. The rule is **never override existing values**.
Workspace `.env` files are a lower-trust source: ACTAgent ignores provider credentials and protected runtime controls from workspace `.env` before applying precedence.

## Precedence (highest → lowest)

1. **Process environment** (what the Gateway process already has from the parent shell/daemon).
2. **`.env` in the current working directory** (dotenv default; does not override; provider credentials and protected runtime controls are ignored).
3. **Global `.env`** at `~/.actagent/.env` (aka `$ACTAGENT_STATE_DIR/.env`; recommended for provider API keys; does not override).
4. **Config `env` block** in `~/.actagent/actagent.json` (applied only if missing).
5. **Optional login-shell import** (`env.shellEnv.enabled` or `ACTAGENT_LOAD_SHELL_ENV=1`), applied only for missing expected keys.

On Ubuntu fresh installs that use the default state dir, ACTAgent also treats `~/.config/actagent/gateway.env` as a compatibility fallback after the global `.env`. If both files exist and disagree, ACTAgent keeps `~/.actagent/.env` and prints a warning.

If the config file is missing entirely, step 4 is skipped; shell import still runs if enabled.

## Provider credentials and workspace `.env`

Do not keep provider API keys only in a workspace `.env`. ACTAgent ignores provider credential environment variables from workspace `.env` files, including common keys such as `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `PERPLEXITY_API_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, and `FIRECRAWL_API_KEY`.

Use one of these trusted sources for provider credentials:

- The Gateway process environment, such as a shell, launchd/systemd unit, container secret, or CI secret.
- The global runtime dotenv file at `~/.actagent/.env` or `$ACTAGENT_STATE_DIR/.env`.
- The config `env` block in `~/.actagent/actagent.json`.
- Optional login-shell import when `env.shellEnv.enabled` or `ACTAGENT_LOAD_SHELL_ENV=1` is enabled.

If you previously stored provider keys only in a workspace `.env`, move them to one of the trusted sources above. Workspace `.env` can still provide ordinary project variables that are not credentials, endpoint redirects, host overrides, or `ACTAGENT_*` runtime controls.

See [Workspace `.env` files](/gateway/security#workspace-env-files) for the security rationale.

## Config `env` block

Two equivalent ways to set inline env vars (both are non-overriding):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

The config `env` block accepts literal string values only. It does not expand
`file:...` values; for example, `XAI_API_KEY: "file:secrets/xai-api-key.txt"`
is passed to providers as that exact string.

For file-backed provider keys, use a SecretRef on the credential field that
supports it:

```json5
{
  secrets: {
    providers: {
      xai_key_file: {
        source: "file",
        path: "~/.actagent/secrets/xai-api-key.txt",
        mode: "singleValue",
      },
    },
  },
  models: {
    providers: {
      xai: {
        apiKey: { source: "file", provider: "xai_key_file", id: "value" },
      },
    },
  },
}
```

See [Secrets Management](/gateway/secrets) and the
[SecretRef credential surface](/reference/secretref-credential-surface) for
supported fields.

## Shell env import

`env.shellEnv` runs your login shell and imports only **missing** expected keys:

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Env var equivalents:

- `ACTAGENT_LOAD_SHELL_ENV=1`
- `ACTAGENT_SHELL_ENV_TIMEOUT_MS=15000`

## Exec shell snapshots

On non-Windows Gateway hosts, bash and zsh `exec` commands use a startup snapshot by default.
Set `ACTAGENT_EXEC_SHELL_SNAPSHOT=0` in the Gateway process environment to disable this path.
Values `false`, `no`, and `off` also disable it. Per-call `exec.env` values cannot toggle
snapshots or redirect the snapshot cache.

## Runtime-injected env vars

ACTAgent also injects context markers into spawned child processes:

- `ACTAGENT_SHELL=exec`: set for commands run through the `exec` tool.
- `ACTAGENT_SHELL=acp`: set for ACP runtime backend process spawns (for example `acpx`).
- `ACTAGENT_SHELL=acp-client`: set for `actagent acp client` when it spawns the ACP bridge process.
- `ACTAGENT_SHELL=tui-local`: set for local TUI `!` shell commands.
- `ACTAGENT_CLI=1`: set for child processes spawned by the CLI entry point.

These are runtime markers (not required user config). They can be used in shell/profile logic
to apply context-specific rules.

## UI env vars

- `ACTAGENT_THEME=light`: force the light TUI palette when your terminal has a light background.
- `ACTAGENT_THEME=dark`: force the dark TUI palette.
- `COLORFGBG`: if your terminal exports it, ACTAgent uses the background color hint to auto-pick the TUI palette.

## Env var substitution in config

You can reference env vars directly in config string values using `${VAR_NAME}` syntax:

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
}
```

See [Configuration: Env var substitution](/gateway/configuration-reference#env-var-substitution) for full details.

## Secret refs vs `${ENV}` strings

ACTAgent supports two env-driven patterns:

- `${VAR}` string substitution in config values.
- SecretRef objects (`{ source: "env", provider: "default", id: "VAR" }`) for fields that support secrets references.

Both resolve from process env at activation time. SecretRef details are documented in [Secrets Management](/gateway/secrets).
The config `env` block itself does not resolve SecretRefs or `file:...`
shorthand values.

## Path-related env vars

| Variable                 | Purpose                                                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACTAGENT_HOME`          | Override the home directory used for internal ACTAgent path defaults (`~/.actagent/`, agent dirs, sessions, credentials, installer onboarding, and the default dev checkout). Useful when running ACTAgent as a dedicated service user. |
| `ACTAGENT_STATE_DIR`     | Override the state directory (default `~/.actagent`).                                                                                                                                                                                   |
| `ACTAGENT_CONFIG_PATH`   | Override the config file path (default `~/.actagent/actagent.json`).                                                                                                                                                                    |
| `ACTAGENT_INCLUDE_ROOTS` | Path-list of directories where `$include` directives may resolve files outside the config directory (default: none — `$include` is confined to the config dir). Tilde-expanded.                                                         |

## Logging

| Variable                         | Purpose                                                                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACTAGENT_LOG_LEVEL`             | Override log level for both file and console (e.g. `debug`, `trace`). Takes precedence over `logging.level` and `logging.consoleLevel` in config. Invalid values are ignored with a warning. |
| `ACTAGENT_DEBUG_MODEL_TRANSPORT` | Emit targeted model request/response timing diagnostics at `info` level without enabling global debug logs.                                                                                  |
| `ACTAGENT_DEBUG_MODEL_PAYLOAD`   | Model payload diagnostics: `summary`, `tools`, or `full-redacted`. `full-redacted` is capped and redacted but may include prompt/message text.                                               |
| `ACTAGENT_DEBUG_SSE`             | Streaming diagnostics: `events` for first/done timing, `peek` to include the first five redacted SSE events.                                                                                 |
| `ACTAGENT_DEBUG_CODE_MODE`       | Code-mode model-surface diagnostics, including provider-tool hiding and exec/wait-only enforcement.                                                                                          |

### `ACTAGENT_HOME`

When set, `ACTAGENT_HOME` replaces the system home directory (`$HOME` / `os.homedir()`) for internal ACTAgent path defaults. This includes the default state directory, config path, agent directories, credentials, installer onboarding workspace, and the default dev checkout used by `actagent update --channel dev`.

**Precedence:** `ACTAGENT_HOME` > `$HOME` > `USERPROFILE` > Termux `PREFIX` home fallback on Android > `os.homedir()`

**Example** (macOS LaunchDaemon):

```xml
<key>EnvironmentVariables</key>
<dict>
  <key>ACTAGENT_HOME</key>
  <string>/Users/user</string>
</dict>
```

`ACTAGENT_HOME` can also be set to a tilde path (e.g. `~/svc`), which gets expanded using the same OS home fallback chain before use.

Explicit path variables such as `ACTAGENT_STATE_DIR`, `ACTAGENT_CONFIG_PATH`, and `ACTAGENT_GIT_DIR` still take precedence. OS-account tasks such as shell startup file detection, package-manager setup, and host `~` expansion may still use the real system home.

## nvm users: web_fetch TLS failures

If Node.js was installed via **nvm** (not the system package manager), the built-in `fetch()` uses
nvm's bundled CA store, which may be missing modern root CAs (ISRG Root X1/X2 for Let's Encrypt,
DigiCert Global Root G2, etc.). This causes `web_fetch` to fail with `"fetch failed"` on most HTTPS sites.

On Linux, ACTAgent automatically detects nvm and applies the fix in the actual startup environment:

- `actagent gateway install` writes `NODE_EXTRA_CA_CERTS` into the systemd service environment
- the `actagent` CLI entrypoint re-execs itself with `NODE_EXTRA_CA_CERTS` set before Node startup

**Manual fix (for older versions or direct `node ...` launches):**

Export the variable before starting ACTAgent:

```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
actagent gateway run
```

Do not rely on writing only to `~/.actagent/.env` for this variable; Node reads
`NODE_EXTRA_CA_CERTS` at process startup.

## Legacy environment variables

ACTAgent only reads `ACTAGENT_*` environment variables. The legacy
`ACTAGENTBOT_*` and `MOLTBOT_*` prefixes from earlier releases are silently
ignored.

If any are still set on the Gateway process at startup, ACTAgent emits a
single Node deprecation warning (`ACTAGENT_LEGACY_ENV_VARS`) listing the
detected prefixes and the total count. Rename each value by replacing the
legacy prefix with `ACTAGENT_` (for example `ACTAGENTBOT_GATEWAY_TOKEN` →
`ACTAGENT_GATEWAY_TOKEN`); the old names take no effect.

## Related

- [Gateway configuration](/gateway/configuration)
- [FAQ: env vars and .env loading](/help/faq#env-vars-and-env-loading)
- [Models overview](/concepts/models)
