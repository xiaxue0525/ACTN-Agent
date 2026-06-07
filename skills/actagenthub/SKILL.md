---
name: actagenthub
description: "Search, install, update, sync, or publish agent skills with the ACTAgentHub CLI and registry."
metadata:
  {
    "actagent":
      {
        "requires": { "bins": ["actagenthub"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "actagenthub",
              "bins": ["actagenthub"],
              "label": "Install ACTAgentHub CLI (npm)",
            },
          ],
      },
  }
---

# ACTAgentHub CLI

Install

```bash
npm i -g actagenthub
```

Auth (publish)

```bash
actagenthub login
actagenthub whoami
```

Search

```bash
actagenthub search "postgres backups"
```

Install

```bash
actagenthub install my-skill
actagenthub install my-skill --version 1.2.3
```

Update (hash-based match + upgrade)

```bash
actagenthub update my-skill
actagenthub update my-skill --version 1.2.3
actagenthub update --all
actagenthub update my-skill --force
actagenthub update --all --no-input --force
```

List

```bash
actagenthub list
```

Publish

```bash
actagenthub publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "Fixes + docs"
```

Notes

- Default registry: https://actagenthub.com (override with ACTAGENTHUB_REGISTRY or --registry)
- Default workdir: cwd (falls back to ACTAgent workspace); install dir: ./skills (override with --workdir / --dir / ACTAGENTHUB_WORKDIR)
- Update command hashes local files, resolves matching version, and upgrades to latest unless --version is set
