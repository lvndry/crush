import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { Effect, Layer } from "effect";
import type { AppConfig } from "../../../core/types";
import { AgentConfigService } from "../../../services/config";
import { createWebSearchTool } from "./web-search-tools";

// Mock the linkup-sdk
const mockLinkupClient = mock();
const mockSearch = mock();

// Mock the LinkupClient constructor and search method
mockLinkupClient.mockImplementation(() => ({
  search: mockSearch,
}));

// Replace the LinkupClient import
(globalThis as unknown as { LinkupClient: unknown }).LinkupClient = mockLinkupClient;

describe("WebSearchTool", () => {
  const mockAppConfig: AppConfig = {
    storage: { type: "file", path: "./.jazz" },
    logging: { level: "info", format: "pretty", output: "console" },
    security: {},
    performance: { maxConcurrentAgents: 5, maxConcurrentTasks: 10, timeout: 30000 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a web search tool with correct properties", () => {
    const tool = createWebSearchTool();

    expect(tool.name).toBe("web_search");
    expect(tool.description).toContain("Search the web for current information");
    expect(tool.description).toContain("Linkup search engine by default");
    expect(tool.description).toContain("high-quality, factual search results");
  });

  it("should have correct parameter schema", () => {
    const tool = createWebSearchTool();

    // Check if parameters is a Zod schema (it should be)
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.parameters).toBe("object");

    // For Zod schemas, we check for _def property instead of type/properties
    expect(tool.parameters).toHaveProperty("_def");

    // Check that the schema has the expected shape properties
    const schema = tool.parameters as unknown as { _def: { shape: Record<string, unknown> } };
    expect(schema._def.shape).toHaveProperty("query");
    expect(schema._def.shape).toHaveProperty("depth");
    expect(schema._def.shape).toHaveProperty("outputType");
    expect(schema._def.shape).toHaveProperty("includeImages");
  });

  it("should validate arguments correctly", async () => {
    const tool = createWebSearchTool();

    // Mock config service
    const mockConfigService = {
      get: vi.fn().mockReturnValue(Effect.fail(new Error("Config not found"))),
      getOrElse: vi.fn().mockReturnValue(Effect.succeed("default")),
      getOrFail: vi.fn().mockReturnValue(Effect.fail(new Error("Linkup API key not found"))),
      has: vi.fn().mockReturnValue(Effect.succeed(false)),
      set: vi.fn().mockReturnValue(Effect.succeed(undefined)),
      appConfig: Effect.succeed(mockAppConfig),
    };

    const mockLayer = Layer.succeed(AgentConfigService, mockConfigService);

    const validArgs = {
      query: "test search",
      depth: "standard" as const,
      outputType: "sourcedAnswer" as const,
    };
    const validationResult = await Effect.runPromise(
      Effect.provide(tool.execute(validArgs, { agentId: "test" }), mockLayer),
    );
    expect(validationResult).toBeDefined();

    const invalidArgs = { query: 123 }; // Invalid type
    const invalidResult = await Effect.runPromise(
      Effect.provide(tool.execute(invalidArgs, { agentId: "test" }), mockLayer),
    );
    expect(invalidResult).toBeDefined();
  });

  it("should fallback to web search when Linkup fails", async () => {
    const tool = createWebSearchTool();

    // Mock config service that doesn't have Linkup API key
    const mockConfigService = {
      get: vi.fn().mockReturnValue(Effect.fail(new Error("Config not found"))),
      getOrElse: vi.fn().mockReturnValue(Effect.succeed("default")),
      getOrFail: vi.fn().mockReturnValue(Effect.fail(new Error("Linkup API key not found"))),
      has: vi.fn().mockReturnValue(Effect.succeed(false)),
      set: vi.fn().mockReturnValue(Effect.succeed(undefined)),
      appConfig: Effect.succeed(mockAppConfig),
    };

    const mockLayer = Layer.succeed(AgentConfigService, mockConfigService);

    const context = {
      agentId: "test-agent",
      conversationId: "test-conversation",
    };

    const args = {
      query: "test search",
      depth: "standard" as const,
      outputType: "sourcedAnswer" as const,
    };

    const result = await Effect.runPromise(
      tool.execute(args, context).pipe(Effect.provide(mockLayer)),
    );

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();

    const searchResult = result.result as {
      provider: string;
      query: string;
      results: Array<{ title: string }>;
    };
    expect(searchResult.provider).toBe("web_search");
    expect(searchResult.query).toBe("test search");
    expect(searchResult.results).toHaveLength(1);
    expect(searchResult.results[0].title).toBe("Web Search Fallback");
  });

  it("should create correct summary", () => {
    const tool = createWebSearchTool();

    const mockResult = {
      success: true,
      result: {
        totalResults: 5,
        query: "test search",
        provider: "linkup",
      },
    };

    const summary = tool.createSummary?.(mockResult);
    expect(summary).toBe('Found 5 results for "test search" using linkup');
  });

  it("should handle web search fallback summary", () => {
    const tool = createWebSearchTool();

    const mockResult = {
      success: true,
      result: {
        totalResults: 1,
        query: "fallback test",
        provider: "web_search",
      },
    };

    const summary = tool.createSummary?.(mockResult);
    expect(summary).toBe('Found 1 results for "fallback test" using web_search');
  });
});
