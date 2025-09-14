import { Effect } from "effect";
import {
  LLMServiceTag,
  type ChatMessage,
  type LLMService,
  type ToolCall,
  type ToolDefinition,
} from "../../services/llm/types";
import { type LoggerService } from "../../services/logger";
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
}

export interface AgentResponse {
  readonly content: string;
  readonly conversationId: string;
  readonly toolCalls?: ToolCall[];
  readonly toolResults?: Record<string, unknown>;
}

export class AgentRunner {
  /**
   * Run an agent conversation
   */
  static run(
    options: AgentRunnerOptions,
  ): Effect.Effect<AgentResponse, Error, LLMService | ToolRegistry | LoggerService> {
    return Effect.gen(function* () {
      const { agent, userInput, conversationId, userId, maxIterations = 5 } = options;

      // Get services
      const llmService = yield* LLMServiceTag;
      const toolRegistry = yield* ToolRegistryTag;

      // Generate a conversation ID if not provided
      const actualConversationId = conversationId || `conv-${Date.now()}`;

      // For now, start with empty history; persistence can be added via a dedicated service layer
      const history: ChatMessage[] = [];

      // Determine the agent type from the agent config
      const agentType = agent.config.agentType || "default";

      // Get available tools
      const toolNames = yield* toolRegistry.listTools();

      // Build messages for the agent
      const messages = yield* agentPromptBuilder.buildAgentMessages(agentType, {
        agentName: agent.name,
        agentDescription: agent.description,
        userInput,
        conversationHistory: history,
        toolNames: toolNames as string[],
      });

      // Get tool definitions
      const tools = yield* toolRegistry.getToolDefinitions();

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
      const provider = agent.config.llmProvider || "openai";
      const model = agent.config.llmModel || "gpt-4";

      for (let i = 0; i < maxIterations; i++) {
        // Call the LLM
        const completion = yield* llmService.createChatCompletion(provider, {
          model,
          messages: currentMessages,
          tools: tools as ToolDefinition[],
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

      return response;
    });
  }
}
