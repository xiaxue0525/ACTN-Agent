# @actagent/tokenjuice

Official Tokenjuice output compaction plugin for ACTAgent.

Tokenjuice compacts noisy `exec` and `bash` tool results after commands run, before the result is fed back into the active agent session. It does not rewrite commands, rerun commands, or change exit codes.

## Install

```bash
actagent plugins install @actagent/tokenjuice
```

Restart the Gateway after installing or updating the plugin.

## Enable

```bash
actagent config set plugins.entries.tokenjuice.enabled true
```

Equivalent:

```bash
actagent plugins enable tokenjuice
```

## Docs

- https://docs.actagent.ai/tools/tokenjuice

## Package

- Plugin id: `tokenjuice`
- Package: `@actagent/tokenjuice`
- Minimum ACTAgent host: `2026.5.28`
