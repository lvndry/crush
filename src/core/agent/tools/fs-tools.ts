import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { type ShellService, ShellServiceTag } from "../../../services/shell";
import { defineTool, makeJsonSchemaValidator } from "./base-tool";
import { type Tool, type ToolExecutionContext } from "./tool-registry";

/**
 * Filesystem and shell tools: pwd, ls, cd, grep, find, mkdir, rm
 * mkdir and rm require explicit approval and are executed via hidden execute* tools.
 */

// Utility helpers
function buildKeyFromContext(context: ToolExecutionContext): {
  agentId: string;
  conversationId?: string;
} {
  return context.conversationId
    ? { agentId: context.agentId, conversationId: context.conversationId }
    : { agentId: context.agentId };
}

function normalizeFilterPattern(pattern?: string): {
  type: "substring" | "regex";
  value?: string;
  regex?: RegExp;
} {
  if (!pattern || pattern.trim() === "") return { type: "substring" };
  const trimmed = pattern.trim();
  if (trimmed.startsWith("re:")) {
    const body = trimmed.slice(3);
    try {
      return { type: "regex", regex: new RegExp(body) };
    } catch {
      return { type: "substring", value: body };
    }
  }
  return { type: "substring", value: trimmed };
}

// pwd
export function createPwdTool(): Tool<ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  } as const;
  return defineTool<ShellService, Record<string, never>>({
    name: "pwd",
    description: "Print the current working directory for this agent session",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (_args, context) =>
      Effect.gen(function* () {
        const shell = yield* ShellServiceTag;
        const cwd = yield* shell.getCwd(buildKeyFromContext(context));
        return { success: true, result: cwd };
      }),
  });
}

