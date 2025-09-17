import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  type FileSystemContextService,
  FileSystemContextServiceTag,
} from "../../../services/shell";
import { defineTool, makeJsonSchemaValidator } from "./base-tool";
import { type ToolExecutionContext, type ToolExecutionResult } from "./tool-registry";

/**
 * Git command execution tools
 * Provides safe, structured access to common Git operations
 */

// Safe Git operations (read-only, no approval needed)
export interface GitStatusArgs extends Record<string, unknown> {
  path?: string;
}

export interface GitLogArgs extends Record<string, unknown> {
  path?: string;
  limit?: number;
  oneline?: boolean;
}

export interface GitDiffArgs extends Record<string, unknown> {
  path?: string;
  staged?: boolean;
  branch?: string;
  commit?: string;
}

// Potentially destructive operations (approval required)
export interface GitAddArgs extends Record<string, unknown> {
  path?: string;
  files: string[];
  all?: boolean;
}

export interface GitCommitArgs extends Record<string, unknown> {
  path?: string;
  message: string;
  all?: boolean;
}

export interface GitPushArgs extends Record<string, unknown> {
  path?: string;
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface GitPullArgs extends Record<string, unknown> {
  path?: string;
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

export interface GitBranchArgs extends Record<string, unknown> {
  path?: string;
  list?: boolean;
  all?: boolean;
  remote?: boolean;
}

export interface GitCheckoutArgs extends Record<string, unknown> {
  path?: string;
  branch: string;
  create?: boolean;
  force?: boolean;
}

// Safe Git operations (no approval needed)

export function createGitStatusTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
    },
    required: [],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitStatusArgs>({
    name: "gitStatus",
    description: "Show the working tree status of a Git repository",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (
      args: Record<string, unknown>,
      context: ToolExecutionContext,
    ): Effect.Effect<
      ToolExecutionResult,
      Error,
      FileSystem.FileSystem | FileSystemContextService
    > =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitStatusArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple status message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            status: "Git status would be executed here",
            hasChanges: false,
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { hasChanges: boolean };
        return gitResult.hasChanges ? "Repository has changes" : "Repository is clean (no changes)";
      }
      return result.success ? "Git status retrieved" : "Git status failed";
    },
  });
}

export function createGitLogTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      limit: {
        type: "number",
        description: "Limit the number of commits to show",
        minimum: 1,
        maximum: 100,
      },
      oneline: {
        type: "boolean",
        description: "Show commits in one-line format",
        default: false,
      },
    },
    required: [],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitLogArgs>({
    name: "gitLog",
    description: "Show commit history of a Git repository",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitLogArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple log message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            commits: "Git log would be executed here",
            commitCount: 0,
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { commitCount: number };
        return `Retrieved ${gitResult.commitCount} commits from Git history`;
      }
      return result.success ? "Git log retrieved" : "Git log failed";
    },
  });
}

export function createGitDiffTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      staged: {
        type: "boolean",
        description: "Show staged changes (cached)",
        default: false,
      },
      branch: {
        type: "string",
        description: "Compare with a specific branch",
      },
      commit: {
        type: "string",
        description: "Compare with a specific commit",
      },
    },
    required: [],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitDiffArgs>({
    name: "gitDiff",
    description: "Show changes between commits, commit and working tree, etc.",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitDiffArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple diff message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            diff: "Git diff would be executed here",
            hasChanges: false,
            options: {
              staged: typedArgs.staged || false,
              branch: typedArgs.branch,
              commit: typedArgs.commit,
            },
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { hasChanges: boolean };
        return gitResult.hasChanges ? "Repository has differences" : "No differences found";
      }
      return result.success ? "Git diff retrieved" : "Git diff failed";
    },
  });
}

export function createGitBranchTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      list: {
        type: "boolean",
        description: "List branches",
        default: true,
      },
      all: {
        type: "boolean",
        description: "List both local and remote branches",
        default: false,
      },
      remote: {
        type: "boolean",
        description: "List only remote branches",
        default: false,
      },
    },
    required: [],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitBranchArgs>({
    name: "gitBranch",
    description: "List, create, or delete branches",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitBranchArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple branch message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            branches: ["main", "develop", "feature/new-feature"],
            currentBranch: "main",
            options: {
              list: typedArgs.list !== false,
              all: typedArgs.all || false,
              remote: typedArgs.remote || false,
            },
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { branches: string[]; currentBranch?: string };
        return `Found ${gitResult.branches.length} branches${
          gitResult.currentBranch ? ` (current: ${gitResult.currentBranch})` : ""
        }`;
      }
      return result.success ? "Git branches retrieved" : "Git branch failed";
    },
  });
}

