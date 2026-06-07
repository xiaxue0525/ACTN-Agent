---
summary: "ACTAgentHub CLI entry points for discovering, installing, publishing, and verifying ACTAgent skills and plugins."
read_when:
  - You want to use ACTAgentHub from the command line
  - You want to install ACTAgentHub skills or plugins through ACTAgent
  - You want to publish ACTAgentHub packages
title: "ACTAgentHub CLI"
---

# ACTAgentHub CLI

ACTAgent has two command-line entry points for ACTAgentHub:

- `actagent skills` and `actagent plugins` install and manage ACTAgentHub packages
  inside ACTAgent.
- The standalone `actagenthub` CLI handles publisher workflows such as login,
  publish, transfer, and sync.

## Discover and install

Use ACTAgent commands when you want to install or update packages for a local
ACTAgent agent or Gateway.

```bash
actagent skills search "calendar"
actagent skills install <slug>
actagent skills update <slug>
actagent skills verify <slug>

actagent plugins search "calendar"
actagent plugins install actagenthub:<package>
actagent plugins update <id-or-npm-spec>
```

Skill installs target the active workspace `skills/` directory by default. Add
`--global` to install into the shared managed skills directory.

Plugin installs use the `actagenthub:` prefix when you want ACTAgentHub resolution
instead of npm or another install source.

## Publish and maintain

Install the standalone ACTAgentHub CLI for publisher workflows:

```bash
npm i -g actagenthub
actagenthub login
```

Publish plugin packages with `actagenthub package publish`:

```bash
actagenthub package publish your-org/your-plugin --dry-run
actagenthub package publish your-org/your-plugin
actagenthub package publish your-org/your-plugin@v1.0.0
```

Publish skill folders with `actagenthub skill publish`:

```bash
actagenthub skill publish ./skills/review-helper
actagenthub skill publish ./skills/review-helper --version 1.0.0
```

When local skill scan state or package ownership needs maintenance, use the
relevant standalone command:

```bash
actagenthub sync --all
actagenthub package transfer @old-owner/package --to new-owner
```

## Related

- [`actagent skills`](/cli/skills) - local skill search, install, update, and
  verification
- [`actagent plugins`](/cli/plugins) - plugin search, install, update, and
  inspection
- [ACTAgentHub publishing](/actagenthub/publishing) - owner scope, release validation,
  and review flow
- [Creating skills](/tools/creating-skills) - skill authoring and publish flow
- [Building plugins](/plugins/building-plugins) - plugin package authoring
