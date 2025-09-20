import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { Effect, Layer } from "effect";
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
(globalThis as any).LinkupClient = mockLinkupClient;

describe("WebSearchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a web search tool with correct properties", () => {
    const tool = createWebSearchTool();

    expect(tool.name).toBe("web_search");
    expect(tool.description).toContain("Search the web for current information");
    expect(tool.description).toContain("Linkup search engine by default");
    expect(tool.description).toContain("automatic fallback to web search options");
  });

  it("should have correct parameter schema", () => {
    const tool = createWebSearchTool();

    expect(tool.parameters).toEqual({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to execute. Be specific and detailed for better results.",
        },
        depth: {
          type: "string",
          enum: ["standard", "deep"],
          description:
            "Search depth - 'standard' for quick results, 'deep' for comprehensive search (default: 'standard')",
        },
        outputType: {
          type: "string",
          enum: ["sourcedAnswer", "searchResults", "structured"],
          description:
            "Output format - 'sourcedAnswer' for AI-friendly format, 'searchResults' for raw results, 'structured' for structured data (default: 'sourcedAnswer')",
        },
        includeImages: {
          type: "boolean",
          description: "Whether to include images in search results (default: false)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    });
  });

  it("should validate arguments correctly", () => {
    const tool = createWebSearchTool();

    const validArgs = { query: "test search", depth: "standard", outputType: "sourcedAnswer" };
    const validationResult = tool.execute(validArgs, { agentId: "test" });
    expect(validationResult).toBeDefined();

    const invalidArgs = { query: 123 }; // Invalid type
    const invalidResult = tool.execute(invalidArgs, { agentId: "test" });
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
      appConfig: Effect.succeed({} as any),
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

    const searchResult = result.result as any;
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
