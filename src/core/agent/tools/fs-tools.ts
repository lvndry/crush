import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  type FileSystemContextService,
  FileSystemContextServiceTag,
} from "../../../services/shell";
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

// findPath - helps agent discover paths when unsure
export function createFindPathTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        description: "Name or partial name of the directory/file to find",
      },
      maxDepth: {
        type: "number",
        description: "Maximum search depth (default: 3)",
        default: 3,
      },
      type: {
        type: "string",
        enum: ["directory", "file", "both"],
        description: "Type of item to search for",
        default: "both",
      },
    },
    required: ["name"],
  } as const;

  return defineTool<
    FileSystem.FileSystem | FileSystemContextService,
    { name: string; maxDepth?: number; type?: "directory" | "file" | "both" }
  >({
    name: "findPath",
    description: "Find directories or files by name when you're unsure about the exact path",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;

        const currentDir = yield* shell.getCwd(buildKeyFromContext(context));
        const maxDepth = args.maxDepth ?? 3;
        const searchType = args.type ?? "both";

        const results: { path: string; name: string; type: "file" | "dir" }[] = [];

        function searchDirectory(
          dir: string,
          depth: number,
        ): Effect.Effect<void, Error, FileSystem.FileSystem> {
          return Effect.gen(function* () {
            if (depth > maxDepth) return;

            try {
              const entries = yield* fs
                .readDirectory(dir)
                .pipe(Effect.catchAll(() => Effect.succeed([])));

              for (const name of entries) {
                const fullPath = `${dir}/${name}`;

                try {
                  const stat = yield* fs
                    .stat(fullPath)
                    .pipe(Effect.catchAll(() => Effect.succeed(null)));

                  if (!stat) continue;

                  const isDirectory = stat.type === "Directory";
                  const isFile = stat.type === "File";

                  // Check if name matches (case-insensitive partial match)
                  const nameMatches = name.toLowerCase().includes(args.name.toLowerCase());

                  if (nameMatches) {
                    if (
                      (searchType === "directory" && isDirectory) ||
                      (searchType === "file" && isFile) ||
                      searchType === "both"
                    ) {
                      results.push({
                        path: fullPath,
                        name,
                        type: isDirectory ? "dir" : "file",
                      });
                    }
                  }

                  // Recurse into directories
                  if (isDirectory && depth < maxDepth) {
                    yield* searchDirectory(fullPath, depth + 1);
                  }
                } catch {
                  // Skip inaccessible files/directories
                  continue;
                }
              }
            } catch {
              // Skip inaccessible directories
              return;
            }
          });
        }

        yield* searchDirectory(currentDir, 0);

        return {
          success: true,
          result: {
            searchTerm: args.name,
            currentDirectory: currentDir,
            maxDepth,
            type: searchType,
            results: results.slice(0, 50), // Limit results to avoid overwhelming output
            totalFound: results.length,
            message:
              results.length === 0
                ? `No ${searchType === "both" ? "items" : searchType + "s"} found matching "${args.name}"`
                : `Found ${results.length} ${searchType === "both" ? "items" : searchType + "s"} matching "${args.name}"`,
          },
        };
      }),
  });
}

// pwd
export function createPwdTool(): Tool<FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  } as const;
  return defineTool<FileSystemContextService, Record<string, never>>({
    name: "pwd",
    description: "Print the current working directory for this agent session",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (_args, context) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const cwd = yield* shell.getCwd(buildKeyFromContext(context));
        return { success: true, result: cwd };
      }),
  });
}

