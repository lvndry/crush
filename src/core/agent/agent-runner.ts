import { Effect, Schedule } from "effect";
import { AgentConfigService, type ConfigService } from "../../services/config";
// Context management imports temporarily disabled
// import {
//   estimateConversationTokens,
//   getModelContextLimit,
//   shouldSummarize,
//   summarizeConversation,
// } from "../../services/llm/context-manager";
import {
  LLMRateLimitError,
  LLMServiceTag,
  type ChatMessage,
  type LLMService,
  type ToolCall,
} from "../../services/llm/types";
import { LoggerServiceTag, type LoggerService } from "../../services/logger";
import { type Agent } from "../types";
import { MarkdownRenderer } from "../utils/markdown-renderer";
import { agentPromptBuilder } from "./agent-prompt";
import {
  ToolRegistryTag,
  type ToolExecutionContext,
  type ToolRegistry,
} from "./tools/tool-registry";

/**
 * Agent runner for executing agent conversations
 */

// Context management function temporarily disabled - keeping code for later investigation
// /**
//  * Intelligently manage conversation context using token-based summarization
//  * Preserves important context while staying within token limits
//  */
// function manageContext(
//   messages: ChatMessage[],
//   model: string,
//   contextConfig?: {
//     summarizationThreshold?: number;
//     targetTokensRatio?: number;
//     enableProactiveSummarization?: boolean;
//     preserveRecentMessages?: number;
//     maxRecentTokens?: number;
//     summarizeToolResults?: boolean;
//   },
// ): ChatMessage[] {
//   // Skip if proactive summarization is disabled
//   if (contextConfig?.enableProactiveSummarization === false) {
//     return messages;
//   }
//
//   // Use configured threshold or default to 90% (more conservative to preserve tool results)
//   const threshold = contextConfig?.summarizationThreshold ?? 0.9;
//
//   // Check if we need to summarize based on token count
//   if (!shouldSummarize(messages, model, threshold)) {
//     return messages;
//   }
//
//   // Calculate target tokens using configured ratio or default to 80% (more conservative)
//   const maxTokens = getModelContextLimit(model);
//   const targetRatio = contextConfig?.targetTokensRatio ?? 0.8;
//   const targetTokens = Math.floor(maxTokens * targetRatio);
//
//   // Use the enhanced summarization with all new parameters
//   const summarizedMessages = summarizeConversation(
//     messages,
//     model,
//     targetTokens,
//     contextConfig?.maxRecentTokens ?? 8000, // Default to 8K tokens for recent context
//     contextConfig?.preserveRecentMessages ?? 10, // Default to 10 recent messages
//     contextConfig?.summarizeToolResults ?? false, // Default to not summarizing tool results
//   );
//
//   return summarizedMessages;
// }

export interface AgentRunnerOptions {
  readonly agent: Agent;
  readonly userInput: string;
  readonly conversationId?: string;
  readonly userId?: string;
  readonly maxIterations?: number;
  /**
   * Full conversation history to date, including prior assistant, user, and tool messages.
   * Use this to preserve context across turns (e.g., approval flows).
   */
  readonly conversationHistory?: ChatMessage[];
}

export interface AgentResponse {
  readonly content: string;
  readonly conversationId: string;
  readonly toolCalls?: ToolCall[];
  readonly toolResults?: Record<string, unknown>;
  /**
   * The full message list used for this turn, including system, user, assistant, and tool messages.
   * Pass this back on the next turn to retain context across approvals and multi-step tasks.
   */
  readonly messages?: ChatMessage[] | undefined;
}

