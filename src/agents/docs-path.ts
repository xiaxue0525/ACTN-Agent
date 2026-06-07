/**
 * Locates local ACTAgent docs/source roots for references shown to agents.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveACTAgentPackageRoot } from "../infra/actagent-root.js";

export const ACTAGENT_DOCS_URL = "https://docs.actagent.ai";
export const ACTAGENT_SOURCE_URL = "https://github.com/actagent/actagent";

type ResolveACTAgentReferencePathParams = {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
};

function isUsableDocsDir(docsDir: string): boolean {
  return fs.existsSync(path.join(docsDir, "docs.json"));
}

function isGitCheckout(rootDir: string): boolean {
  return fs.existsSync(path.join(rootDir, ".git"));
}

/** Resolve a usable local docs directory, preferring the active workspace. */
export async function resolveACTAgentDocsPath(params: {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
}): Promise<string | null> {
  const workspaceDir = params.workspaceDir?.trim();
  if (workspaceDir) {
    const workspaceDocs = path.join(workspaceDir, "docs");
    if (isUsableDocsDir(workspaceDocs)) {
      return workspaceDocs;
    }
  }

  const packageRoot = await resolveACTAgentPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return null;
  }

  const packageDocs = path.join(packageRoot, "docs");
  return isUsableDocsDir(packageDocs) ? packageDocs : null;
}

/** Resolve the package root only when it is a Git checkout. */
export async function resolveACTAgentSourcePath(
  params: ResolveACTAgentReferencePathParams,
): Promise<string | null> {
  const packageRoot = await resolveACTAgentPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot || !isGitCheckout(packageRoot)) {
    return null;
  }
  return packageRoot;
}

/** Resolve docs and source roots concurrently for prompt/reference injection. */
export async function resolveACTAgentReferencePaths(
  params: ResolveACTAgentReferencePathParams,
): Promise<{
  docsPath: string | null;
  sourcePath: string | null;
}> {
  const [docsPath, sourcePath] = await Promise.all([
    resolveACTAgentDocsPath(params),
    resolveACTAgentSourcePath(params),
  ]);
  return { docsPath, sourcePath };
}
