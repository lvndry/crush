import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";

export interface ShellService {
  readonly getCwd: (key: { agentId: string; conversationId?: string }) => Effect.Effect<string>;
  readonly setCwd: (
    key: { agentId: string; conversationId?: string },
    path: string,
  ) => Effect.Effect<void, Error, FileSystem.FileSystem>;
  readonly resolvePath: (
    key: { agentId: string; conversationId?: string },
    path: string,
  ) => Effect.Effect<string, Error, FileSystem.FileSystem>;
}

export const ShellServiceTag = Context.GenericTag<ShellService>("ShellService");

/**
 * In-memory shell service that tracks a working directory per agent/conversation.
 * Falls back to process.cwd() when no directory was set.
 */
export function createShellServiceLayer(): Layer.Layer<ShellService, never, FileSystem.FileSystem> {
  return Layer.effect(
    ShellServiceTag,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;

      // Map key: agentId|conversationId? -> cwd
      const cwdByKey = new Map<string, string>();

      function makeKey(key: { agentId: string; conversationId?: string }): string {
        return key.conversationId ? `${key.agentId}:${key.conversationId}` : key.agentId;
      }

      function normalize(p: string): string {
        // Very lightweight normalization; rely on fs to resolve more accurately
        return p.replace(/\\/g, "/");
      }

      const service: ShellService = {
        getCwd: (key) => Effect.sync(() => cwdByKey.get(makeKey(key)) ?? process.cwd()),

        setCwd: (key, path) =>
          Effect.gen(function* () {
            const target = normalize(path);
            // Ensure the directory exists and is a directory
            const stat = yield* fs.stat(target);
            const isDir =
              (stat as unknown as { isDirectory?: boolean; type?: string }).isDirectory === true ||
              (stat as unknown as { type?: string }).type === "Directory";
            if (!isDir) {
              return yield* Effect.fail(new Error(`Not a directory: ${target}`));
            }
            cwdByKey.set(makeKey(key), target);
          }),

        resolvePath: (key, path) =>
          Effect.sync(() => {
            const base = cwdByKey.get(makeKey(key)) ?? process.cwd();
            const resolved = path.startsWith("/") ? normalize(path) : `${base}/${path}`;
            return resolved;
          }),
      };

      return service;
    }),
  );
}
