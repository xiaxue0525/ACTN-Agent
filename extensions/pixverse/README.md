# @actagent/pixverse-provider

Official PixVerse video generation provider plugin for ACTAgent.

This plugin registers PixVerse as a `video_generate` provider for text-to-video and image-to-video workflows.

## Install

```bash
actagent plugins install @actagent/pixverse-provider
```

Restart the Gateway after installing or updating the plugin.

## Configure

Store your PixVerse API key in ACTAgent config or expose the supported environment variable to the Gateway. Then select PixVerse as a video generation provider.

Full setup and model/provider examples:

- https://docs.actagent.ai/providers/pixverse

## Package

- Plugin id: `pixverse`
- Package: `@actagent/pixverse-provider`
- Minimum ACTAgent host: `2026.5.26`
