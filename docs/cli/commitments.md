---
summary: "CLI reference for `actagent commitments` (inspect and dismiss inferred follow-ups)"
read_when:
  - You want to inspect inferred follow-up commitments
  - You want to dismiss pending check-ins
  - You are auditing what heartbeat may deliver
title: "`actagent commitments`"
---

List and manage inferred follow-up commitments.

Commitments are opt-in, short-lived follow-up memories created from
conversation context. See [Inferred commitments](/concepts/commitments) for the
conceptual guide.

With no subcommand, `actagent commitments` lists pending commitments.

## Usage

```bash
actagent commitments [--all] [--agent <id>] [--status <status>] [--json]
actagent commitments list [--all] [--agent <id>] [--status <status>] [--json]
actagent commitments dismiss <id...> [--json]
```

## Options

- `--all`: show all statuses instead of only pending commitments.
- `--agent <id>`: filter to one agent id.
- `--status <status>`: filter by status. Values: `pending`, `sent`,
  `dismissed`, `snoozed`, or `expired`.
- `--json`: output machine-readable JSON.

## Examples

List pending commitments:

```bash
actagent commitments
```

List every stored commitment:

```bash
actagent commitments --all
```

Filter to one agent:

```bash
actagent commitments --agent main
```

Find snoozed commitments:

```bash
actagent commitments --status snoozed
```

Dismiss one or more commitments:

```bash
actagent commitments dismiss cm_abc123 cm_def456
```

Export as JSON:

```bash
actagent commitments --all --json
```

## Output

Text output includes:

- commitment id
- status
- kind
- earliest due time
- scope
- suggested check-in text

JSON output also includes the commitment store path and full stored records.

## Related

- [Inferred commitments](/concepts/commitments)
- [Memory overview](/concepts/memory)
- [Heartbeat](/gateway/heartbeat)
- [Scheduled tasks](/automation/cron-jobs)
