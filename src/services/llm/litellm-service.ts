import { Effect, Layer } from "effect";
import litellm from "litellm";
import { AgentConfigService, type ConfigService } from "../config";
import {
  LLMAuthenticationError,
  LLMConfigurationError,
  LLMRateLimitError,
  LLMRequestError,
  LLMServiceTag,
  type ChatCompletionOptions,
  type ChatCompletionResponse,
  type LLMError,
  type LLMProvider,
  type LLMService,
} from "./types";

/**
 * LiteLLM service implementation for provider-agnostic LLM access
 */

interface LiteLLMConfig {
  defaultProvider: string;
  apiKeys: Record<string, string>;
}

class DefaultLiteLLMService implements LLMService {
  private config: LiteLLMConfig;
  private providerModels: Record<string, string[]>;

  constructor(config: LiteLLMConfig) {
    this.config = config;

    // Set API keys in litellm
    Object.entries(this.config.apiKeys).forEach(([provider, apiKey]) => {
      // Set environment variables for litellm to use
      process.env[`${provider.toUpperCase()}_API_KEY`] = apiKey;
    });

    // Define supported models for each provider
    this.providerModels = {
      openai: ["gpt-5", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o3"],
      anthropic: [
        "claude-opus-4",
        "claude-sonnet-4",
        "claude-3-opus",
        "claude-3-sonnet",
        "claude-3-haiku",
      ],
      google: ["gemini-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
      mistral: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
      ollama: ["llama3", "llama2", "mistral"],
    };
  }

  getProvider(providerName: string): Effect.Effect<LLMProvider, LLMConfigurationError> {
    return Effect.try({
      try: () => {
        if (!this.providerModels[providerName]) {
          throw new LLMConfigurationError(providerName, `Provider not supported: ${providerName}`);
        }

        const provider: LLMProvider = {
          name: providerName,
          supportedModels: this.providerModels[providerName] || [],
          defaultModel: this.providerModels[providerName]?.[0] || "",
          supportsToolCalling: ["openai", "anthropic", "google", "mistral"].includes(providerName),
          supportsStreaming: false,
          supportsVision: ["openai", "anthropic", "google"].includes(providerName),
          authenticate: () =>
            Effect.try({
              try: () => {
                const apiKey = this.config.apiKeys[providerName];
                if (!apiKey) {
                  throw new LLMAuthenticationError(providerName, "API key not configured");
                }
              },
              catch: (error: unknown) =>
                new LLMAuthenticationError(
                  providerName,
                  error instanceof Error ? error.message : String(error),
                ),
            }),
          createChatCompletion: (options) => this.createChatCompletion(providerName, options),
        };

        return provider;
      },
      catch: (error: unknown) =>
        new LLMConfigurationError(
          providerName,
          `Failed to get provider: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });
  }

  listProviders(): Effect.Effect<readonly string[], never> {
    const configuredProviders = Object.keys(this.config.apiKeys);
    const intersect = configuredProviders.filter((p) => this.providerModels[p]);
    return Effect.succeed(intersect);
  }

  createChatCompletion(
    providerName: string,
    options: ChatCompletionOptions,
  ): Effect.Effect<ChatCompletionResponse, LLMError> {
    return Effect.tryPromise({
      try: async () => {
        if (options.stream === true) {
          throw new Error("Streaming responses are not supported yet");
        }

        // Format model id: omit provider for OpenAI; use "provider/model" for others
        const formattedModel =
          providerName.toLowerCase() === "openai"
            ? options.model.replace(/^openai\//i, "")
            : options.model.includes("/")
              ? options.model
              : `${providerName}/${options.model}`;

        // Convert our message format to LiteLLM/OpenAI-compatible messages, including tools
        const convertedMessages: ReadonlyArray<Record<string, unknown>> = options.messages.map(
          (m) => {
            if (
              m.role === "system" ||
              m.role === "user" ||
              m.role === "assistant" ||
              m.role === "tool"
            ) {
              const msg: Record<string, unknown> = { role: m.role, content: m.content };
              if (m.name) msg["name"] = m.name;
              // Attach tool_calls to assistant messages when present
              if (m.role === "assistant") {
                const raw = (m as { tool_calls?: unknown }).tool_calls;
                if (Array.isArray(raw)) {
                  const mapped: Array<{
                    id: string;
                    type: "function";
                    function: { name: string; arguments: string };
                  }> = [];
                  for (const t of raw) {
                    if (
                      t &&
                      typeof t === "object" &&
                      typeof (t as Record<string, unknown>)["id"] === "string" &&
                      (t as Record<string, unknown>)["type"] === "function" &&
                      typeof (t as Record<string, unknown>)["function"] === "object"
                    ) {
                      const fn = (t as Record<string, unknown>)["function"] as Record<
                        string,
                        unknown
                      >;
                      if (typeof fn["name"] === "string" && typeof fn["arguments"] === "string") {
                        mapped.push({
                          id: String((t as Record<string, unknown>)["id"]),
                          type: "function",
                          function: {
                            name: String(fn["name"]),
                            arguments: String(fn["arguments"]),
                          },
                        });
                      }
                    }
                  }
                  if (mapped.length > 0) {
                    msg["tool_calls"] = mapped;
                  }
                }
              }
              // Attach tool_call_id to tool messages when present
              if (m.role === "tool" && m.tool_call_id) {
                msg["tool_call_id"] = m.tool_call_id;
              }
              return msg;
            }
            // Fold unsupported roles (e.g., function) into assistant content
            return { role: "assistant", content: m.content } as const;
          },
        );

        // Convert our options format to LiteLLM/OpenAI format (non-streaming)
        const liteLLMOptions: Record<string, unknown> = {
          model: formattedModel,
          messages: convertedMessages,
          temperature: options.temperature ?? null,
          max_tokens: options.maxTokens ?? null,
          // Explicitly set non-streaming to satisfy types
          stream: false as const,
        };

        if (options.tools && options.tools.length > 0) {
          liteLLMOptions["tools"] = options.tools;
        }
        if (options.toolChoice) {
          liteLLMOptions["tool_choice"] = options.toolChoice as unknown as Record<string, unknown>;
        }

        // Call LiteLLM (treat response as unknown and narrow safely)
        const responseUnknown: unknown = await litellm.completion(
          liteLLMOptions as unknown as Parameters<typeof litellm.completion>[0],
        );

        function isRecord(value: unknown): value is Record<string, unknown> {
          return typeof value === "object" && value !== null;
        }

        let model = formattedModel;
        let content = "";
        let toolCalls: ChatCompletionResponse["toolCalls"] | undefined = undefined;
        let usage: ChatCompletionResponse["usage"] | undefined = undefined;

        if (isRecord(responseUnknown)) {
          if (typeof responseUnknown["model"] === "string") {
            model = responseUnknown["model"];
          }

          const choices = Array.isArray(responseUnknown["choices"])
            ? (responseUnknown["choices"] as unknown[])
            : [];
          const firstChoice = choices.length > 0 && isRecord(choices[0]) ? choices[0] : undefined;
          const message =
            firstChoice && isRecord(firstChoice["message"]) ? firstChoice["message"] : undefined;

          if (message && typeof message["content"] === "string") {
            content = message["content"];
          }

          // tool_calls array (new API)
          const tc =
            message && Array.isArray(message["tool_calls"])
              ? (message["tool_calls"] as unknown[])
              : undefined;
          if (tc && tc.length > 0) {
            const mapped: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }> = [];
            for (const t of tc) {
              if (isRecord(t) && typeof t["id"] === "string" && isRecord(t["function"])) {
                const fn = t["function"];
                if (typeof fn["name"] === "string" && typeof fn["arguments"] === "string") {
                  mapped.push({
                    id: t["id"],
                    type: "function",
                    function: { name: fn["name"], arguments: fn["arguments"] },
                  });
                }
              }
            }
            if (mapped.length > 0) {
              toolCalls = mapped;
            }
          }

          // function_call (legacy OpenAI)
          const fc =
            message && isRecord(message["function_call"]) ? message["function_call"] : undefined;
          if (
            !toolCalls &&
            fc &&
            typeof fc["name"] === "string" &&
            typeof fc["arguments"] === "string"
          ) {
            toolCalls = [
              {
                id: "call_1",
                type: "function",
                function: { name: fc["name"], arguments: fc["arguments"] },
              },
            ];
          }

          const u = isRecord(responseUnknown["usage"]) ? responseUnknown["usage"] : undefined;
          if (
            u &&
            typeof u["prompt_tokens"] === "number" &&
            typeof u["completion_tokens"] === "number" &&
            typeof u["total_tokens"] === "number"
          ) {
            usage = {
              promptTokens: u["prompt_tokens"],
              completionTokens: u["completion_tokens"],
              totalTokens: u["total_tokens"],
            };
          }
        }

        const result: ChatCompletionResponse = {
          id: "",
          model,
          content,
          ...(toolCalls ? { toolCalls } : {}),
          ...(usage ? { usage } : {}),
        };

        return result;
      },
      catch: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for HTTP status codes in the error
        let httpStatus: number | undefined;

        // Try to extract HTTP status from error message or error object
        if (error instanceof Error) {
          // Check if error has status property (common in HTTP libraries)
          const errorWithStatus = error as Error & { status?: number; statusCode?: number };
          httpStatus = errorWithStatus.status || errorWithStatus.statusCode;

          // Fallback: try to extract from message
          if (!httpStatus) {
            const statusMatch = errorMessage.match(/(\d{3})\s/);
            if (statusMatch && statusMatch[1]) {
              httpStatus = parseInt(statusMatch[1], 10);
            }
          }
        }

        // Handle different error types based on HTTP status codes
        if (httpStatus === 401 || httpStatus === 403) {
          return new LLMAuthenticationError(providerName, errorMessage);
        } else if (httpStatus === 429) {
          return new LLMRateLimitError(providerName, errorMessage);
        } else if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
          return new LLMRequestError(providerName, errorMessage);
        } else if (httpStatus && httpStatus >= 500) {
          return new LLMRequestError(providerName, `Server error (${httpStatus}): ${errorMessage}`);
        } else {
          // Fallback to message-based detection for non-HTTP errors
          if (errorMessage.includes("authentication") || errorMessage.includes("api key")) {
            return new LLMAuthenticationError(providerName, errorMessage);
          } else {
            return new LLMRequestError(providerName, errorMessage || "Unknown LLM request error");
          }
        }
      },
    });
  }
}

// Create LiteLLM service layer
export function createLiteLLMServiceLayer(): Layer.Layer<
  LLMService,
  LLMConfigurationError,
  ConfigService
> {
  return Layer.effect(
    LLMServiceTag,
    Effect.gen(function* () {
      const configService = yield* AgentConfigService;
      const appConfig = yield* configService.appConfig;

      const apiKeys: Record<string, string> = {};

      const openAIAPIKey = appConfig.llm?.openai?.api_key;
      if (openAIAPIKey) apiKeys["openai"] = openAIAPIKey;

      const anthropicAPIKey = appConfig.llm?.anthropic?.api_key;
      if (anthropicAPIKey) apiKeys["anthropic"] = anthropicAPIKey;

      const googleAPIKey = appConfig.llm?.google?.api_key;
      if (googleAPIKey) apiKeys["google"] = googleAPIKey;

      const mistralAPIKey = appConfig.llm?.mistral?.api_key;
      if (mistralAPIKey) apiKeys["mistral"] = mistralAPIKey;

      const providers = Object.keys(apiKeys);
      if (providers.length === 0) {
        return yield* Effect.fail(
          new LLMConfigurationError(
            "unknown",
            "No LLM API keys configured. Set config.llm.<provider>.api_key or env (e.g., OPENAI_API_KEY).",
          ),
        );
      }

      const defaultProvider = appConfig.llm?.defaultProvider || (providers[0] as string);

      const liteConfig: LiteLLMConfig = { defaultProvider, apiKeys };
      return new DefaultLiteLLMService(liteConfig);
    }),
  );
}
