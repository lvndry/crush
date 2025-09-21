import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { mistral } from "@ai-sdk/mistral";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import {
  generateText,
  stepCountIs,
  tool,
  type AssistantModelMessage,
  type LanguageModel,
  type ModelMessage,
  type SystemModelMessage,
  type ToolModelMessage,
  type ToolSet,
  type TypedToolCall,
  type UserModelMessage,
} from "ai";
import { Effect, Layer } from "effect";
import { z } from "zod";
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
  type ModelInfo,
} from "./types";

interface AISDKConfig {
  apiKeys: Record<string, string>;
}

function safeParseJson(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function toCoreMessages(
  messages: ReadonlyArray<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: ReadonlyArray<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  }>,
): ModelMessage[] {
  return messages.map((m) => {
    const role = m.role;

    if (role === "system") {
      return {
        role: "system",
        content: m.content,
      } as SystemModelMessage;
    }

    // User messages - simple string content
    if (role === "user") {
      return {
        role: "user",
        content: m.content,
      } as UserModelMessage;
    }

    // Assistant messages (may include tool calls)
    if (role === "assistant") {
      const contentParts: Array<
        | { type: "text"; text: string }
        | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
      > = [];

      if (m.content && m.content.length > 0) {
        contentParts.push({ type: "text", text: m.content });
      }

      if (m.tool_calls && m.tool_calls.length > 0) {
        for (const tc of m.tool_calls) {
          contentParts.push({
            type: "tool-call",
            toolCallId: tc.id,
            toolName: tc.function.name,
            input: safeParseJson(tc.function.arguments),
          });
        }
      }

      // If we have content parts, return them as an array, otherwise return as string
      if (contentParts.length > 0) {
        return { role: "assistant", content: contentParts } as AssistantModelMessage;
      } else {
        return { role: "assistant", content: "" } as AssistantModelMessage;
      }
    }

    // Tool messages (tool results)
    if (role === "tool") {
      const contentParts: ToolModelMessage["content"] = [];

      contentParts.push({
        type: "tool-result",
        toolCallId: m.tool_call_id ?? "",
        toolName: m.name ?? "tool",
        output: { type: "text", value: m.content },
      });

      return { role: "tool", content: contentParts } as ToolModelMessage;
    }

    // Fallback - should not reach here
    throw new Error(`Unsupported message role: ${String(role)}`);
  });
}

type ModelName = string;

function selectModel(providerName: string, modelId: ModelName): LanguageModel {
  switch (providerName.toLowerCase()) {
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
    case "gemini":
    case "google":
      return google(modelId);
    case "mistral":
      return mistral(modelId);
    case "xai":
      return xai(modelId);
    default:
      return openai(modelId);
  }
}

class DefaultAISDKService implements LLMService {
  private config: AISDKConfig;
  private providerModels: Record<string, ModelInfo[]>;

