import { Effect, Layer } from "effect";
import { fetch } from "undici";
import {
  LLMAuthenticationError,
  LLMConfigurationError,
  LLMRequestError,
  LLMServiceTag,
  type ChatCompletionOptions,
  type ChatCompletionResponse,
  type LLMError,
  type LLMProvider,
  type LLMService,
} from "./types";

/**
 * LLM service implementation
 */

interface LLMConfig {
  defaultProvider: string;
  providers: Record<string, ProviderConfig>;
}

interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  supportedModels: string[];
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

class DefaultLLMService implements LLMService {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  getProvider(providerName: string): Effect.Effect<LLMProvider, LLMConfigurationError> {
    return Effect.try({
      try: () => {
        const providerConfig = this.config.providers[providerName];

        if (!providerConfig) {
          throw new LLMConfigurationError(providerName, `Provider not configured: ${providerName}`);
        }

        return {
          name: providerName,
          supportedModels: providerConfig.supportedModels,
          defaultModel: providerConfig.defaultModel,
          supportsToolCalling: providerConfig.supportsToolCalling,
          supportsStreaming: providerConfig.supportsStreaming,
          supportsVision: providerConfig.supportsVision,
          authenticate: () => this.authenticateProvider(providerName),
          createChatCompletion: options => this.createChatCompletion(providerName, options),
        };
      },
      catch: (error: unknown) =>
        new LLMConfigurationError(
          providerName,
          `Failed to get provider: ${error instanceof Error ? error.message : String(error)}`
        ),
    });
  }

  listProviders(): Effect.Effect<readonly string[], never> {
    return Effect.succeed(Object.keys(this.config.providers));
  }

