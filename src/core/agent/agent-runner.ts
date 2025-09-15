import { Effect } from "effect";
import { AgentConfigService, type ConfigService } from "../../services/config";
import {
  LLMServiceTag,
  type ChatMessage,
  type LLMService,
  type ToolCall,
} from "../../services/llm/types";
import { LoggerServiceTag, type LoggerService } from "../../services/logger";
import { type Agent } from "../types";
import { agentPromptBuilder } from "./agent-prompt";
import {
  ToolRegistryTag,
  type ToolExecutionContext,
  type ToolRegistry,
} from "./tools/tool-registry";

/**
 * Agent runner for executing agent conversations
 */

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

      // Determine the agent type from the agent config
      const agentType = agent.config.agentType || "default";

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
        // Call the LLM
        const completion = yield* llmService.createChatCompletion(provider, {
          model,
          messages: currentMessages,
          tools,
          toolChoice: "auto",
        });

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
          yield* logger.debug("Assistant response received", {
            agentId: agent.id,
            conversationId: actualConversationId,
            iteration: i + 1,
            content: completion.content,
            toolCalls: completion.toolCalls?.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })),
          });
        }

        // Check if the model wants to call a tool
        if (completion.toolCalls && completion.toolCalls.length > 0) {
          const toolResults: Record<string, unknown> = {};

          // Execute each tool call
          for (const toolCall of completion.toolCalls) {
            if (toolCall.type === "function") {
              const { name, arguments: argsString } = toolCall.function;

              try {
                // Parse the arguments safely
                const parsed = JSON.parse(argsString) as unknown;
                const args: Record<string, unknown> =
                  parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

                // Execute the tool
                const result = yield* toolRegistry.executeTool(name, args, context);

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
        break;
      }

      // Optionally persist conversation history via a storage layer in the future

      // Return the full message history from this turn so callers can persist it
      return { ...response, messages: currentMessages };
    });
  }
}