  constructor(config: AISDKConfig) {
    this.config = config;

    // Export API keys to env for providers that read from env
    Object.entries(this.config.apiKeys).forEach(([provider, apiKey]) => {
      process.env[`${provider.toUpperCase()}_API_KEY`] = apiKey;
    });

    this.providerModels = {
      openai: [
        { id: "gpt-5", displayName: "GPT-5", isReasoningModel: true },
        { id: "gpt-5-mini", displayName: "GPT-5 Mini", isReasoningModel: true },
        { id: "gpt-5-nano", displayName: "GPT-5 Nano", isReasoningModel: true },
        { id: "gpt-4.1", displayName: "GPT-4.1", isReasoningModel: true },
        { id: "gpt-4.1-mini", displayName: "GPT-4.1 Mini", isReasoningModel: true },
        { id: "gpt-4.1-nano", displayName: "GPT-4.1 Nano", isReasoningModel: true },
        { id: "gpt-4o", displayName: "GPT-4o", isReasoningModel: false },
        { id: "gpt-4o-mini", displayName: "GPT-4o Mini", isReasoningModel: false },
        { id: "o4-mini", displayName: "o4-mini", isReasoningModel: true },
      ],
      anthropic: [
        { id: "claude-opus-4", displayName: "Claude Opus 4", isReasoningModel: true },
        { id: "claude-sonnet-4", displayName: "Claude Sonnet 4", isReasoningModel: true },
        { id: "claude-3.7", displayName: "Claude 3.7", isReasoningModel: true },
        { id: "claude-3-sonnet", displayName: "Claude 3 Sonnet", isReasoningModel: false },
        { id: "claude-3-opus", displayName: "Claude 3 Opus", isReasoningModel: false },
        { id: "claude-3-haiku", displayName: "Claude 3 Haiku", isReasoningModel: false },
      ],
      gemini: [
        { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", isReasoningModel: true },
        { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", isReasoningModel: true },
        {
          id: "gemini-2.5-flash-lite",
          displayName: "Gemini 2.5 Flash Lite",
          isReasoningModel: true,
        },
        { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", isReasoningModel: false },
      ],
      mistral: [
        { id: "mistral-small-latest", displayName: "Mistral Small", isReasoningModel: false },
        { id: "mistral-medium-latest", displayName: "Mistral Medium", isReasoningModel: false },
        { id: "mistral-large-latest", displayName: "Mistral Large", isReasoningModel: false },
        { id: "magistral-small-2506", displayName: "Magistral Small", isReasoningModel: true },
        { id: "magistral-medium-2506", displayName: "Magistral Medium", isReasoningModel: true },
      ],
      custom: [
        { id: "llama4", displayName: "Llama 4", isReasoningModel: false },
        { id: "llama3", displayName: "Llama 3", isReasoningModel: false },
        { id: "qwq", displayName: "QWQ", isReasoningModel: false },
        { id: "deepseek-r1", displayName: "DeepSeek R1", isReasoningModel: true },
        { id: "mistral", displayName: "Mistral", isReasoningModel: false },
      ],
      xai: [
        { id: "grok-4-0709", displayName: "Grok 4", isReasoningModel: true },
        { id: "grok-3", displayName: "Grok 3", isReasoningModel: true },
        { id: "grok-3-mini", displayName: "Grok 3 Mini", isReasoningModel: true },
      ],
    };
  }

  getProvider(
    providerName: keyof typeof this.providerModels,
  ): Effect.Effect<LLMProvider, LLMConfigurationError> {
    return Effect.try({
      try: () => {
        if (!this.providerModels[providerName]) {
          throw new LLMConfigurationError(providerName, `Provider not supported: ${providerName}`);
        }

        const provider: LLMProvider = {
          name: providerName,
          supportedModels: this.providerModels[providerName],
          defaultModel: this.providerModels[providerName][0]?.id ?? "",
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

        const model = selectModel(providerName, options.model);

        // Prepare tools for AI SDK if present
        let tools: ToolSet | undefined;
        if (options.tools && options.tools.length > 0) {
          tools = {};

          for (const toolDef of options.tools) {
            tools[toolDef.function.name] = tool({
              description: toolDef.function.description,
              inputSchema: toolDef.function.parameters as unknown as z.ZodTypeAny,
            });
          }
        }

        const result = await generateText({
          model,
          messages: toCoreMessages(options.messages),
          ...(typeof options.temperature === "number" ? { temperature: options.temperature } : {}),
          ...(tools ? { tools } : {}),
          stopWhen: stepCountIs(8),
        });

        let responseModel = options.model;
        let content = "";
        let toolCalls: ChatCompletionResponse["toolCalls"] | undefined = undefined;
        let usage: ChatCompletionResponse["usage"] | undefined = undefined;

        // Extract text content
        content = result.text ?? "";

        // Extract model ID from result (fallback to options.model if not available)
        responseModel = options.model; // AI SDK doesn't expose modelId in result

        // Extract usage information
        if (result.usage) {
          const usageData = result.usage;
          usage = {
            promptTokens: usageData.inputTokens ?? 0,
            completionTokens: usageData.outputTokens ?? 0,
            totalTokens: usageData.totalTokens ?? 0,
          };
        }

        // Extract tool calls if present
        if (result.toolCalls && result.toolCalls.length > 0) {
          toolCalls = result.toolCalls.map((tc: TypedToolCall<ToolSet>) => {
            // Handle both static and dynamic tool calls
            if ("dynamic" in tc && tc.dynamic) {
              // Dynamic tool call
              return {
                id: tc.toolCallId,
                type: "function" as const,
                function: {
                  name: tc.toolName,
                  arguments: JSON.stringify(tc.input ?? {}),
                },
              };
            } else {
              // Static tool call
              return {
                id: tc.toolCallId,
                type: "function" as const,
                function: {
                  name: tc.toolName,
                  arguments: JSON.stringify(tc.input ?? {}),
                },
              };
            }
          });
        }

        const resultObj: ChatCompletionResponse = {
          id: "",
          model: responseModel,
          content,
          ...(toolCalls ? { toolCalls } : {}),
          ...(usage ? { usage } : {}),
        };
        return resultObj;
      },
      catch: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let httpStatus: number | undefined;

        if (error instanceof Error) {
          const e = error as Error & { status?: number; statusCode?: number };
          httpStatus = e.status || e.statusCode;
          if (!httpStatus) {
            const m = errorMessage.match(/(\d{3})\s/);
            if (m && m[1]) httpStatus = parseInt(m[1], 10);
          }
        }

        if (httpStatus === 401 || httpStatus === 403) {
          return new LLMAuthenticationError(providerName, errorMessage);
        } else if (httpStatus === 429) {
          return new LLMRateLimitError(providerName, errorMessage);
        } else if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
          return new LLMRequestError(providerName, errorMessage);
        } else if (httpStatus && httpStatus >= 500) {
          return new LLMRequestError(providerName, `Server error (${httpStatus}): ${errorMessage}`);
        } else {
          if (
            errorMessage.toLowerCase().includes("authentication") ||
            errorMessage.toLowerCase().includes("api key")
          ) {
            return new LLMAuthenticationError(providerName, errorMessage);
          } else {
            return new LLMRequestError(providerName, errorMessage || "Unknown LLM request error");
          }
        }
      },
    });
  }
}

export function createAISDKServiceLayer(): Layer.Layer<
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

      const geminiAPIKey = appConfig.llm?.gemini?.api_key;
      if (geminiAPIKey) apiKeys["gemini"] = geminiAPIKey;

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

      const cfg: AISDKConfig = { apiKeys };
      return new DefaultAISDKService(cfg);
    }),
  );
}
