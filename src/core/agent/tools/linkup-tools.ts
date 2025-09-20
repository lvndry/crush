import { Effect } from "effect";
import {
  LinkupClient,
  type SearchDepth,
  type SearchOutputType,
  type SearchResults,
  type SourcedAnswer,
} from "linkup-sdk";
import { AgentConfigService, type ConfigService } from "../../../services/config";
import { defineTool, makeJsonSchemaValidator } from "./base-tool";
import { type ToolExecutionContext, type ToolExecutionResult } from "./tool-registry";

/**
 * Linkup search tool for web search functionality
 * Provides grounding data to enrich AI output and increase precision
 */

export interface LinkupSearchArgs extends Record<string, unknown> {
  readonly query: string;
  readonly depth?: SearchDepth;
  readonly outputType?: SearchOutputType;
  readonly includeImages?: boolean;
}

export interface LinkupSearchResult {
  readonly answer?: string;
  readonly results: readonly LinkupSearchItem[];
  readonly totalResults: number;
  readonly query: string;
  readonly timestamp: string;
}

export interface LinkupSearchItem {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly publishedDate?: string;
  readonly source?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface LinkupConfig {
  readonly apiKey: string;
}

/**
 * Create a Linkup search tool that performs web searches using the Linkup API
 *
 * @returns A tool that can search the web using Linkup's search engine
 */
export function createLinkupSearchTool(): ReturnType<
  typeof defineTool<ConfigService, LinkupSearchArgs>
> {
  return defineTool<ConfigService, LinkupSearchArgs>({
    name: "linkup_search",
    description:
      "Search the web using Linkup's search engine. Provides high-quality, factual search results to enrich AI responses with current information from the internet.",
    parameters: {
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
            "Search depth - 'standard' for quick results, 'deep' for comprehensive search (default: 'deep')",
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
    },
    validate: makeJsonSchemaValidator<LinkupSearchArgs>({
      type: "object",
      properties: {
        query: { type: "string" },
        depth: { type: "string", enum: ["standard", "deep"] },
        outputType: { type: "string", enum: ["sourcedAnswer", "searchResults", "structured"] },
        includeImages: { type: "boolean" },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    handler: function linkupSearchHandler(
      args: LinkupSearchArgs,
      _context: ToolExecutionContext,
    ): Effect.Effect<ToolExecutionResult, Error, ConfigService> {
      return Effect.gen(function* () {
        const config = yield* AgentConfigService;

        // Get Linkup configuration
        const linkupConfig = yield* getLinkupConfig(config);

        // Create Linkup client
        const client = new LinkupClient({
          apiKey: linkupConfig.apiKey,
        });

        // Prepare search parameters
        const searchParams = {
          query: args.query,
          depth: args.depth ?? "standard",
          outputType: args.outputType ?? "sourcedAnswer",
          includeImages: args.includeImages ?? false,
        };

        const searchResult = yield* performLinkupSearch(client, searchParams);

        if (searchResult.answer) {
          return {
            success: true,
            result: searchResult.answer,
          };
        }

        const trimmedResults = searchResult.results.slice(0, 5);

        return {
          success: true,
          result: trimmedResults,
        };
      }).pipe(
        Effect.catchAll((error) =>
          Effect.succeed({
            success: false,
            result: null,
            error: error.message,
          }),
        ),
      );
    },
    createSummary: function createSearchSummary(result: ToolExecutionResult): string | undefined {
      if (!result.success || !result.result) return undefined;

      const searchResult = result.result as LinkupSearchResult;
      return `Found ${searchResult.totalResults} results for "${searchResult.query}"`;
    },
  });
}

/**
 * Get Linkup configuration from the config service
 */
function getLinkupConfig(config: ConfigService): Effect.Effect<LinkupConfig, Error> {
  return Effect.gen(function* () {
    const apiKey = yield* config
      .getOrFail("linkup.apiKey")
      .pipe(
        Effect.catchAll(() =>
          Effect.fail(
            new Error(
              "Linkup API key is required. Please set linkup.apiKey in your configuration.",
            ),
          ),
        ),
      );

    if (!apiKey || typeof apiKey !== "string") {
      return yield* Effect.fail(
        new Error("Linkup API key is required. Please set linkup.apiKey in your configuration."),
      );
    }

    return {
      apiKey: apiKey,
    };
  });
}

function performLinkupSearch(
  client: LinkupClient,
  params: {
    query: string;
    depth: SearchDepth;
    outputType: SearchOutputType;
    includeImages: boolean;
  },
): Effect.Effect<LinkupSearchResult, Error> {
  return Effect.tryPromise({
    try: async () => {
      const response = await client.search({
        query: params.query,
        depth: params.depth,
        outputType: params.outputType,
        includeImages: params.includeImages,
      });

      let searchResult: LinkupSearchResult;

      if (params.outputType === "sourcedAnswer") {
        const sourcedAnswer = response as SourcedAnswer;
        searchResult = {
          answer: sourcedAnswer.answer,
          results: sourcedAnswer.sources.map((source) => {
            if ("snippet" in source) {
              return {
                title: source.name || "",
                url: source.url || "",
                snippet: source.snippet || "",
                source: source.name,
              };
            } else {
              return {
                title: source.name || "",
                url: source.url || "",
                snippet: source.type === "text" ? source.content : "",
                source: source.name,
              };
            }
          }),
          totalResults: sourcedAnswer.sources.length,
          query: params.query,
          timestamp: new Date().toISOString(),
        };
      } else if (params.outputType === "searchResults") {
        const searchResults = response as SearchResults;

        searchResult = {
          results: searchResults.results.map((result) => ({
            title: result.name || "",
            url: result.url || "",
            snippet: result.type === "text" ? result.content : "",
            source: result.name,
          })),
          totalResults: searchResults.results.length,
          query: params.query,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          results: [],
          totalResults: 0,
          query: params.query,
          timestamp: new Date().toISOString(),
        };
      }

      return searchResult;
    },
    catch: (error) =>
      new Error(`Linkup search failed: ${error instanceof Error ? error.message : String(error)}`),
  });
}
