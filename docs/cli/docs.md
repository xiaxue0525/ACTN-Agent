---
summary: "CLI reference for `actagent docs` (search the live docs index)"
read_when:
  - You want to search the live ACTAgent docs from the terminal
  - You need to know which hosted search API the docs CLI calls
title: "Docs"
---

# `actagent docs`

Search the live ACTAgent docs index from the terminal. The command calls ACTAgent's Cloudflare-hosted docs search API and renders the results in your terminal.

## Usage

```bash
actagent docs                       # print docs entrypoint and example search
actagent docs <query...>            # search the live docs index
```

Arguments:

| Argument     | Description                                                                        |
| ------------ | ---------------------------------------------------------------------------------- |
| `[query...]` | Free-form search query. Multi-word queries are joined with spaces and sent as one. |

## Examples

```bash
actagent docs browser existing-session
actagent docs sandbox allowHostControl
actagent docs gateway token secretref
```

With no query, `actagent docs` prints the docs entrypoint URL plus a sample search command instead of running a search.

## How it works

`actagent docs` calls `https://docs.actagent.ai/api/search` and renders the JSON results. The search call uses a fixed 30 second timeout.

## Output

In a rich (TTY) terminal, results render as a heading followed by a bullet list. Each bullet shows the page title, the linked docs URL, and a short snippet on the next line. Empty results print "No results.".

In non-rich output (piped, `--no-color`, scripts), the same data renders as Markdown:

```markdown
# Docs search: <query>

- [Title](https://docs.actagent.ai/...) - snippet
- [Title](https://docs.actagent.ai/...) - snippet
```

## Exit codes

| Code | Meaning                                                           |
| ---- | ----------------------------------------------------------------- |
| `0`  | Search succeeded (including zero-result responses).               |
| `1`  | The hosted docs search API call failed; stderr is printed inline. |

## Related

- [CLI reference](/cli)
- [Live docs](https://docs.actagent.ai)
