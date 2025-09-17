import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "bun:test";
import { Effect, Layer } from "effect";
import { createFileSystemContextServiceLayer } from "../../../services/shell";
import {
  createGitAddTool,
  createGitBranchTool,
  createGitCheckoutTool,
  createGitCommitTool,
  createGitDiffTool,
  createGitLogTool,
  createGitPullTool,
  createGitPushTool,
  createGitStatusTool,
} from "./git-tools";
import { createToolRegistryLayer } from "./tool-registry";

describe("Git Tools", () => {
  const createTestLayer = () => {
    const shellLayer = createFileSystemContextServiceLayer();
    const toolRegistryLayer = createToolRegistryLayer();
    return Layer.mergeAll(toolRegistryLayer, Layer.provide(shellLayer, NodeFileSystem.layer));
  };

  it("should create gitStatus tool with proper structure", () => {
    const tool = createGitStatusTool();
    expect(tool.name).toBe("gitStatus");
    expect(tool.description).toContain("working tree status");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitLog tool with proper structure", () => {
    const tool = createGitLogTool();
    expect(tool.name).toBe("gitLog");
    expect(tool.description).toContain("commit history");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitAdd tool with approval requirement", () => {
    const tool = createGitAddTool();
    expect(tool.name).toBe("gitAdd");
    expect(tool.description).toContain("requires user approval");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitCommit tool with approval requirement", () => {
    const tool = createGitCommitTool();
    expect(tool.name).toBe("gitCommit");
    expect(tool.description).toContain("requires user approval");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitDiff tool with proper structure", () => {
    const tool = createGitDiffTool();
    expect(tool.name).toBe("gitDiff");
    expect(tool.description).toContain("changes between commits");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitPush tool with approval requirement", () => {
    const tool = createGitPushTool();
    expect(tool.name).toBe("gitPush");
    expect(tool.description).toContain("requires user approval");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitPull tool with approval requirement", () => {
    const tool = createGitPullTool();
    expect(tool.name).toBe("gitPull");
    expect(tool.description).toContain("requires user approval");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitBranch tool with proper structure", () => {
    const tool = createGitBranchTool();
    expect(tool.name).toBe("gitBranch");
    expect(tool.description).toContain("branches");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should create gitCheckout tool with approval requirement", () => {
    const tool = createGitCheckoutTool();
    expect(tool.name).toBe("gitCheckout");
    expect(tool.description).toContain("requires user approval");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(tool.createSummary).toBeDefined();
  });

  it("should execute gitStatus tool", async () => {
    const testEffect = Effect.gen(function* () {
      const tool = createGitStatusTool();
      const context = {
        agentId: "test-agent",
        conversationId: "test-conversation",
      };

      const result = yield* tool.execute({}, context);
      return result;
    });

    const result = await Effect.runPromise(testEffect.pipe(Effect.provide(createTestLayer())));

    expect(result.success).toBe(true);
    if (result.success && typeof result.result === "object" && result.result !== null) {
      const gitResult = result.result as { workingDirectory: string; hasChanges: boolean };
      expect(gitResult.workingDirectory).toBeDefined();
      expect(typeof gitResult.hasChanges).toBe("boolean");
    }
  });

  it("should execute gitLog tool", async () => {
    const testEffect = Effect.gen(function* () {
      const tool = createGitLogTool();
      const context = {
        agentId: "test-agent",
        conversationId: "test-conversation",
      };

      const result = yield* tool.execute({ limit: 5, oneline: true }, context);
      return result;
    });

    const result = await Effect.runPromise(testEffect.pipe(Effect.provide(createTestLayer())));

    expect(result.success).toBe(true);
    if (result.success && typeof result.result === "object" && result.result !== null) {
      const gitResult = result.result as { workingDirectory: string; commitCount: number };
      expect(gitResult.workingDirectory).toBeDefined();
      expect(typeof gitResult.commitCount).toBe("number");
    }
  });

  it("should execute gitDiff tool", async () => {
    const testEffect = Effect.gen(function* () {
      const tool = createGitDiffTool();
      const context = {
        agentId: "test-agent",
        conversationId: "test-conversation",
      };

      const result = yield* tool.execute({ staged: true, branch: "main" }, context);
      return result;
    });

    const result = await Effect.runPromise(testEffect.pipe(Effect.provide(createTestLayer())));

    expect(result.success).toBe(true);
    if (result.success && typeof result.result === "object" && result.result !== null) {
      const gitResult = result.result as {
        workingDirectory: string;
        hasChanges: boolean;
        options: any;
      };
      expect(gitResult.workingDirectory).toBeDefined();
      expect(typeof gitResult.hasChanges).toBe("boolean");
      expect(gitResult.options.staged).toBe(true);
      expect(gitResult.options.branch).toBe("main");
    }
  });

  it("should execute gitBranch tool", async () => {
    const testEffect = Effect.gen(function* () {
      const tool = createGitBranchTool();
      const context = {
        agentId: "test-agent",
        conversationId: "test-conversation",
      };

      const result = yield* tool.execute({ all: true, remote: false }, context);
      return result;
    });

    const result = await Effect.runPromise(testEffect.pipe(Effect.provide(createTestLayer())));

    expect(result.success).toBe(true);
    if (result.success && typeof result.result === "object" && result.result !== null) {
      const gitResult = result.result as {
        workingDirectory: string;
        branches: string[];
        currentBranch: string;
        options: any;
      };
      expect(gitResult.workingDirectory).toBeDefined();
      expect(Array.isArray(gitResult.branches)).toBe(true);
      expect(gitResult.currentBranch).toBe("main");
      expect(gitResult.options.all).toBe(true);
      expect(gitResult.options.remote).toBe(false);
    }
  });
});