// ls
export function createLsTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description: "Directory path to list (defaults to current directory)",
      },
      showHidden: {
        type: "boolean",
        description: "Include hidden files (dotfiles)",
        default: false,
      },
      recursive: { type: "boolean", description: "Recurse into sub-directories", default: false },
      pattern: { type: "string", description: "Filter by substring or use 're:<regex>'" },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return",
        default: 2000,
      },
    },
    required: [],
  } as const;

  return defineTool<
    FileSystem.FileSystem | ShellService,
    {
      path?: string;
      showHidden?: boolean;
      recursive?: boolean;
      pattern?: string;
      maxResults?: number;
    }
  >({
    name: "ls",
    description: "List directory contents with optional filtering and recursion",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* ShellServiceTag;

        const basePath = args.path
          ? yield* shell.resolvePath(buildKeyFromContext(context), args.path)
          : yield* shell.getCwd(buildKeyFromContext(context));

        const includeHidden = args.showHidden === true;
        const recursive = args.recursive === true;
        const maxResults =
          typeof args.maxResults === "number" && args.maxResults > 0 ? args.maxResults : 2000;
        const filter = normalizeFilterPattern(args.pattern);

        function matches(name: string): boolean {
          if (!filter.value && !filter.regex) return true;
          if (filter.type === "regex" && filter.regex) return filter.regex.test(name);
          return filter.value ? name.includes(filter.value) : true;
        }

        const results: { path: string; name: string; type: "file" | "dir" }[] = [];

        function walk(dir: string): Effect.Effect<void, Error, FileSystem.FileSystem> {
          return Effect.gen(function* () {
            const entries = yield* fs.readDirectory(dir);
            for (const name of entries) {
              if (!includeHidden && name.startsWith(".")) continue;
              const full = `${dir}/${name}`;
              const stat = yield* fs.stat(full);
              const type = stat.type === "Directory" ? "dir" : "file";
              if (matches(name)) {
                results.push({ path: full, name, type });
                if (results.length >= maxResults) return;
              }
              if (recursive && stat.type === "Directory") {
                yield* walk(full);
                if (results.length >= maxResults) return;
              }
            }
          });
        }

        try {
          const stat = yield* fs.stat(basePath);
          if (stat.type !== "Directory") {
            return { success: false, result: null, error: `Not a directory: ${basePath}` };
          }
          yield* walk(basePath);
          return { success: true, result: results };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `ls failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// cd
export function createCdTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Path to change directory to" },
    },
    required: ["path"],
  } as const;

  return defineTool<FileSystem.FileSystem | ShellService, { path: string }>({
    name: "cd",
    description: "Change the current working directory for this agent session",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* ShellServiceTag;
        const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path);
        try {
          const stat = yield* fs.stat(target);
          if (stat.type !== "Directory") {
            return { success: false, result: null, error: `Not a directory: ${target}` };
          }
          yield* shell.setCwd(buildKeyFromContext(context), target);
          return { success: true, result: target };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `cd failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// grep
export function createGrepTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      pattern: { type: "string", description: "Search pattern (literal or 're:<regex>')" },
      path: { type: "string", description: "File or directory to search (defaults to cwd)" },
      recursive: { type: "boolean", description: "Recurse into directories", default: true },
      regex: { type: "boolean", description: "Treat pattern as regex (overrides re:<...>)" },
      ignoreCase: { type: "boolean", description: "Case-insensitive match", default: false },
      maxResults: { type: "number", description: "Max matches to return", default: 5000 },
    },
    required: ["pattern"],
  } as const;

  return defineTool<
    FileSystem.FileSystem | ShellService,
    {
      pattern: string;
      path?: string;
      recursive?: boolean;
      regex?: boolean;
      ignoreCase?: boolean;
      maxResults?: number;
    }
  >({
    name: "grep",
    description: "Search for a pattern in files",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* ShellServiceTag;
        const start = args.path
          ? yield* shell.resolvePath(buildKeyFromContext(context), args.path)
          : yield* shell.getCwd(buildKeyFromContext(context));
        const recursive = args.recursive !== false;
        const maxResults =
          typeof args.maxResults === "number" && args.maxResults > 0 ? args.maxResults : 5000;

        // Compile matcher
        let matcher: (line: string) => boolean;
        if (args.regex === true || args.pattern.startsWith("re:")) {
          const source: string = args.regex === true ? args.pattern : args.pattern.slice(3) || "";
          const flags: string = args.ignoreCase ? "i" : "";
          const rx = new RegExp(source, flags);
          matcher = (line: string): boolean => rx.test(line);
        } else {
          const pat: string = args.ignoreCase ? args.pattern.toLowerCase() : args.pattern;
          matcher = (line: string): boolean =>
            (args.ignoreCase ? line.toLowerCase() : line).includes(pat);
        }

        type Match = { file: string; line: number; text: string };
        const matches: Match[] = [];

        function walk(path: string): Effect.Effect<void, Error, FileSystem.FileSystem> {
          return Effect.gen(function* () {
            const stat = yield* fs.stat(path);
            if (stat.type === "Directory") {
              const entries = yield* fs.readDirectory(path);
              for (const name of entries) {
                const full = `${path}/${name}`;
                if (recursive) {
                  yield* walk(full);
                  if (matches.length >= maxResults) return;
                } else {
                  const st = yield* fs.stat(full);
                  if (st.type !== "Directory") {
                    yield* scanFile(full);
                    if (matches.length >= maxResults) return;
                  }
                }
              }
            } else {
              yield* scanFile(path);
            }
          });
        }

        function scanFile(file: string): Effect.Effect<void, Error, FileSystem.FileSystem> {
          return Effect.gen(function* () {
            try {
              const content = yield* fs.readFileString(file);
              const lines = content.split(/\r?\n/);
              for (let i = 0; i < lines.length; i++) {
                const text: string = lines[i] ?? "";
                if (matcher(text)) {
                  matches.push({ file, line: i + 1, text });
                  if (matches.length >= maxResults) return;
                }
              }
            } catch {
              // Ignore unreadable files
            }
          });
        }

        try {
          yield* walk(start);
          return { success: true, result: matches };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `grep failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// find
export function createFindTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Start directory (defaults to cwd)" },
      name: { type: "string", description: "Filter by name (substring or 're:<regex>')" },
      type: {
        type: "string",
        enum: ["file", "dir", "all"],
        description: "Type filter",
        default: "all",
      },
      maxDepth: {
        type: "number",
        description: "Maximum depth to traverse (0=current dir)",
        default: 25,
      },
      maxResults: { type: "number", description: "Maximum results to return", default: 5000 },
      includeHidden: {
        type: "boolean",
        description: "Include dotfiles and dot-directories",
        default: false,
      },
    },
    required: [],
  } as const;

  return defineTool<
    FileSystem.FileSystem | ShellService,
    {
      path?: string;
      name?: string;
      type?: "file" | "dir" | "all";
      maxDepth?: number;
      maxResults?: number;
      includeHidden?: boolean;
    }
  >({
    name: "find",
    description: "Find files and directories with filtering",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* ShellServiceTag;
        const start = args.path
          ? yield* shell.resolvePath(buildKeyFromContext(context), args.path)
          : yield* shell.getCwd(buildKeyFromContext(context));

        const filter = normalizeFilterPattern(args.name);
        const includeHidden = args.includeHidden === true;
        const maxResults =
          typeof args.maxResults === "number" && args.maxResults > 0 ? args.maxResults : 5000;
        const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : 25;
        const typeFilter = args.type ?? "all";

        function matches(name: string): boolean {
          if (!filter.value && !filter.regex) return true;
          if (filter.type === "regex" && filter.regex) return filter.regex.test(name);
          return filter.value ? name.includes(filter.value) : true;
        }

        const results: { path: string; name: string; type: "file" | "dir" }[] = [];

        function walk(
          dir: string,
          depth: number,
        ): Effect.Effect<void, Error, FileSystem.FileSystem> {
          return Effect.gen(function* () {
            if (depth > maxDepth) return;
            const entries = yield* fs.readDirectory(dir);
            for (const name of entries) {
              if (!includeHidden && name.startsWith(".")) continue;
              const full = `${dir}/${name}`;
              const stat = yield* fs.stat(full);
              const type = stat.type === "Directory" ? "dir" : "file";
              if ((typeFilter === "all" || typeFilter === type) && matches(name)) {
                results.push({ path: full, name, type });
                if (results.length >= maxResults) return;
              }
              if (stat.type === "Directory") {
                yield* walk(full, depth + 1);
                if (results.length >= maxResults) return;
              }
            }
          });
        }

        try {
          const st = yield* fs.stat(start);
          if (st.type !== "Directory") {
            return { success: false, result: null, error: `Not a directory: ${start}` };
          }
          yield* walk(start, 0);
          return { success: true, result: results };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `find failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// mkdir (approval required)
export function createMkdirTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Directory path to create" },
      recursive: {
        type: "boolean",
        description: "Create parent directories as needed",
        default: true,
      },
    },
    required: ["path"],
  } as const;

  return defineTool<FileSystem.FileSystem | ShellService, { path: string; recursive?: boolean }>({
    name: "mkdir",
    description: "Create a directory (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    approval: {
      message: (args, context) =>
        Effect.gen(function* () {
          const shell = yield* ShellServiceTag;
          const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path);
          return `About to create directory: ${target}${args.recursive === false ? "" : " (with parents)"}.\nIf the user confirms, call executeMkdir with the same arguments.`;
        }),
      execute: {
        toolName: "executeMkdir",
        buildArgs: (args) => ({
          path: (args as { path: string; recursive?: boolean }).path,
          recursive: (args as { path: string; recursive?: boolean }).recursive,
        }),
      },
    },
    handler: (_args) =>
      Effect.succeed({ success: false, result: null, error: "Approval required" }),
  });
}

