import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { Effect, Layer } from "effect";
import { AgentConfigService } from "../../../services/config";
import { createLinkupSearchTool } from "./linkup-tools";

// Mock fetch globally (Bun's fetch has a `preconnect` static)
export const mockFetch = mock();
(globalThis as any).fetch = mockFetch;

describe("Linkup Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLinkupSearchTool", () => {
    it("should create a tool with correct name and description", () => {
      const tool = createLinkupSearchTool();

      expect(tool.name).toBe("linkup_search");
      expect(tool.description).toContain("Search the web using Linkup's search engine");
      expect(tool.hidden).toBe(false);
    });

    it("should have correct parameters schema", () => {
      const tool = createLinkupSearchTool();

      expect(tool.parameters).toEqual({
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query to execute. Be specific and detailed for better results.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (default: 5, max: 20)",
            minimum: 1,
            maximum: 20,
          },
          includeMetadata: {
            type: "boolean",
            description: "Whether to include additional metadata in results (default: false)",
          },
        },
        required: ["query"],
        additionalProperties: false,
      });
    });

    it("should validate arguments correctly", () => {
      const tool = createLinkupSearchTool();

      // Test valid arguments
      const validArgs = { query: "test search" };
      const result = tool.execute(validArgs, { agentId: "test-agent" });

      // The result should be an Effect that requires AgentConfigService
      expect(result).toBeDefined();
    });

    it("should create summary correctly", () => {
      const tool = createLinkupSearchTool();

      const mockResult = {
        success: true,
        result: {
          results: [],
          totalResults: 5,
          query: "test search",
          timestamp: "2024-01-01T00:00:00Z",
        },
      };

      const summary = tool.createSummary?.(mockResult);
      expect(summary).toBe('Found 5 results for "test search"');
    });

    it("should handle missing API key gracefully", async () => {
      const tool = createLinkupSearchTool();

      const mockConfig = {
        get: vi.fn().mockReturnValue(Effect.succeed("default")),
        getOrFail: vi.fn().mockImplementation((key: string) => {
          if (key === "linkup.apiKey") {
            return Effect.fail(
              new Error(
                "Linkup API key is required. Please set linkup.apiKey in your configuration.",
              ),
            );
          }
          return Effect.succeed("default");
        }),
        getOrElse: vi.fn().mockReturnValue(Effect.succeed("default")),
        has: vi.fn().mockReturnValue(Effect.succeed(true)),
        set: vi.fn().mockReturnValue(Effect.void),
        appConfig: Effect.succeed({} as any),
      };

      const configLayer = Layer.succeed(AgentConfigService, mockConfig);

      const program = Effect.gen(function* () {
        const result = yield* tool.execute({ query: "test" }, { agentId: "test-agent" });
        return result;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(configLayer)));

      expect(result.success).toBe(false);
      expect(result.error).toContain("API key");
    });

    it("should make API request with correct parameters", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            {
              title: "Test Result",
              url: "https://example.com",
              snippet: "Test snippet",
              published_date: "2024-01-01",
              source: "example.com",
            },
          ],
          total_results: 1,
        }),
      };

      ((globalThis as any).fetch as any).mockResolvedValue(mockResponse);

      const mockConfig = {
        get: vi.fn().mockReturnValue(Effect.succeed("default")),
        getOrFail: vi.fn().mockReturnValue(Effect.succeed("test-api-key")),
        getOrElse: vi.fn().mockImplementation((key: string, defaultValue: any) => {
          if (key === "linkup.baseUrl") return Effect.succeed("https://api.linkup.so");
          if (key === "linkup.timeout") return Effect.succeed(30000);
          return Effect.succeed(defaultValue);
        }),
        has: vi.fn().mockReturnValue(Effect.succeed(true)),
        set: vi.fn().mockReturnValue(Effect.void),
        appConfig: Effect.succeed({} as any),
      };

      const configLayer = Layer.succeed(AgentConfigService, mockConfig);
      const tool = createLinkupSearchTool();

      const program = Effect.gen(function* () {
        const result = yield* tool.execute(
          { query: "test search", maxResults: 3 },
          { agentId: "test-agent" },
        );
        return result;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(configLayer)));

      expect(result.success).toBe(true);
      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        "https://api.linkup.so/search",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
          body: JSON.stringify({
            query: "test search",
            max_results: 3,
            include_metadata: false,
          }),
        }),
      );
    });
  });
});