// ls
export function createLsTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
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
    FileSystem.FileSystem | FileSystemContextService,
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
    validate: makeJsonSchemaValidator(parameters),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;

        const basePath = args.path
          ? yield* shell.resolvePath(buildKeyFromContext(context), args.path).pipe(
              Effect.catchAll((error) =>
                Effect.succeed({
                  success: false,
                  result: null,
                  error: error instanceof Error ? error.message : String(error),
                }),
              ),
            )
          : yield* shell.getCwd(buildKeyFromContext(context));

        // If path resolution failed, return the error with suggestions
        if (typeof basePath === "object" && "success" in basePath && !basePath.success) {
          return basePath;
        }

        const resolvedPath = basePath as string;

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
            // Handle permission errors gracefully
            const entries = yield* fs
              .readDirectory(dir)
              .pipe(Effect.catchAll(() => Effect.succeed([])));

            for (const name of entries) {
              if (!includeHidden && name.startsWith(".")) continue;
              const full = `${dir}/${name}`;

              // Handle broken symbolic links gracefully
              const stat = yield* fs.stat(full).pipe(Effect.catchAll(() => Effect.succeed(null)));

              if (!stat) {
                // Skip broken symbolic links or inaccessible files
                continue;
              }

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
          const stat = yield* fs.stat(resolvedPath);
          if (stat.type !== "Directory") {
            return { success: false, result: null, error: `Not a directory: ${resolvedPath}` };
          }
          yield* walk(resolvedPath);
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
export function createCdTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Path to change directory to" },
    },
    required: ["path"],
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, { path: string }>({
    name: "cd",
    description: "Change the current working directory for this agent session",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;

        // Try to resolve the path - this will provide helpful suggestions if the path doesn't exist
        const targetResult = yield* shell.resolvePath(buildKeyFromContext(context), args.path).pipe(
          Effect.catchAll((error) =>
            Effect.succeed({
              success: false,
              result: null,
              error: error instanceof Error ? error.message : String(error),
            }),
          ),
        );

        // If path resolution failed, return the error with suggestions
        if (
          typeof targetResult === "object" &&
          "success" in targetResult &&
          !targetResult.success
        ) {
          return targetResult;
        }

        const target = targetResult as string;

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

// readFile
export function createReadFileTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "File path to read (relative to cwd allowed)" },
      startLine: { type: "number", description: "1-based start line (inclusive)" },
      endLine: { type: "number", description: "1-based end line (inclusive)" },
      maxBytes: {
        type: "number",
        description: "Maximum number of bytes to return (content is truncated if exceeded)",
        default: 131072,
      },
      encoding: {
        type: "string",
        description: "Text encoding (currently utf-8)",
        default: "utf-8",
      },
    },
    required: ["path"],
  } as const;

  return defineTool<
    FileSystem.FileSystem | FileSystemContextService,
    { path: string; startLine?: number; endLine?: number; maxBytes?: number; encoding?: string }
  >({
    name: "readFile",
    description: "Read a text file with optional line range and size limit",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;
        const filePathResult = yield* shell
          .resolvePath(buildKeyFromContext(context), args.path)
          .pipe(
            Effect.catchAll((error) =>
              Effect.succeed({
                success: false,
                result: null,
                error: error instanceof Error ? error.message : String(error),
              }),
            ),
          );

        // If path resolution failed, return the error with suggestions
        if (
          typeof filePathResult === "object" &&
          "success" in filePathResult &&
          !filePathResult.success
        ) {
          return filePathResult;
        }

        const filePath = filePathResult as string;

        try {
          const stat = yield* fs.stat(filePath);
          if (stat.type === "Directory") {
            return { success: false, result: null, error: `Not a file: ${filePath}` };
          }

          let content = yield* fs.readFileString(filePath);

          // Strip UTF-8 BOM if present
          if (content.length > 0 && content.charCodeAt(0) === 0xfeff) {
            content = content.slice(1);
          }

          let totalLines = 0;
          let returnedLines = 0;
          let rangeStart: number | undefined = undefined;
          let rangeEnd: number | undefined = undefined;

          // Apply line range if provided
          if (args.startLine !== undefined || args.endLine !== undefined) {
            const lines = content.split(/\r?\n/);
            totalLines = lines.length;
            const start = Math.max(1, args.startLine ?? 1);
            const rawEnd = args.endLine ?? totalLines;
            const end = Math.max(start, Math.min(rawEnd, totalLines));
            content = lines.slice(start - 1, end).join("\n");
            returnedLines = end - start + 1;
            rangeStart = start;
            rangeEnd = end;
          } else {
            // If no range, we can still report total lines lazily without splitting twice
            totalLines = content === "" ? 0 : content.split(/\r?\n/).length;
            returnedLines = totalLines;
          }

          // Enforce maxBytes safeguard (approximate by string length)
          const maxBytes =
            typeof args.maxBytes === "number" && args.maxBytes > 0 ? args.maxBytes : 131072;
          let truncated = false;
          if (content.length > maxBytes) {
            content = content.slice(0, maxBytes);
            truncated = true;
          }

          return {
            success: true,
            result: {
              path: filePath,
              encoding: (args.encoding ?? "utf-8").toLowerCase(),
              content,
              truncated,
              totalLines,
              returnedLines,
              range:
                rangeStart !== undefined ? { startLine: rangeStart, endLine: rangeEnd } : undefined,
            },
          };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `readFile failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// writeFile (approval required)
type WriteFileArgs = { path: string; content: string; encoding?: string; createDirs?: boolean };

export function createWriteFileTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description:
          "File path to write to, will be created if it doesn't exist (relative to cwd allowed)",
      },
      content: { type: "string", description: "Content to write to the file" },
      encoding: {
        type: "string",
        description: "Text encoding (currently utf-8)",
        default: "utf-8",
      },
      createDirs: {
        type: "boolean",
        description: "Create parent directories if they don't exist",
        default: false,
      },
    },
    required: ["path", "content"],
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, WriteFileArgs>({
    name: "writeFile",
    description:
      "Write content to a file, creating it if it doesn't exist (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    approval: {
      message: (args, context) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path, {
            skipExistenceCheck: true,
          });
          return `About to write to file: ${target}${args.createDirs === true ? " (will create parent directories)" : ""}.\n\nIMPORTANT: After getting user confirmation, you MUST call the executeWriteFile tool with these exact arguments: {"path": "${args.path}", "content": ${JSON.stringify(args.content)}, "encoding": "${args.encoding ?? "utf-8"}", "createDirs": ${args.createDirs === true}}`;
        }),
      errorMessage: "Approval required: File writing requires user confirmation.",
      execute: {
        toolName: "executeWriteFile",
        buildArgs: (args) => ({
          path: args.path,
          content: args.content,
          encoding: args.encoding,
          createDirs: args.createDirs,
        }),
      },
    },
    handler: (_args) =>
      Effect.succeed({ success: false, result: null, error: "Approval required" }),
  });
}

export function createExecuteWriteFileTool(): Tool<
  FileSystem.FileSystem | FileSystemContextService
> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description: "File path to write to, will be created if it doesn't exist",
      },
      content: { type: "string", description: "Content to write to the file" },
      encoding: {
        type: "string",
        description: "Text encoding (currently utf-8)",
        default: "utf-8",
      },
      createDirs: {
        type: "boolean",
        description: "Create parent directories if they don't exist",
        default: false,
      },
    },
    required: ["path", "content"],
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, WriteFileArgs>({
    name: "executeWriteFile",
    description: "Execute writeFile after user approval",
    hidden: true,
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;
        const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path, {
          skipExistenceCheck: true,
        });

        try {
          // Create parent directories if requested
          if (args.createDirs === true) {
            const parentDir = target.substring(0, target.lastIndexOf("/"));
            if (parentDir && parentDir !== target) {
              yield* fs.makeDirectory(parentDir, { recursive: true });
            }
          }

          // Write the file content
          yield* fs.writeFileString(target, args.content);

          return { success: true, result: `File written: ${target}` };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `writeFile failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// grep
export function createGrepTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
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
    FileSystem.FileSystem | FileSystemContextService,
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
        const shell = yield* FileSystemContextServiceTag;
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
            // Handle broken symbolic links gracefully
            const stat = yield* fs.stat(path).pipe(Effect.catchAll(() => Effect.succeed(null)));

            if (!stat) {
              // Skip broken symbolic links or inaccessible files
              return;
            }

            if (stat.type === "Directory") {
              // Handle permission errors gracefully
              const entries = yield* fs
                .readDirectory(path)
                .pipe(Effect.catchAll(() => Effect.succeed([])));

              for (const name of entries) {
                const full = `${path}/${name}`;
                if (recursive) {
                  yield* walk(full);
                  if (matches.length >= maxResults) return;
                } else {
                  const st = yield* fs.stat(full).pipe(Effect.catchAll(() => Effect.succeed(null)));
                  if (st && st.type !== "Directory") {
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
export function createFindTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Start directory (defaults to smart search)" },
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
      smart: {
        type: "boolean",
        description: "Use smart hierarchical search (HOME first, then expand)",
        default: true,
      },
    },
    required: [],
  } as const;

  return defineTool<
    FileSystem.FileSystem | FileSystemContextService,
    {
      path?: string;
      name?: string;
      type?: "file" | "dir" | "all";
      maxDepth?: number;
      maxResults?: number;
      includeHidden?: boolean;
      smart?: boolean;
    }
  >({
    name: "find",
    description:
      "Find files and directories with smart hierarchical search (searches HOME first, then expands)",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;

        const filter = normalizeFilterPattern(args.name);
        const includeHidden = args.includeHidden === true;
        const maxResults =
          typeof args.maxResults === "number" && args.maxResults > 0 ? args.maxResults : 5000;
        const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : 25;
        const typeFilter = args.type ?? "all";
        const useSmart = args.smart !== false; // Default to true

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
            if (depth > maxDepth || results.length >= maxResults) return;

            // Handle permission errors gracefully
            const entries = yield* fs
              .readDirectory(dir)
              .pipe(Effect.catchAll(() => Effect.succeed([])));

            for (const name of entries) {
              if (!includeHidden && name.startsWith(".")) continue;
              const full = `${dir}/${name}`;

              // Handle broken symbolic links gracefully
              const stat = yield* fs.stat(full).pipe(Effect.catchAll(() => Effect.succeed(null)));

              if (!stat) {
                // Skip broken symbolic links or inaccessible files
                continue;
              }

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

        // Smart search strategy: search in order of likelihood
        const searchPaths: string[] = [];

        if (args.path) {
          // If path is specified, use it directly
          const start = yield* shell.resolvePath(buildKeyFromContext(context), args.path);
          searchPaths.push(start);
        } else if (useSmart) {
          // Smart search: start with most likely locations
          const home = process.env["HOME"] || "";
          const cwd = yield* shell.getCwd(buildKeyFromContext(context));

          // 1. Current working directory (most likely)
          if (cwd && cwd !== home) {
            searchPaths.push(cwd);
          }

          // 2. Home directory (very likely)
          if (home) {
            searchPaths.push(home);
          }

          // 3. Common development directories in home
          if (home) {
            const commonDirs = [
              `${home}/Documents`,
              `${home}/Desktop`,
              `${home}/Downloads`,
              `${home}/Projects`,
              `${home}/Code`,
              `${home}/Development`,
              `${home}/github`,
              `${home}/git`,
            ];
            searchPaths.push(...commonDirs);
          }

          // 4. System-wide common locations (only if we haven't found enough results)
          searchPaths.push("/usr/local", "/opt", "/Applications");
        } else {
          // Traditional search: start from current directory
          const start = yield* shell.getCwd(buildKeyFromContext(context));
          searchPaths.push(start);
        }

        // Search each path in order
        for (const searchPath of searchPaths) {
          if (results.length >= maxResults) break;

          const st = yield* fs.stat(searchPath).pipe(Effect.catchAll(() => Effect.succeed(null)));

          if (st && st.type === "Directory") {
            yield* walk(searchPath, 0);
          }

          // If we found results in early paths and using smart search, we can stop early
          if (useSmart && results.length > 0 && searchPath.includes(process.env["HOME"] || "")) {
            break;
          }
        }

        return { success: true, result: results };
      }),
  });
}

// mkdir (approval required)
export function createMkdirTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
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

  return defineTool<
    FileSystem.FileSystem | FileSystemContextService,
    { path: string; recursive?: boolean }
  >({
    name: "mkdir",
    description: "Create a directory (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    approval: {
      message: (args, context) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const fs = yield* FileSystem.FileSystem;
          const target = yield* shell.resolvePathForMkdir(buildKeyFromContext(context), args.path);

          // Check if directory already exists
          const statResult = yield* fs
            .stat(target)
            .pipe(Effect.catchAll(() => Effect.succeed(null)));

          if (statResult) {
            if (statResult.type === "Directory") {
              return `Directory already exists: ${target}\n\nNo action needed - the directory is already present.`;
            } else {
              return `Path exists but is not a directory: ${target}\n\nCannot create directory at this location because a file already exists.`;
            }
          }

          return `About to create directory: ${target}${args.recursive === false ? "" : " (with parents)"}.\n\nIMPORTANT: After getting user confirmation, you MUST call the executeMkdir tool with these exact arguments: {"path": "${args.path}", "recursive": ${args.recursive !== false}}`;
        }),
      errorMessage: "Approval required: Directory creation requires user confirmation.",
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

export function createExecuteMkdirTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
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

  return defineTool<
    FileSystem.FileSystem | FileSystemContextService,
    { path: string; recursive?: boolean }
  >({
    name: "executeMkdir",
    description: "Execute mkdir after user approval",
    hidden: true,
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;
        const target = yield* shell.resolvePathForMkdir(buildKeyFromContext(context), args.path);

        // Check if directory already exists
        const statResult = yield* fs.stat(target).pipe(Effect.catchAll(() => Effect.succeed(null)));

        if (statResult) {
          if (statResult.type === "Directory") {
            return { success: true, result: `Directory already exists: ${target}` };
          } else {
            return {
              success: false,
              result: null,
              error: `Cannot create directory '${target}': a file already exists at this path`,
            };
          }
        }

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

// stat - check if file/directory exists and get info
export function createStatTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "File or directory path to check" },
    },
    required: ["path"],
  } as const;

  return defineTool<FileSystem.FileSystem | FileSystemContextService, { path: string }>({
    name: "stat",
    description: "Check if a file or directory exists and get its information",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (args, context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const shell = yield* FileSystemContextServiceTag;
        const target = yield* shell.resolvePathForMkdir(buildKeyFromContext(context), args.path);

        try {
          const stat = yield* fs.stat(target);
          return {
            success: true,
            result: {
              path: target,
              exists: true,
              type: stat.type,
              size: stat.size,
              mtime: stat.mtime,
              atime: stat.atime,
            },
          };
        } catch (error) {
          // Check if it's a "not found" error
          if (error instanceof Error && error.message.includes("ENOENT")) {
            return {
              success: true,
              result: {
                path: target,
                exists: false,
                type: null,
                size: null,
                mtime: null,
                atime: null,
              },
            };
          }

          return {
            success: false,
            result: null,
            error: `stat failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// rm (approval required)
export function createRmTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
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
    FileSystem.FileSystem | FileSystemContextService,
    { path: string; recursive?: boolean; force?: boolean }
  >({
    name: "rm",
    description: "Remove a file or directory (requires user approval)",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    approval: {
      message: (args, context) =>
        Effect.gen(function* () {
          const shell = yield* FileSystemContextServiceTag;
          const target = yield* shell.resolvePath(buildKeyFromContext(context), args.path);
          const recurse = args.recursive === true ? " recursively" : "";
          return `About to delete${recurse}: ${target}. This action may be irreversible.\nIf the user confirms, call executeRm with the same arguments.`;
        }),
      errorMessage: "Approval required: File/directory deletion requires user confirmation.",
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

export function createExecuteRmTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
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
    FileSystem.FileSystem | FileSystemContextService,
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
        const shell = yield* FileSystemContextServiceTag;
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

// finddir - search for directories by name
export function createFindDirTool(): Tool<FileSystem.FileSystem | FileSystemContextService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        description: "Directory name to search for (partial matches supported)",
      },
      path: {
        type: "string",
        description: "Starting path for search (defaults to current working directory)",
      },
      maxDepth: { type: "number", description: "Maximum search depth (default: 3)", default: 3 },
    },
    required: ["name"],
  } as const;

  return defineTool<
    FileSystem.FileSystem | FileSystemContextService,
    { name: string; path?: string; maxDepth?: number }
  >({
    name: "finddir",
    description: "Search for directories by name with partial matching",
    parameters,
    validate: makeJsonSchemaValidator(parameters),
    handler: (args, context) =>
      Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const startPath = args.path
          ? yield* shell.resolvePath(buildKeyFromContext(context), args.path)
          : yield* shell.getCwd(buildKeyFromContext(context));

        const found = yield* shell.findDirectory(
          buildKeyFromContext(context),
          args.name,
          args.maxDepth || 3,
        );

        return {
          success: true,
          result: {
            searchTerm: args.name,
            startPath,
            found: found,
            count: found.length,
          },
        };
      }),
  });
}

// Registration helper
export function registerFileTools(): Effect.Effect<void, Error, FileSystem.FileSystem> {
  // This function is not used directly; register-tools.ts imports specific tools and registers them.
  return Effect.void;
}