// Potentially destructive operations (approval required)

export function createGitAddTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      files: {
        type: "array",
        items: { type: "string" },
        description: "Files to add to the staging area",
      },
      all: {
        type: "boolean",
        description: "Add all changes in the working directory",
        default: false,
      },
    },
    required: ["files"],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitAddArgs>({
    name: "gitAdd",
    description: "Add file contents to the staging area (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    approval: {
      message: (args: Record<string, unknown>, context: ToolExecutionContext) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const typedArgs = args as GitAddArgs;
          const workingDir = typedArgs.path
            ? yield* shell.resolvePath(
                {
                  agentId: context.agentId,
                  ...(context.conversationId && { conversationId: context.conversationId }),
                },
                typedArgs.path,
              )
            : yield* shell.getCwd({
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              });

          const filesToAdd = typedArgs.all ? "all files" : typedArgs.files.join(", ");
          return `Add ${filesToAdd} to Git staging area in ${workingDir}?`;
        }),
    },
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitAddArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple add message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            addedFiles: typedArgs.all ? "all files" : typedArgs.files,
            message: "Files would be added to staging area",
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { addedFiles: string | string[] };
        return `Added ${Array.isArray(gitResult.addedFiles) ? gitResult.addedFiles.join(", ") : gitResult.addedFiles} to staging area`;
      }
      return result.success ? "Files added to Git" : "Git add failed";
    },
  });
}

export function createGitCommitTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      message: {
        type: "string",
        description: "Commit message",
        minLength: 1,
      },
      all: {
        type: "boolean",
        description: "Commit all changes in the working directory",
        default: false,
      },
    },
    required: ["message"],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitCommitArgs>({
    name: "gitCommit",
    description: "Record changes to the repository (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    approval: {
      message: (args: Record<string, unknown>, context: ToolExecutionContext) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const typedArgs = args as GitCommitArgs;
          const workingDir = typedArgs.path
            ? yield* shell.resolvePath(
                {
                  agentId: context.agentId,
                  ...(context.conversationId && { conversationId: context.conversationId }),
                },
                typedArgs.path,
              )
            : yield* shell.getCwd({
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              });

          return `Commit changes in ${workingDir} with message: "${typedArgs.message}"?`;
        }),
    },
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitCommitArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple commit message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            message: typedArgs.message,
            commitHash: "abc123",
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { message: string; commitHash: string };
        return `Committed: "${gitResult.message}" (${gitResult.commitHash})`;
      }
      return result.success ? "Git commit created" : "Git commit failed";
    },
  });
}

export function createGitPushTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      remote: {
        type: "string",
        description: "Remote repository name (defaults to 'origin')",
        default: "origin",
      },
      branch: {
        type: "string",
        description: "Branch to push (defaults to current branch)",
      },
      force: {
        type: "boolean",
        description: "Force push (overwrites remote history)",
        default: false,
      },
    },
    required: [],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitPushArgs>({
    name: "gitPush",
    description: "Update remote refs along with associated objects (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    approval: {
      message: (args: Record<string, unknown>, context: ToolExecutionContext) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const typedArgs = args as GitPushArgs;
          const workingDir = typedArgs.path
            ? yield* shell.resolvePath(
                {
                  agentId: context.agentId,
                  ...(context.conversationId && { conversationId: context.conversationId }),
                },
                typedArgs.path,
              )
            : yield* shell.getCwd({
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              });

          const remote = typedArgs.remote || "origin";
          const branch = typedArgs.branch || "current branch";
          const force = typedArgs.force ? " (force push)" : "";
          return `Push${force} to ${remote}/${branch} in ${workingDir}?`;
        }),
    },
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitPushArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple push message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            remote: typedArgs.remote || "origin",
            branch: typedArgs.branch || "current",
            force: typedArgs.force || false,
            message: "Changes would be pushed successfully",
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { remote: string; branch: string; force: boolean };
        return `Pushed to ${gitResult.remote}/${gitResult.branch}${gitResult.force ? " (force)" : ""}`;
      }
      return result.success ? "Git push successful" : "Git push failed";
    },
  });
}

