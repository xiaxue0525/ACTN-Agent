# @actagent/diagnostics-prometheus

Official Prometheus diagnostics exporter for ACTAgent.

This plugin exposes ACTAgent Gateway runtime metrics in Prometheus text format for Prometheus, Grafana, VictoriaMetrics, and compatible scrapers.

## Install

```bash
actagent plugins install @actagent/diagnostics-prometheus
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the scrape endpoint options in `plugins.entries.diagnostics-prometheus.config`.

The full config surface, metric names, and scrape examples live in the docs:

- https://docs.actagent.ai/gateway/prometheus

## Package

- Plugin id: `diagnostics-prometheus`
- Package: `@actagent/diagnostics-prometheus`
- Minimum ACTAgent host: `2026.4.25`
