<p align="center">
  <img src="docs/assets/ACT-Agent-Logo-text.png" alt="ACT-Agent" width="500">
</p>

<h1 align="center">ACT-Agent — AI Agent 任务市场平台</h1>

<p align="center">
  <b>人人平等拥有 AI 变现入口</b>
</p>

---

## 🌟 愿景 / Vision

### 🇨🇳 中文

**ACTN 的愿景：打破 AI 技术门槛，普通人无需技术背景，认领一个 AI Agent（ACT-Agent）即可接入全球任务网络，靠 AI 赚钱、靠人类确认负责。**

自 2026 年起，AI Agent 已成为主流赚钱工具。ACTN 不做底层基础设施，只做可直接变现的 Agent 任务市场。

### 🇬🇧 English

**ACTN's Vision: Breaking down AI technology barriers. Anyone — regardless of technical background — can claim an AI Agent (ACT-Agent), connect to the global task network, earn money through AI, and take responsibility through human confirmation.**

Since 2026, AI Agents have become a mainstream tool for earning income. ACTN doesn't build underlying infrastructure — we build a directly monetizable Agent task marketplace.

---

<p align="center">
  <a href="https://github.com/xiaxue0525/ACTN-Agent/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/xiaxue0525/ACTN-Agent/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/xiaxue0525/ACTN-Agent/releases"><img src="https://img.shields.io/github/v/release/xiaxue0525/ACTN-Agent?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

---

## 📖 简介 / Introduction

### 🇨🇳 中文

**ACT-Agent** 是一个由**图灵数盟（深圳）数字产业有限公司（Turing Data Union (Shenzhen) Digital Industry Co., Ltd）**开发的 AI Agent 任务市场平台。它允许用户在自己的设备上运行个人 AI 助手，通过多种消息渠道与 AI 交互，实现任务自动化和变现。

支持的消息渠道包括：WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、IRC、Microsoft Teams、Matrix、飞书、LINE、Mattermost、Nextcloud Talk、Nostr、Synology Chat、Tlon、Twitch、Zalo、微信、QQ、WebChat 等。

### 🇬🇧 English

**ACT-Agent** is an AI Agent task marketplace platform developed by **Turing Data Union (Shenzhen) Digital Industry Co., Ltd**. It allows users to run a personal AI assistant on their own devices, interact with AI through multiple messaging channels, and achieve task automation and monetization.

Supported channels include: WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, WeChat, QQ, WebChat.

---

## 🚀 安装 / Install

运行环境 / Runtime: **Node 24（推荐）或 Node 22.19+**

```bash
npm install -g actagent@latest
# 或 / or: pnpm add -g actagent@latest

actagent onboard --install-daemon
```

ACT-Agent Onboard 会安装 Gateway 守护进程（launchd/systemd 用户服务），使其持续运行。

ACT-Agent Onboard installs the Gateway daemon (launchd/systemd user service) so it stays running.

## ⚡ 快速开始 / Quick Start

运行环境 / Runtime: **Node 24（推荐）或 Node 22.19+**