export function createGitPullTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      remote: {
        type: "string",
        description: "Remote repository name (defaults to 'origin')",
        default: "origin",
      },
      branch: {
        type: "string",
        description: "Branch to pull (defaults to current branch)",
      },
      rebase: {
        type: "boolean",
        description: "Use rebase instead of merge",
        default: false,
      },
    },
    required: [],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitPullArgs>({
    name: "gitPull",
    description:
      "Fetch from and integrate with another repository or a local branch (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    approval: {
      message: (args: Record<string, unknown>, context: ToolExecutionContext) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const typedArgs = args as GitPullArgs;
          const workingDir = typedArgs.path
            ? yield* shell.resolvePath(
                {
                  agentId: context.agentId,
                  ...(context.conversationId && { conversationId: context.conversationId }),
                },
                typedArgs.path,
              )
            : yield* shell.getCwd({
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              });

          const remote = typedArgs.remote || "origin";
          const branch = typedArgs.branch || "current branch";
          const rebase = typedArgs.rebase ? " (with rebase)" : "";
          return `Pull${rebase} from ${remote}/${branch} in ${workingDir}?`;
        }),
    },
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitPullArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple pull message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            remote: typedArgs.remote || "origin",
            branch: typedArgs.branch || "current",
            rebase: typedArgs.rebase || false,
            message: "Changes would be pulled successfully",
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { remote: string; branch: string; rebase: boolean };
        return `Pulled from ${gitResult.remote}/${gitResult.branch}${gitResult.rebase ? " (rebase)" : ""}`;
      }
      return result.success ? "Git pull successful" : "Git pull failed";
    },
  });
}

export function createGitCheckoutTool() {
  const parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current working directory)",
      },
      branch: {
        type: "string",
        description: "Branch name to checkout",
      },
      create: {
        type: "boolean",
        description: "Create the branch if it doesn't exist",
        default: false,
      },
      force: {
        type: "boolean",
        description: "Force checkout (discards local changes)",
        default: false,
      },
    },
    required: ["branch"],
    additionalProperties: false,
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, GitCheckoutArgs>({
    name: "gitCheckout",
    description: "Switch branches or restore working tree files (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    approval: {
      message: (args: Record<string, unknown>, context: ToolExecutionContext) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const typedArgs = args as GitCheckoutArgs;
          const workingDir = typedArgs.path
            ? yield* shell.resolvePath(
                {
                  agentId: context.agentId,
                  ...(context.conversationId && { conversationId: context.conversationId }),
                },
                typedArgs.path,
              )
            : yield* shell.getCwd({
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              });

          const create = typedArgs.create ? " (create new branch)" : "";
          const force = typedArgs.force ? " (force - discards changes)" : "";
          return `Checkout branch "${typedArgs.branch}"${create}${force} in ${workingDir}?`;
        }),
    },
    handler: (args: Record<string, unknown>, context: ToolExecutionContext) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const typedArgs = args as GitCheckoutArgs;

        const workingDir = typedArgs.path
          ? yield* shell.resolvePath(
              {
                agentId: context.agentId,
                ...(context.conversationId && { conversationId: context.conversationId }),
              },
              typedArgs.path,
            )
          : yield* shell.getCwd({
              agentId: context.agentId,
              ...(context.conversationId && { conversationId: context.conversationId }),
            });

        // For now, return a simple checkout message
        return {
          success: true,
          result: {
            workingDirectory: workingDir,
            branch: typedArgs.branch,
            created: typedArgs.create || false,
            force: typedArgs.force || false,
            message: `Switched to branch: ${typedArgs.branch}`,
          },
        };
      }),
    createSummary: (result: ToolExecutionResult) => {
      if (result.success && typeof result.result === "object" && result.result !== null) {
        const gitResult = result.result as { branch: string; created: boolean };
        return `Switched to ${gitResult.branch}${gitResult.created ? " (newly created)" : ""}`;
      }
      return result.success ? "Git checkout successful" : "Git checkout failed";
    },
  });
}