export class AgentRunner {
  /**
   * Run an agent conversation
   */
  static run(
    options: AgentRunnerOptions,
  ): Effect.Effect<
    AgentResponse,
    Error,
    LLMService | ToolRegistry | LoggerService | ConfigService
  > {
    return Effect.gen(function* () {
      const { agent, userInput, conversationId, userId, maxIterations = 5 } = options;

      // Get services
      const llmService = yield* LLMServiceTag;
      const toolRegistry = yield* ToolRegistryTag;
      const configService = yield* AgentConfigService;
      const logger = yield* LoggerServiceTag;
      const appConfig = yield* configService.appConfig;

      // Generate a conversation ID if not provided
      const actualConversationId = conversationId || `conv-${Date.now()}`;

      // Use provided history if available to preserve context across turns
      const history: ChatMessage[] = options.conversationHistory || [];

      const agentType = agent.config.agentType;

      // Get available tools for this specific agent
      const allToolNames = yield* toolRegistry.listTools();
      const agentToolNames = agent.config.tools || [];

      // The approval system in base-tool.ts automatically handles execute-* tool mapping
      // No need for manual mapping here as the tool registry handles this internally
      const expandedToolNamesSet = new Set<string>(agentToolNames);
      const expandedToolNames = Array.from(expandedToolNamesSet);

      // Validate that all agent tools exist in the registry
      const invalidTools = agentToolNames.filter((toolName) => !allToolNames.includes(toolName));
      if (invalidTools.length > 0) {
        return yield* Effect.fail(
          new Error(`Agent ${agent.id} references non-existent tools: ${invalidTools.join(", ")}`),
        );
      }

      // Build messages for the agent with only its specified tools
      const messages = yield* agentPromptBuilder.buildAgentMessages(agentType, {
        agentName: agent.name,
        agentDescription: agent.description,
        userInput,
        conversationHistory: history,
        toolNames: agentToolNames,
      });

      // Get tool definitions for only the agent's specified tools
      const allTools = yield* toolRegistry.getToolDefinitions();
      const tools = allTools.filter((tool) => expandedToolNames.includes(tool.function.name));

      // Create execution context
      const context: ToolExecutionContext = {
        agentId: agent.id,
        conversationId: actualConversationId,
        ...(userId ? { userId } : {}),
      };

      // Run the agent loop
      const currentMessages = [...messages];
      let response: AgentResponse = {
        content: "",
        conversationId: actualConversationId,
      };

      // Determine the LLM provider and model to use
      const provider = agent.config.llmProvider;
      const model = agent.config.llmModel;

      for (let i = 0; i < maxIterations; i++) {
        // Context management temporarily disabled - keeping code for later investigation
        // const contextConfig = appConfig.llm?.contextManagement ?? undefined;
        // const managedMessages = manageContext(currentMessages, model, contextConfig);
        //
        // // Log context management if it occurred
        // if (managedMessages.length !== currentMessages.length) {
        //   yield* logger.info(
        //     `Context managed: ${currentMessages.length} → ${managedMessages.length} messages`,
        //     {
        //       agentId: agent.id,
        //       conversationId: actualConversationId,
        //       iteration: i + 1,
        //       model,
        //       originalTokens: estimateConversationTokens(currentMessages),
        //       managedTokens: estimateConversationTokens(managedMessages),
        //       threshold: contextConfig?.summarizationThreshold ?? 0.75,
        //     },
        //   );
        // }
        //
        // currentMessages.length = 0; // Clear array
        // currentMessages.push(...managedMessages);
        //
        // // Safety: if context management resulted in an empty message list, rebuild a minimal prompt
        // if (currentMessages.length === 0) {
        //   const minimalSystem = yield* agentPromptBuilder.buildSystemPrompt(agentType, {
        //     agentName: agent.name,
        //     agentDescription: agent.description,
        //     userInput,
        //     conversationHistory: history,
        //     toolNames: agentToolNames,
        //   });
        //   const minimalUser = yield* agentPromptBuilder.buildUserPrompt(agentType, {
        //     agentName: agent.name,
        //     agentDescription: agent.description,
        //     userInput,
        //     conversationHistory: history,
        //     toolNames: agentToolNames,
        //   });
        //
        //   currentMessages.push({ role: "system", content: minimalSystem });
        //   if (minimalUser && minimalUser.trim().length > 0) {
        //     currentMessages.push({ role: "user", content: minimalUser });
        //   }
        //
        //   yield* logger.warn(
        //     "Message list was empty after context management; rebuilt minimal prompt",
        //     {
        //       agentId: agent.id,
        //       conversationId: actualConversationId,
        //       iteration: i + 1,
        //     },
        //   );
        // }

        // Log user-friendly progress for info level
        if (i === 0) {
          const message = MarkdownRenderer.formatThinking(agent.name, true);
          yield* logger.info(message, {
            agentId: agent.id,
            conversationId: actualConversationId,
            iteration: i + 1,
          });
        } else {
          const message = MarkdownRenderer.formatThinking(agent.name, false);
          yield* logger.info(message, {
            agentId: agent.id,
            conversationId: actualConversationId,
            iteration: i + 1,
          });
        }

        // Log LLM request in debug mode
        if (appConfig.logging.level === "debug") {
          yield* logger.debug("LLM request", {
            agentId: agent.id,
            conversationId: actualConversationId,
            iteration: i + 1,
            provider,
            model,
            messageCount: currentMessages.length,
            messages: currentMessages,
            tools: tools.map((t) => ({
              name: t.function.name,
              description: t.function.description,
            })),
          });
        }

        // Call the LLM with retry logic for rate limit errors
        let messagesToSend = currentMessages;
        // Secondary safety: ensure messagesToSend is never empty
        if (messagesToSend.length === 0) {
          // Fallback to a single user message if everything else failed
          messagesToSend = [
            {
              role: "user",
              content: userInput && userInput.trim().length > 0 ? userInput : "Continue",
            },
          ];
          yield* logger.warn("messagesToSend was empty; using fallback single user message", {
            agentId: agent.id,
            conversationId: actualConversationId,
            iteration: i + 1,
          });
        }
        const maxRetries = 3;

        const completion = yield* Effect.retry(
          Effect.gen(function* () {
            const result = yield* llmService.createChatCompletion(provider, {
              model,
              messages: messagesToSend,
              tools,
              toolChoice: "auto",
            });
            return result;
          }),
          Schedule.exponential("1 second").pipe(
            Schedule.intersect(Schedule.recurs(maxRetries)),
            Schedule.whileInput((error) => error instanceof LLMRateLimitError),
          ),
        ).pipe(
          Effect.tapError((_error) =>
            Effect.gen(function* () {
              // const logger = yield* LoggerServiceTag;
              // Context management error handling temporarily disabled
              // if (error instanceof LLMRateLimitError) {
              //   // If this is a "request too large" error, try more aggressive context management
              //   if (
              //     error.message.includes("Request too large") ||
              //     error.message.includes("tokens per min")
              //   ) {
              //     // Use configured aggressive threshold or default to 40%
              //     const maxTokens = getModelContextLimit(model);
              //     const aggressiveRatio =
              //       appConfig.llm?.contextManagement?.aggressiveThreshold ?? 0.4;
              //     const aggressiveTargetTokens = Math.floor(maxTokens * aggressiveRatio);
              //     const contextConfig = appConfig.llm?.contextManagement;
              //     messagesToSend = summarizeConversation(
              //       messagesToSend,
              //       model,
              //       aggressiveTargetTokens,
              //       contextConfig?.maxRecentTokens,
              //       contextConfig?.preserveRecentMessages,
              //       contextConfig?.summarizeToolResults,
              //     );
              //
              //     yield* logger.warn(
              //       `Request too large, applying aggressive context management and retrying...`,
              //       {
              //         agentId: agent.id,
              //         conversationId: actualConversationId,
              //         iteration: i + 1,
              //         messageCount: messagesToSend.length,
              //         targetTokens: aggressiveTargetTokens,
              //         aggressiveRatio,
              //         error: error.message,
              //       },
              //     );
              //   } else {
              //     yield* logger.warn(`Rate limit hit, retrying...`, {
              //       agentId: agent.id,
              //       conversationId: actualConversationId,
              //       iteration: i + 1,
              //       error: error.message,
              //     });
              //   }
              // }
            }),
          ),
        );

        // Add the assistant's response to the conversation (including tool calls, if any)
        currentMessages.push({
          role: "assistant",
          content: completion.content,
          ...(completion.toolCalls
            ? {
                tool_calls: completion.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: tc.type,
                  function: { name: tc.function.name, arguments: tc.function.arguments },
                })),
              }
            : {}),
        });

        // Log assistant response if log level is debug
        if (appConfig.logging.level === "debug") {
          yield* logger.debug("LLM response received", {
            agentId: agent.id,
            conversationId: actualConversationId,
            iteration: i + 1,
            model: completion.model,
            content: completion.content,
            toolCalls: completion.toolCalls?.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })),
            usage: completion.usage,
          });
        }

        // Check if the model wants to call a tool
        if (completion.toolCalls && completion.toolCalls.length > 0) {
          const toolResults: Record<string, unknown> = {};

          // Log user-friendly tool execution info
          const toolNames = completion.toolCalls.map((tc) => tc.function.name);
          const message = MarkdownRenderer.formatToolExecution(agent.name, toolNames);
          yield* logger.info(message, {
            agentId: agent.id,
            conversationId: actualConversationId,
            toolCount: completion.toolCalls.length,
            tools: toolNames,
          });

          // Execute each tool call
          for (const toolCall of completion.toolCalls) {
            if (toolCall.type === "function") {
              const { name, arguments: argsString } = toolCall.function;

              try {
                // Parse the arguments safely
                const parsed = JSON.parse(argsString) as unknown;
                const args: Record<string, unknown> =
                  parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

                // Log tool call arguments in debug mode
                yield* logger.debug("Tool call arguments", {
                  agentId: agent.id,
                  conversationId: actualConversationId,
                  toolName: name,
                  toolCallId: toolCall.id,
                  arguments: args,
                  rawArguments: argsString,
                });

                // Execute the tool
                const result = yield* toolRegistry.executeTool(name, args, context);

                // Log tool execution result in debug mode
                yield* logger.debug("Tool execution result", {
                  agentId: agent.id,
                  conversationId: actualConversationId,
                  toolName: name,
                  toolCallId: toolCall.id,
                  arguments: args,
                  result: result.result,
                });

                // Add the tool result to the conversation
                currentMessages.push({
                  role: "tool",
                  name,
                  content: JSON.stringify(result.result),
                  tool_call_id: toolCall.id,
                });

                // Store the tool result
                toolResults[name] = result.result;
              } catch (error) {
                // If the tool does not exist, rethrow to fail fast (never mock missing tools)
                if (error instanceof Error && error.message.startsWith("Tool not found")) {
                  throw error;
                }

                // Otherwise, include the tool execution error in the conversation
                currentMessages.push({
                  role: "tool",
                  name,
                  content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                  tool_call_id: toolCall.id,
                });

                // Store the error
                toolResults[name] = {
                  error: `${error instanceof Error ? error.message : String(error)}`,
                };
              }
            }
          }

          // Update the response with tool results
          response = { ...response, toolCalls: completion.toolCalls, toolResults };

          // Continue the conversation with the tool results
          continue;
        }

        // No tool calls, we have the final response
        response = { ...response, content: completion.content };

        // Log completion
        const completionMessage = MarkdownRenderer.formatCompletion(agent.name);
        yield* logger.info(completionMessage, {
          agentId: agent.id,
          conversationId: actualConversationId,
          totalIterations: i + 1,
          hasContent: !!completion.content,
        });
        break;
      }

      if (response.content === "" && !response.toolCalls) {
        const warningMessage = MarkdownRenderer.formatWarning(
          agent.name,
          `reached maximum iterations (${maxIterations})`,
        );
        yield* logger.warn(warningMessage, {
          agentId: agent.id,
          conversationId: actualConversationId,
          maxIterations,
        });
      }

      // Optionally persist conversation history via a storage layer in the future

      // Return the full message history from this turn so callers can persist it
      return { ...response, messages: currentMessages };
    });
  }
}
