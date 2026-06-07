# @actagent/diagnostics-otel

Official OpenTelemetry diagnostics exporter for ACTAgent.

This plugin exports ACTAgent Gateway traces, metrics, and logs to an OTLP collector for observability stacks such as Grafana, Datadog, Honeycomb, New Relic, Tempo, and compatible collectors.

## Install

```bash
actagent plugins install @actagent/diagnostics-otel
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the OTLP endpoint in `plugins.entries.diagnostics-otel.config`.

The full config surface, metric names, span names, and collector examples live in the docs:

- https://docs.actagent.ai/gateway/opentelemetry

## Package

- Plugin id: `diagnostics-otel`
- Package: `@actagent/diagnostics-otel`
- Minimum ACTAgent host: `2026.4.25`
