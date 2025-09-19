import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "bun:test";
import { Effect, Layer } from "effect";
import { createFileSystemContextServiceLayer, FileSystemContextServiceTag } from "./shell";

describe("FileSystemContextService", () => {
  const createTestLayer = () => {
    const shellLayer = createFileSystemContextServiceLayer();
    return Layer.provide(shellLayer, NodeFileSystem.layer);
  };

  describe("getCwd", () => {
    it("should default to current working directory when no working directory is set", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const cwd = yield* shell.getCwd({ agentId: "test-agent" });
        return cwd;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe(process.cwd());
    });

    it("should return set working directory for specific agent", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const testPath = "/tmp/test-dir";

        // Create the test directory first
        yield* Effect.promise(() =>
          import("fs/promises").then((fs) => fs.mkdir(testPath, { recursive: true })),
        );

        // First set a working directory
        yield* shell.setCwd({ agentId: "test-agent" }, testPath);

        // Then get it back
        const cwd = yield* shell.getCwd({ agentId: "test-agent" });
        return cwd;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe("/tmp/test-dir");
    });
  });

  describe("resolvePath", () => {
    it("should handle absolute paths correctly", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const resolved = yield* shell.resolvePath({ agentId: "test" }, "/usr/bin");
        return resolved;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe("/usr/bin");
    });

    it("should resolve relative paths from working directory", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const resolved = yield* shell.resolvePath({ agentId: "test" }, "Documents", {
          skipExistenceCheck: true,
        });
        return resolved;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe(`${process.cwd()}/Documents`);
    });
  });

  describe("path normalization", () => {
    it("should handle backslash-escaped spaces", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const resolved = yield* shell.resolvePath({ agentId: "test" }, "/tmp/Test\\ Directory/", {
          skipExistenceCheck: true,
        });
        return resolved;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe("/tmp/Test Directory/");
    });

    it("should handle double-quoted paths", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const resolved = yield* shell.resolvePath({ agentId: "test" }, '"/tmp/Test Directory/"', {
          skipExistenceCheck: true,
        });
        return resolved;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe("/tmp/Test Directory/");
    });

    it("should handle single-quoted paths", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const resolved = yield* shell.resolvePath({ agentId: "test" }, "'/tmp/Test Directory/'", {
          skipExistenceCheck: true,
        });
        return resolved;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe("/tmp/Test Directory/");
    });

    it("should handle mixed escaping", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const resolved = yield* shell.resolvePath({ agentId: "test" }, '"/tmp/Test\\ Directory/"', {
          skipExistenceCheck: true,
        });
        return resolved;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe("/tmp/Test Directory/");
    });

    it("should handle paths with multiple spaces", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const resolved = yield* shell.resolvePath({ agentId: "test" }, '"/My Folder With Spaces/"');
        return resolved;
      }).pipe(Effect.catchAll((error) => Effect.succeed(error.message)));

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      // The path doesn't exist, so we should get an error message
      expect(result).toContain("Path not found");
    });
  });

  describe("escapePath", () => {
    it("should escape paths with spaces", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const escaped = shell.escapePath("/tmp/Test Directory/");
        return escaped;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe('"/tmp/Test Directory/"');
    });

    it("should escape paths with special characters", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const escaped = shell.escapePath("/path/with(special)chars/");
        return escaped;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe('"/path/with(special)chars/"');
    });

    it("should not escape simple paths", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const escaped = shell.escapePath("/simple/path/");
        return escaped;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe("/simple/path/");
    });

    it("should handle already quoted paths", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const escaped = shell.escapePath('"/already/quoted/"');
        return escaped;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toBe('"/already/quoted/"');
    });
  });

  describe("findDirectory", () => {
    it("should find directories by name", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        // Set working directory to root to search for system directories
        yield* shell.setCwd({ agentId: "test" }, "/");
        const found = yield* shell.findDirectory({ agentId: "test" }, "bin", 2);
        return found;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      // Should find /usr/bin and possibly other bin directories
      expect((result as string[]).length).toBeGreaterThan(0);
      expect((result as string[]).some((path: string) => path.includes("/bin"))).toBe(true);
    });

    it("should return empty array when no directories found", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        const found = yield* shell.findDirectory(
          { agentId: "test" },
          "nonexistentdirectory12345",
          1,
        );
        return found;
      });

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should provide helpful error messages for non-existent paths", async () => {
      const testEffect = Effect.gen(function* () {
        const shell = yield* FileSystemContextServiceTag;
        yield* shell.resolvePath({ agentId: "test" }, "/absolute/nonexistent/path");
        return "should not reach here";
      }).pipe(Effect.catchAll((error) => Effect.succeed(error.message)));

      const result = await Effect.runPromise(
        testEffect.pipe(Effect.provide(createTestLayer())) as any,
      );

      expect(result).toContain("Path not found");
    });
  });
});
