# @actagent/openshell-sandbox

Official NVIDIA OpenShell sandbox backend for ACTAgent.

This plugin lets ACTAgent use OpenShell-managed sandboxes with mirrored local workspaces and SSH command execution.

## Install

```bash
actagent plugins install @actagent/openshell-sandbox
```

Restart the Gateway after installing or updating the plugin.

## Configure

Use the OpenShell docs for credentials, workspace mirroring, runtime selection, and troubleshooting:

- https://docs.actagent.ai/gateway/openshell

## Package

- Plugin id: `openshell`
- Package: `@actagent/openshell-sandbox`
- Minimum ACTAgent host: `2026.5.12-beta.1`
