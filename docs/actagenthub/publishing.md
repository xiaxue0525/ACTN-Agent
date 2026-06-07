---
summary: "How ACTAgentHub publishing works for skills, plugins, owners, scopes, releases, and review."
read_when:
  - Publishing a skill or plugin
  - Debugging owner or package scope errors
  - Adding publish UI, CLI, or backend behavior
---

# Publishing on ACTAgentHub

ACTAgentHub publishing is owner-scoped: every publish targets a publisher, and the
server decides whether the signed-in user is allowed to publish there.

## Owners

An owner is a ACTAgentHub publisher handle, such as `@alice` or `@actagent`.
Personal owners are created for users. Org owners can have multiple members.

When you publish, you either use your personal owner or choose an org owner
where you have publisher access.

## Skills

Skills are published from a skill folder. The public page is:

```text
https://actagenthub.ai/<owner>/<slug>
```

Example:

```text
https://actagenthub.ai/alice/review-helper
```

The publish request includes the selected owner, slug, version, changelog, and
files. The server verifies that the actor can publish as that owner before it
creates the release.

## Plugins

Plugins use npm-style package names. Scoped package names include the owner in
the first part of the name:

```text
@owner/package-name
```

The scope must match the selected publish owner. If your package is named
`@actagent/dronzer`, it can only be published as `@actagent`. If you publish as
`@vintageayu`, rename the package to `@vintageayu/dronzer`.

This prevents a package from claiming an org namespace that the publisher does
not control.

## Release Flow

1. The UI, CLI, or GitHub workflow gathers package metadata and files.
2. The publish request is sent to ACTAgentHub with the selected owner.
3. The server validates owner permissions, package scope, package name, version,
   file limits, and source metadata.
4. ACTAgentHub stores the release and starts automated security checks.
5. New releases are hidden from normal install/download surfaces until review
   and verification finish.

If validation fails, the release is not created.

## FAQ

### Package scope must match selected owner

If the package scope and selected owner do not match, ACTAgentHub rejects the
publish:

```text
Package scope "@actagent" must match selected owner "@vintageayu".
Publish as "@actagent" or rename this package to "@vintageayu/dronzer".
```

To fix it, either choose the owner named by the package scope, or rename the
package so the scope matches the owner you can publish as.

If the package name already has the right scope but the package is owned by the
wrong publisher, transfer ownership instead:

```sh
actagenthub package transfer @opik/opik-actagent --to opik
```

Use package transfer only when you have admin access to both the current package
owner and the destination publisher. It does not let you publish into a scope you
cannot manage.

This protects org namespaces. A package named `@actagent/dronzer` claims the
`@actagent` namespace, so only publishers with access to the `@actagent` owner
can publish it.
