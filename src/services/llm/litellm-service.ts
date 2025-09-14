import { Effect, Layer } from "effect";
import litellm from "litellm";
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
      openai: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
      anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
      google: ["gemini-pro", "gemini-1.5-pro"],
      mistral: ["mistral-small", "mistral-medium", "mistral-large"],
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
          supportsToolCalling: ["openai", "anthropic", "google"].includes(providerName),
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
                  error instanceof Error ? error.message : String(error)
                ),
            }),
          createChatCompletion: options => this.createChatCompletion(providerName, options),
        };

        return provider;
      },
      catch: (error: unknown) =>
        new LLMConfigurationError(
          providerName,
          `Failed to get provider: ${error instanceof Error ? error.message : String(error)}`
        ),
    });
  }

  listProviders(): Effect.Effect<readonly string[], never> {
    const configuredProviders = Object.keys(this.config.apiKeys);
    const intersect = configuredProviders.filter(p => this.providerModels[p]);
    return Effect.succeed(intersect);
  }

  createChatCompletion(
    providerName: string,
    options: ChatCompletionOptions
  ): Effect.Effect<ChatCompletionResponse, LLMError> {
    return Effect.tryPromise({
      try: async () => {
        if (options.stream === true) {
          throw new Error("Streaming responses are not supported yet");
        }
        // Format model name for LiteLLM (e.g., "openai/gpt-4")
        const formattedModel = `${providerName}/${options.model}`;

        // Convert our message format to LiteLLM-compatible messages
        const convertedMessages: ReadonlyArray<{
          role: "system" | "user" | "assistant";
          content: string | null;
        }> = options.messages.map(msg => {
          if (msg.role === "system" || msg.role === "user" || msg.role === "assistant") {
            return { role: msg.role, content: msg.content } as const;
          }
          // Fold unsupported roles (e.g., tool/function) into assistant content
          return { role: "assistant", content: msg.content } as const;
        });

        // Convert our options format to LiteLLM format (non-streaming)
        const liteLLMOptions = {
          model: formattedModel,
          messages: convertedMessages,
          temperature: options.temperature ?? null,
          max_tokens: options.maxTokens ?? null,
          // Explicitly set non-streaming to satisfy types
          stream: false as const,
        } as const;

        // Call LiteLLM (treat response as unknown and narrow safely)
        const responseUnknown: unknown = await litellm.completion(
          liteLLMOptions as unknown as Parameters<typeof litellm.completion>[0]
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
              function: { name: string; arguments: string; };
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

        // Handle different error types
        if (errorMessage.includes("authentication") || errorMessage.includes("api key")) {
          return new LLMAuthenticationError(providerName, errorMessage);
        } else if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
          return new LLMRateLimitError(providerName, errorMessage);
        } else {
          return new LLMRequestError(providerName, errorMessage || "Unknown LLM request error");
        }
      },
    });
  }
}

// Load configuration from environment variables
function loadLiteLLMConfig(): Effect.Effect<LiteLLMConfig, LLMConfigurationError> {
  return Effect.try({
    try: () => {
      const apiKeys: Record<string, string> = {};

      if ((process.env["OPENAI_API_KEY"] || "") !== "") {
        apiKeys["openai"] = process.env["OPENAI_API_KEY"] || "";
      }
      if ((process.env["ANTHROPIC_API_KEY"] || "") !== "") {
        apiKeys["anthropic"] = process.env["ANTHROPIC_API_KEY"] || "";
      }
      if ((process.env["GOOGLE_API_KEY"] || "") !== "") {
        apiKeys["google"] = process.env["GOOGLE_API_KEY"] || "";
      }
      if ((process.env["MISTRAL_API_KEY"] || "") !== "") {
        apiKeys["mistral"] = process.env["MISTRAL_API_KEY"] || "";
      }

      const providers = Object.keys(apiKeys);
      if (providers.length === 0) {
        throw new LLMConfigurationError(
          "unknown",
          "No API keys found. Please set environment variables (e.g., OPENAI_API_KEY)."
        );
      }

      const defaultProvider = providers[0] as string;

      return {
        defaultProvider,
        apiKeys,
      } satisfies LiteLLMConfig;
    },
    catch: (error: unknown) =>
      new LLMConfigurationError(
        "unknown",
        `Failed to load LLM configuration: ${error instanceof Error ? error.message : String(error)}`
      ),
  });
}

// Create LiteLLM service layer
export function createLiteLLMServiceLayer(): Layer.Layer<LLMService, LLMConfigurationError> {
  return Layer.effect(
    LLMServiceTag,
    Effect.gen(function* () {
      const config = yield* loadLiteLLMConfig();
      return new DefaultLiteLLMService(config);
    })
  );
}
