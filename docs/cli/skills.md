---
summary: "CLI reference for `actagent skills` (search/install/update/verify/list/info/check/workshop)"
read_when:
  - You want to see which skills are available and ready to run
  - You want to search ACTAgentHub or install skills from ACTAgentHub, Git, or local directories
  - You want to verify a ACTAgentHub skill with ACTAgentHub
  - You want to debug missing binaries/env/config for skills
title: "Skills"
---

# `actagent skills`

Inspect local skills, search ACTAgentHub, install skills from ACTAgentHub/Git/local
directories, verify ACTAgentHub skills, and update ACTAgentHub-tracked installs.

Related:

- Skills system: [Skills](/tools/skills)
- Skill Workshop: [Skill Workshop](/tools/skill-workshop)
- Skills config: [Skills config](/tools/skills-config)
- ACTAgentHub installs: [ACTAgentHub](/actagenthub/cli)

## Commands

```bash
actagent skills search "calendar"
actagent skills search --limit 20 --json
actagent skills install <slug>
actagent skills install <slug> --version <version>
actagent skills install git:owner/repo
actagent skills install git:owner/repo@main
actagent skills install ./path/to/skill --as custom-name
actagent skills install <slug> --force
actagent skills install <slug> --agent <id>
actagent skills install <slug> --global
actagent skills update <slug>
actagent skills update <slug> --global
actagent skills update --all
actagent skills update --all --agent <id>
actagent skills update --all --global
actagent skills verify <slug>
actagent skills verify <slug> --version <version>
actagent skills verify <slug> --tag <tag>
actagent skills verify <slug> --card
actagent skills verify <slug> --global
actagent skills list
actagent skills list --eligible
actagent skills list --json
actagent skills list --verbose
actagent skills list --agent <id>
actagent skills info <name>
actagent skills info <name> --json
actagent skills info <name> --agent <id>
actagent skills check
actagent skills check --agent <id>
actagent skills check --json
actagent skills workshop propose-create --name "qa-check" --description "QA checklist" --proposal ./PROPOSAL.md
actagent skills workshop propose-update qa-check --proposal ./PROPOSAL.md
actagent skills workshop list
actagent skills workshop inspect <proposal-id>
actagent skills workshop revise <proposal-id> --proposal ./PROPOSAL.md
actagent skills workshop apply <proposal-id>
actagent skills workshop reject <proposal-id> --reason "Not reusable"
actagent skills workshop quarantine <proposal-id> --reason "Needs security review"
```

`search`, `update`, and `verify` use ACTAgentHub directly. `install <slug>` installs
a ACTAgentHub skill, `install git:owner/repo[@ref]` clones a Git skill, and
`install ./path` copies a local skill directory. By default, `install`, `update`,
and `verify` target the active workspace `skills/` directory; with `--global`,
they target the shared managed skills directory. `list`/`info`/`check` still
inspect the local skills visible to the current workspace and config.
Workspace-backed commands resolve the target workspace from `--agent <id>`, then
the current working directory when it is inside a configured agent workspace,
then the default agent.

Git and local directory installs expect `SKILL.md` at the source root. The
install slug comes from `SKILL.md` frontmatter `name` when it is valid, then the
source directory or repository name; use `--as <slug>` to override it. `--version`
is ACTAgentHub-only. Skill installs do not support npm package specs or zip/archive
paths, and `actagent skills update` updates ACTAgentHub-tracked installs only.

Gateway-backed skill dependency installs triggered from onboarding or Skills
settings use the separate `skills.install` request path instead.

Notes:

- `search [query...]` accepts an optional query; omit it to browse the default
  ACTAgentHub search feed.
- `search --limit <n>` caps returned results.
- `install git:owner/repo[@ref]` installs a Git skill. Branch refs may contain
  slashes, such as `git:owner/repo@feature/foo`.
- `install ./path/to/skill` installs a local directory whose root contains
  `SKILL.md`.
- `install --as <slug>` overrides the inferred slug for Git and local directory
  installs.
- `install --version <version>` applies only to ACTAgentHub skill slugs.
- `install --force` overwrites an existing workspace skill folder for the same
  slug.
- `--global` targets the shared managed skills directory and cannot be combined
  with `--agent <id>`.
- `--agent <id>` targets one configured agent workspace and overrides current
  working directory inference.
- `update <slug>` updates a single tracked skill. Add `--global` to target the
  shared managed skills directory instead of the workspace.
- `update --all` updates tracked ACTAgentHub installs in the selected workspace, or
  in the shared managed skills directory when combined with `--global`.
- `verify <slug>` prints ACTAgentHub's `actagenthub.skill.verify.v1` JSON envelope by
  default. There is no `--json` flag because JSON is already the default.
- `verify` uses `.actagenthub/origin.json` for installed ACTAgentHub skills, so it
  verifies the installed version against the registry it came from. `--version`
  and `--tag` override the version selector but keep that installed registry
  when origin metadata exists.
- `verify --card` prints the generated Skill Card Markdown instead of JSON. The
  command exits non-zero when ACTAgentHub returns `ok: false` or `decision: "fail"`;
  unsigned signatures are informational unless ACTAgentHub policy changes.
- Installed ACTAgentHub bundles can include a generated `skill-card.md`. ACTAgent
  treats verification as a ACTAgentHub server decision and does not reject an
  installed skill just because that generated card changes the bundle
  fingerprint.
- `check --agent <id>` checks the selected agent's workspace and reports which
  ready skills are actually visible to that agent's prompt or command surface.
- `list` is the default action when no subcommand is provided.
- `list`, `info`, and `check` write their rendered output to stdout. With
  `--json`, that means the machine-readable payload stays on stdout for pipes
  and scripts.

## Skill Workshop

`actagent skills workshop` manages pending skill proposals in the selected
workspace. Proposals are not active skills until applied. For proposal storage,
support-file safeguards, Gateway methods, and approval policy, see
[Skill Workshop](/tools/skill-workshop).

```bash
actagent skills workshop propose-create \
  --name "qa-check" \
  --description "Repeatable QA checklist" \
  --proposal ./PROPOSAL.md
actagent skills workshop propose-create \
  --name "qa-check" \
  --description "Repeatable QA checklist" \
  --proposal-dir ./qa-check-proposal
actagent skills workshop propose-update qa-check --proposal ./PROPOSAL.md
actagent skills workshop list
actagent skills workshop inspect <proposal-id>
actagent skills workshop revise <proposal-id> --proposal ./PROPOSAL.md
actagent skills workshop apply <proposal-id>
actagent skills workshop reject <proposal-id> --reason "Duplicate"
actagent skills workshop quarantine <proposal-id> --reason "Needs security review"
```

## Related

- [CLI reference](/cli)
- [Skills](/tools/skills)