  authenticateProvider(providerName: string): Effect.Effect<void, LLMAuthenticationError> {
    return Effect.try({
      try: () => {
        const providerConfig = this.config.providers[providerName];

        if (!providerConfig) {
          throw new LLMAuthenticationError(
            providerName,
            `Provider not configured: ${providerName}`
          );
        }

        if (!providerConfig.apiKey) {
          throw new LLMAuthenticationError(
            providerName,
            `API key not configured for provider: ${providerName}`
          );
        }

        // For now, just check if API key exists
        return undefined;
      },
      catch: (error: unknown) =>
        new LLMAuthenticationError(
          providerName,
          `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
        ),
    });
  }

  createChatCompletion(
    providerName: string,
    options: ChatCompletionOptions
  ): Effect.Effect<ChatCompletionResponse, LLMError> {
    return Effect.gen(
      function* (this: DefaultLLMService) {
        const providerConfig = yield* Effect.try({
          try: () => {
            const config = this.config.providers[providerName];
            if (!config) {
              throw new LLMConfigurationError(
                providerName,
                `Provider not configured: ${providerName}`
              );
            }
            return config;
          },
          catch: (error: unknown) =>
            new LLMConfigurationError(
              providerName,
              `Failed to get provider config: ${error instanceof Error ? error.message : String(error)}`
            ),
        });

        if (providerName === "openai") {
          return yield* openaiChatCompletion(options, providerConfig);
        }

        throw new LLMRequestError(providerName, `Provider ${providerName} is not yet implemented`);
      }.bind(this)
    );
  }
}

// Production implementation: OpenAI Chat Completions API
function openaiChatCompletion(
  options: ChatCompletionOptions,
  providerConfig: ProviderConfig
): Effect.Effect<ChatCompletionResponse, LLMError> {
  return Effect.tryPromise({
    try: async () => {
      const apiKey = providerConfig.apiKey || process.env["OPENAI_API_KEY"] || "";
      if (!apiKey) {
        throw new LLMAuthenticationError("openai", "OPENAI_API_KEY is not configured");
      }

      const url = (providerConfig.baseUrl || "https://api.openai.com/v1") + "/chat/completions";

      // Map our message format to OpenAI API format
      const messages = options.messages.map((m): Record<string, unknown> => {
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
            const raw = (m as { tool_calls?: unknown; }).tool_calls;
            if (Array.isArray(raw)) {
              const mapped: Array<{
                id: string;
                type: "function";
                function: { name: string; arguments: string; };
              }> = [];
              for (const t of raw) {
                if (
                  t &&
                  typeof t === "object" &&
                  typeof (t as Record<string, unknown>)["id"] === "string" &&
                  (t as Record<string, unknown>)["type"] === "function" &&
                  typeof (t as Record<string, unknown>)["function"] === "object"
                ) {
                  const fn = (t as Record<string, unknown>)["function"] as Record<string, unknown>;
                  if (typeof fn["name"] === "string" && typeof fn["arguments"] === "string") {
                    mapped.push({
                      id: String((t as Record<string, unknown>)["id"]),
                      type: "function",
                      function: { name: String(fn["name"]), arguments: String(fn["arguments"]) },
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
        // Fold unsupported roles into assistant
        return { role: "assistant", content: m.content } as const;
      });

      const body: Record<string, unknown> = {
        model: options.model || providerConfig.defaultModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      };

      if (options.tools && options.tools.length > 0) {
        body["tools"] = options.tools;
      }
      if (options.toolChoice) {
        body["tool_choice"] = options.toolChoice as unknown as Record<string, unknown>;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          throw new LLMAuthenticationError("openai", text);
        }
        if (res.status === 429) {
          throw new LLMRequestError("openai", `Rate limit: ${text}`);
        }
        throw new LLMRequestError("openai", `HTTP ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        id?: string;
        model?: string;
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string; };
            }>;
            function_call?: { name: string; arguments: string; };
          };
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; };
      };

      const first = data.choices && data.choices[0] ? data.choices[0] : undefined;
      const message = first?.message;

      const result: ChatCompletionResponse = {
        id: data.id ?? "",
        model: data.model ?? options.model,
        content: message?.content ?? "",
        ...(data.usage
          ? {
            usage: {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            },
          }
          : {}),
      };

      // Tool calls (new API)
      if (message?.tool_calls && Array.isArray(message.tool_calls)) {
        result.toolCalls = message.tool_calls.map(tc => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }));
      }
      // Legacy function_call
      if (!result.toolCalls && message?.function_call) {
        result.toolCalls = [
          {
            id: "call_1",
            type: "function",
            function: {
              name: message.function_call.name,
              arguments: message.function_call.arguments,
            },
          },
        ];
      }

      return result;
    },
    catch: (error: unknown) =>
      error instanceof LLMAuthenticationError || error instanceof LLMRequestError
        ? error
        : new LLMRequestError("openai", error instanceof Error ? error.message : String(error)),
  });
}

// Load configuration from environment variables
function loadLLMConfig(): Effect.Effect<LLMConfig, LLMConfigurationError> {
  return Effect.try({
    try: () => {
      const providers: Record<string, ProviderConfig> = {};

      if ((process.env["OPENAI_API_KEY"] || "") !== "") {
        providers["openai"] = {
          apiKey: process.env["OPENAI_API_KEY"] || "",
          defaultModel: "gpt-4o-mini",
          supportedModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
          supportsToolCalling: true,
          supportsStreaming: false,
          supportsVision: true,
        };
      }

      const providerNames = Object.keys(providers);
      if (providerNames.length === 0) {
        throw new LLMConfigurationError(
          "unknown",
          "No LLM providers configured. Please set OPENAI_API_KEY."
        );
      }

      const defaultProvider = providerNames[0] as string;

      return {
        defaultProvider,
        providers,
      };
    },
    catch: (error: unknown) =>
      new LLMConfigurationError(
        "unknown",
        `Failed to load LLM configuration: ${error instanceof Error ? error.message : String(error)}`
      ),
  });
}

// Create LLM service layer
export function createLLMServiceLayer(): Layer.Layer<LLMService, LLMConfigurationError> {
  return Layer.effect(
    LLMServiceTag,
    Effect.gen(function* () {
      const config = yield* loadLLMConfig();
      return new DefaultLLMService(config);
    })
  );
}
