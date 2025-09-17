import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import inquirer from "inquirer";
import { agentPromptBuilder } from "../../core/agent/agent-prompt";
import { AgentRunner, type AgentRunnerOptions } from "../../core/agent/agent-runner";
import { AgentServiceTag, type AgentService } from "../../core/agent/agent-service";
import type { ToolRegistry } from "../../core/agent/tools/tool-registry";
import { ToolRegistryTag } from "../../core/agent/tools/tool-registry";
import {
  AgentAlreadyExistsError,
  AgentConfigurationError,
  StorageError,
  StorageNotFoundError,
  ValidationError,
} from "../../core/types/errors";
import type { Agent, AgentConfig } from "../../core/types/index";
import type { ConfigService } from "../../services/config";
import type { ChatMessage } from "../../services/llm/types";
import {
  LLMConfigurationError,
  LLMRateLimitError,
  LLMRequestError,
  LLMServiceTag,
  type LLMService,
} from "../../services/llm/types";
import { LoggerServiceTag, type LoggerService } from "../../services/logger";
import { FileSystemContextServiceTag, type FileSystemContextService } from "../../services/shell";

/**
 * CLI commands for AI agent management
 */

interface AIAgentCreationAnswers {
  name: string;
  description: string;
  agentType: string;
  llmProvider: string;
  llmModel: string;
  tools: string[];
}

/**
 * Interactive AI agent creation command
 */
export function createAIAgentCommand(): Effect.Effect<
  void,
  | StorageError
  | AgentAlreadyExistsError
  | AgentConfigurationError
  | ValidationError
  | LLMConfigurationError,
  AgentService | LLMService | ToolRegistry