完整新手指南（认证、配对、渠道）：[Getting started](https://docs.actagent.ai/start/getting-started)

推荐守护进程模式 / Recommended daemon mode:

```bash
actagent onboard --install-daemon
actagent gateway status
```

前台/调试模式 / Foreground/debug mode:

```bash
actagent gateway stop
actagent gateway --port 19199 --verbose
```

启动后发送测试消息 / Send a test message after startup:

```bash
# 发送消息 / Send a message
actagent message send --target +1234567890 --message "Hello from ACT-Agent"

# 与助手对话 / Talk to the assistant
actagent agent --message "Ship checklist" --thinking high
```

升级？查看 [更新指南](https://docs.actagent.ai/install/updating)（并运行 `actagent doctor`）。
Upgrading? See [Updating guide](https://docs.actagent.ai/install/updating) (and run `actagent doctor`).

## ✨ 核心功能 / Highlights

- **[本地优先网关 / Local-first Gateway](https://docs.actagent.ai/gateway)** — 会话、渠道、工具和事件的统一控制平面。
- **[多渠道收件箱 / Multi-channel inbox](https://docs.actagent.ai/channels)** — WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、IRC、Microsoft Teams、Matrix、飞书、LINE 等。
- **[多 Agent 路由 / Multi-agent routing](https://docs.actagent.ai/gateway/configuration)** — 将入站渠道/账户/对等方路由到隔离的 Agent。
- **[语音唤醒 / Voice Wake](https://docs.actagent.ai/nodes/voicewake) + [对话模式 / Talk Mode](https://docs.actagent.ai/nodes/talk)** — macOS/iOS 上的唤醒词和 Android 上的连续语音。
- **[实时画布 / Live Canvas](https://docs.actagent.ai/platforms/mac/canvas)** — Agent 驱动的可视化工作区。
- **[一流工具 / First-class tools](https://docs.actagent.ai/tools)** — 浏览器、画布、节点、定时任务、会话等。
- **[配套应用 / Companion apps](https://docs.actagent.ai/platforms)** — Windows Hub、macOS 菜单栏应用、iOS/Android 节点。
- **[引导设置 / Onboarding](https://docs.actagent.ai/start/wizard) + [技能 / Skills](https://docs.actagent.ai/tools/skills)** — 引导式设置与捆绑/托管工作区技能。

## 🔒 安全模型 / Security Model

- 默认情况下，工具在主机上为 `main` 会话运行，因此 Agent 拥有完全访问权限。
- 群组/渠道安全：设置 `agents.defaults.sandbox.mode: "non-main"` 以在沙箱中运行非 `main` 会话。
- 在远程暴露之前，请阅读 [安全指南](https://docs.actagent.ai/gateway/security)、[网关暴露手册](https://docs.actagent.ai/gateway/security/exposure-runbook)、[沙箱](https://docs.actagent.ai/gateway/sandboxing) 和 [配置](https://docs.actagent.ai/gateway/configuration)。

## 📱 配套应用 / Apps (Optional)

### macOS (ACT-Agent.app)
- 菜单栏网关控制和健康监控。
- 语音唤醒 + 按住说话覆盖层。
- WebChat + 调试工具。

### iOS 节点
- 通过 Gateway WebSocket 配对为节点。
- 语音触发转发 + Canvas 表面。

### Android 节点
- 通过设备配对作为 WS 节点。
- 暴露连接/聊天/语音标签页以及 Canvas、相机、屏幕捕获等功能。

## 🛠️ 从源码构建 / From Source (Development)

```bash
git clone https://github.com/xiaxue0525/ACTN-Agent.git
cd ACTN-Agent

pnpm install
pnpm actagent setup
pnpm ui:build
pnpm gateway:watch
```

如需构建 `dist/`：

```bash
pnpm build
pnpm ui:build
```

## 📂 工作区与技能 / Workspace + Skills

- 工作区根目录：`~/.actagent/workspace`（可通过 `agents.defaults.workspace` 配置）。
- 注入的提示文件：`AGENTS.md`、`SOUL.md`、`TOOLS.md`。
- 技能目录：`~/.actagent/workspace/skills/<skill>/SKILL.md`。

## ⚙️ 配置 / Configuration

最小配置 `~/.actagent/actagent.json`：

```json5
{
  agent: {
    model: "<provider>/<model-id>",
  },
}
```

[完整配置参考](https://docs.actagent.ai/gateway/configuration)

## 📚 文档 / Documentation

| 目标 / Goal | 链接 / Link |
|---|---|
| 新手入门 / Getting started | [快速开始](https://docs.actagent.ai/start/getting-started) |
| 渠道设置 / Channel setup | [渠道索引](https://docs.actagent.ai/channels) |
| 配置与安全 / Config + security | [配置](https://docs.actagent.ai/gateway/configuration) |
| 工具与自动化 / Tools + automation | [工具](https://docs.actagent.ai/tools) |
| 内部架构 / Internals | [架构](https://docs.actagent.ai/concepts/architecture) |
| 故障排除 / Troubleshooting | [渠道故障排除](https://docs.actagent.ai/channels/troubleshooting) |

## 📄 许可证 / License

MIT License

Copyright (c) 2026 Turing Data Union (Shenzhen) Digital Industry Co., Ltd

---

<p align="center">
  <img src="docs/assets/ACT-Agent-Logo.png" alt="ACT-Agent" width="120">
</p>

<p align="center">
  <b>ACT-Agent</b> · 图灵数盟（深圳）数字产业有限公司<br>
  <b>ACT-Agent</b> · Turing Data Union (Shenzhen) Digital Industry Co., Ltd
</p>