export function createExecuteMkdirTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Directory path to create" },
      recursive: {
        type: "boolean",
        description: "Create parent directories as needed",
        default: true,
      },
    },
    required: ["path"],
  } as const;

  return defineTool<FileSystem.FileSystem | ShellService, { path: string; recursive?: boolean }>({
    name: "executeMkdir",
    description: "Execute mkdir after user approval",
    hidden: true,
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* ShellServiceTag;
        const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path);
        try {
          yield* fs.makeDirectory(target, { recursive: args.recursive !== false });
          return { success: true, result: `Directory created: ${target}` };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `mkdir failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// rm (approval required)
export function createRmTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "File or directory to remove" },
      recursive: { type: "boolean", description: "Recursively remove directories", default: false },
      force: {
        type: "boolean",
        description: "Ignore non-existent files and errors",
        default: false,
      },
    },
    required: ["path"],
  } as const;

  return defineTool<
    FileSystem.FileSystem | ShellService,
    { path: string; recursive?: boolean; force?: boolean }
  >({
    name: "rm",
    description: "Remove a file or directory (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    approval: {
      message: (args, context) =>
        Effect.gen(function* () {
          const shell = yield* ShellServiceTag;
          const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path);
          const recurse = args.recursive === true ? " recursively" : "";
          return `About to delete${recurse}: ${target}. This action may be irreversible.\nIf the user confirms, call executeRm with the same arguments.`;
        }),
      execute: {
        toolName: "executeRm",
        buildArgs: (args) => ({
          path: (args as { path: string }).path,
          recursive: (args as { recursive?: boolean }).recursive,
          force: (args as { force?: boolean }).force,
        }),
      },
    },
    handler: (_args) =>
      Effect.succeed({ success: false, result: null, error: "Approval required" }),
  });
}

export function createExecuteRmTool(): Tool<FileSystem.FileSystem | ShellService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "File or directory to remove" },
      recursive: { type: "boolean", description: "Recursively remove directories", default: false },
      force: {
        type: "boolean",
        description: "Ignore non-existent files and errors",
        default: false,
      },
    },
    required: ["path"],
  } as const;

  return defineTool<
    FileSystem.FileSystem | ShellService,
    { path: string; recursive?: boolean; force?: boolean }
  >({
    name: "executeRm",
    description: "Execute rm after user approval",
    hidden: true,
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* ShellServiceTag;
        const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path);
        try {
          // Basic safeguards: do not allow deleting root or home dir directly
          if (target === "/" || target === process.env["HOME"]) {
            return {
              success: false,
              result: null,
              error: `Refusing to remove critical path: ${target}`,
            };
          }
          // If not recursive and target is directory, error
          const st = yield* fs
            .stat(target)
            .pipe(
              Effect.catchAll((err) =>
                args.force ? Effect.fail(err as Error) : Effect.fail(err as Error),
              ),
            );
          if (st.type === "Directory" && args.recursive !== true) {
            return {
              success: false,
              result: null,
              error: `Path is a directory, use recursive: true`,
            };
          }
          yield* fs.remove(target, {
            recursive: args.recursive === true,
            force: args.force === true,
          });
          return { success: true, result: `Removed: ${target}` };
        } catch (error) {
          if (args.force) {
            return {
              success: true,
              result: `Removal attempted with force; error ignored: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
          return {
            success: false,
            result: null,
            error: `rm failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// Registration helper
export function registerFileTools(): Effect.Effect<void, Error, FileSystem.FileSystem> {
  // This function is not used directly; register-tools.ts imports specific tools and registers them.
  return Effect.void;
}