> {
  return Effect.gen(function* () {
    console.log("🤖 Welcome to the Crush AI Agent Creation Wizard!");
    console.log("Let's create a new AI agent step by step.\n");

    // Get available LLM providers and models
    const llmService = yield* LLMServiceTag;
    const providers = yield* llmService.listProviders();

    if (providers.length === 0) {
      return yield* Effect.fail(
        new LLMConfigurationError(
          "no_providers",
          "No LLM providers configured. Set an API key for at least one provider in the config.",
        ),
      );
    }

    // Get available agent types
    const agentTypes = yield* agentPromptBuilder.listTemplates();

    // Get available tools
    const toolRegistry = yield* ToolRegistryTag;
    const tools = yield* toolRegistry.listTools();

    // Determine provider-aware default model
    const defaultProvider = providers[0] || "openai";
    const providerInfo = yield* llmService.getProvider(defaultProvider);
    const defaultModel =
      providerInfo.defaultModel || providerInfo.supportedModels[0] || "gpt-4o-mini";

    // Get agent basic information
    const agentAnswers = yield* Effect.promise(() =>
      promptForAgentInfo(providers, agentTypes, tools, defaultProvider, defaultModel),
    );

    // Validate the chosen model against the chosen provider
    const chosenProvider = yield* llmService.getProvider(agentAnswers.llmProvider);
    const selectedModel = chosenProvider.supportedModels.includes(agentAnswers.llmModel)
      ? agentAnswers.llmModel
      : chosenProvider.defaultModel || chosenProvider.supportedModels[0] || "gpt-4o-mini";

    // Build agent configuration
    const config: AgentConfig = {
      tasks: [],
      agentType: agentAnswers.agentType,
      llmProvider: agentAnswers.llmProvider,
      llmModel: selectedModel,
      tools: agentAnswers.tools,
      environment: {},
    };

    const agentService = yield* AgentServiceTag;
    const agent = yield* agentService.createAgent(
      agentAnswers.name,
      agentAnswers.description,
      config,
    );

    // Display success message
    console.log("\n✅ AI Agent created successfully!");
    console.log(`   ID: ${agent.id}`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Description: ${agent.description}`);
    console.log(`   Type: ${config.agentType}`);
    console.log(`   LLM Provider: ${config.llmProvider}`);
    console.log(`   LLM Model: ${config.llmModel}`);
    console.log(`   Tools: ${config.tools?.join(", ") || "None"}`);
    console.log(`   Status: ${agent.status}`);
    console.log(`   Created: ${agent.createdAt.toISOString()}`);

    console.log("\nYou can now chat with your agent using:");
    console.log(`crush agent chat ${agent.id}`);
  });
}

/**
 * Prompt for basic agent information
 */
async function promptForAgentInfo(
  providers: readonly string[],
  agentTypes: readonly string[],
  tools: readonly string[],
  defaultProvider: string,
  defaultModel: string,
): Promise<AIAgentCreationAnswers> {
  const questions = [
    {
      type: "input",
      name: "name",
      message: "What would you like to name your AI agent?",
      validate: (input: string): boolean | string => {
        if (!input || input.trim().length === 0) {
          return "Agent name cannot be empty";
        }
        if (input.length > 100) {
          return "Agent name cannot exceed 100 characters";
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
          return "Agent name can only contain letters, numbers, underscores, and hyphens";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "description",
      message: "Describe what this AI agent will do:",
      validate: (input: string): boolean | string => {
        if (!input || input.trim().length === 0) {
          return "Agent description cannot be empty";
        }
        if (input.length > 500) {
          return "Agent description cannot exceed 500 characters";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "agentType",
      message: "What type of agent would you like to create?",
      choices: agentTypes,
      default: "default",
    },
    {
      type: "list",
      name: "llmProvider",
      message: "Which LLM provider would you like to use?",
      choices: providers,
      default: defaultProvider,
    },
    {
      type: "input",
      name: "llmModel",
      message: "Which model would you like to use?",
      default: defaultModel,
    },
    {
      type: "checkbox",
      name: "tools",
      message: "Which tools should this agent have access to?",
      choices: tools,
      default: [],
    },
  ];

  // @ts-expect-error - inquirer types are not matching correctly
  const answers = (await inquirer.prompt(questions)) as AIAgentCreationAnswers;
  return answers;
}

/**
 * Chat with an AI agent
 */
export function chatWithAIAgentCommand(
  agentId: string,
): Effect.Effect<
  void,
  StorageError | StorageNotFoundError,
  | AgentService
  | ConfigService
  | LLMService
  | ToolRegistry
  | LoggerService
  | FileSystemContextService
  | FileSystem.FileSystem
> {
  return Effect.gen(function* () {
    // Get the agent service
    const agentService = yield* AgentServiceTag;

    // Get the agent
    const agent = yield* agentService.getAgent(agentId);

    console.log(`🤖 Starting chat with AI agent: ${agent.name} (${agent.id})`);
    console.log(`   Description: ${agent.description}`);
    console.log();
    console.log("Type 'exit' or 'quit' to end the conversation.");
    console.log();

    // Start the chat loop with error logging
    yield* startChatLoop(agent).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const logger = yield* LoggerServiceTag;
          yield* logger.error("Chat loop error", { error });
          console.error("❌ Chat loop error:", error);
          return yield* Effect.void;
        }),
      ),
    );
  });
}

function initializeSession(
  agent: Agent,
  conversationId: string,
): Effect.Effect<void, Error, FileSystemContextService | LoggerService | FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const agentKey = { agentId: agent.id, conversationId };
    const fileSystemContext = yield* FileSystemContextServiceTag;
    const logger = yield* LoggerServiceTag;
    yield* fileSystemContext.setCwd(agentKey, process.cwd());
    yield* logger.info(`Initialized agent working directory to: ${process.cwd()}`);
  });
}
/**
 * Chat loop for interacting with the AI agent
 */
function startChatLoop(
  agent: Agent,
): Effect.Effect<
  void,
  Error,
  | ConfigService
  | LLMService
  | ToolRegistry
  | LoggerService
  | FileSystemContextService
  | FileSystem.FileSystem
> {
  return Effect.gen(function* () {
    let chatActive = true;
    let conversationId: string | undefined;
    let conversationHistory: ChatMessage[] = [];
    let sessionInitialized = false;

    while (chatActive) {
      // Prompt for user input
      const answer = yield* Effect.promise(() =>
        inquirer.prompt([
          {
            type: "input",
            name: "message",
            message: "You:",
          },
        ]),
      );

      const userMessage = answer.message as string;

      // Check if user wants to exit
      if (userMessage.toLowerCase() === "exit" || userMessage.toLowerCase() === "quit") {
        console.log("👋 Goodbye!");
        chatActive = false;
        continue;
      }

      // Ignore empty messages with a gentle hint
      if (!userMessage || userMessage.trim().length === 0) {
        console.log("(Tip) Type a message and press Enter, or 'exit' to quit.");
        continue;
      }

      try {
        if (!sessionInitialized) {
          yield* initializeSession(agent, conversationId || "").pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const logger = yield* LoggerServiceTag;
                yield* logger.error("Session initialization error", { error });
              }),
            ),
          );

          sessionInitialized = true;
        }

        // Create runner options
        const options: AgentRunnerOptions = {
          agent,
          userInput: userMessage,
          conversationId: conversationId || "",
          conversationHistory,
        };

        // Run the agent
        const response = yield* AgentRunner.run(options);

        // Store the conversation ID for continuity
        conversationId = response.conversationId;

        // Persist conversation history for next turn
        if (response.messages) {
          conversationHistory = response.messages;
        }

        // Display the response
        console.log();
        console.log(`🤖 ${agent.name}:`);
        console.log(response.content);
        console.log();
      } catch (error) {
        console.log();

        // Handle different error types with appropriate user feedback
        if (error instanceof LLMRateLimitError) {
          console.log(
            `⏳ Rate limit exceeded. The request was too large or you've hit your API limits.`,
          );
          console.log(`   Please try again in a moment or consider using a smaller context.`);
          console.log(`   Error details: ${error.message}`);
        } else if (error instanceof LLMRequestError) {
          console.log(`❌ LLM request failed: ${error.message}`);
          console.log(`   This might be a temporary issue. Please try again.`);
        } else {
          console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.log();

        const logger = yield* LoggerServiceTag;
        yield* logger.error("Agent chat processing error", { error });
      }
    }
  });
}
