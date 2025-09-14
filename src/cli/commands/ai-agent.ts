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
import { LLMServiceTag, type LLMService } from "../../services/llm/types";
import { LoggerServiceTag, type LoggerService } from "../../services/logger";

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
  StorageError | AgentAlreadyExistsError | AgentConfigurationError | ValidationError,
  AgentService | LLMService | ToolRegistry
> {
  return Effect.gen(function* () {
    console.log("🤖 Welcome to the Crush AI Agent Creation Wizard!");
    console.log("Let's create a new AI agent step by step.\n");

    // Get available LLM providers and models
    const llmService = yield* LLMServiceTag;
    const providers = yield* llmService.listProviders();

    // Get available agent types
    const agentTypes = yield* agentPromptBuilder.listTemplates();

    // Get available tools
    const toolRegistry = yield* ToolRegistryTag;
    const tools = yield* toolRegistry.listTools();

    // Get agent basic information
    const agentAnswers = yield* Effect.promise(() =>
      promptForAgentInfo(providers, agentTypes, tools)
    );

    // Build agent configuration
    const config: AgentConfig = {
      tasks: [],
      agentType: agentAnswers.agentType,
      llmProvider: agentAnswers.llmProvider,
      llmModel: agentAnswers.llmModel,
      tools: agentAnswers.tools,
      environment: {},
    };

    // Create the agent
    const agentService = yield* AgentServiceTag;
    const agent = yield* agentService.createAgent(
      agentAnswers.name,
      agentAnswers.description,
      config
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
  tools: readonly string[]
): Promise<AIAgentCreationAnswers> {
  // Get default provider and model
  const defaultProvider = providers[0] || "mock";
  const defaultModel = "gpt-4";

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
      default: ["listEmails", "searchEmails"],
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
  agentId: string
): Effect.Effect<
  void,
  StorageError | StorageNotFoundError,
  AgentService | LLMService | ToolRegistry | LoggerService
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

    // Start the chat loop with error logging (do not swallow silently)
    yield* startChatLoop(agent).pipe(
      Effect.catchAll(error =>
        Effect.gen(function* () {
          const logger = yield* LoggerServiceTag;
          yield* logger.error("Chat loop error", { error });
          console.error("❌ Chat loop error:", error);
          return yield* Effect.void;
        })
      )
    );
  });
}

/**
 * Chat loop for interacting with the AI agent
 */
function startChatLoop(
  agent: Agent
): Effect.Effect<void, Error, LLMService | ToolRegistry | LoggerService> {
  return Effect.gen(function* () {
    let chatActive = true;
    let conversationId: string | undefined;

    while (chatActive) {
      // Prompt for user input
      const answer = yield* Effect.promise(() =>
        inquirer.prompt([
          {
            type: "input",
            name: "message",
            message: "You:",
          },
        ])
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

      // Process the user message
      try {
        // Create runner options
        const options: AgentRunnerOptions = {
          agent,
          userInput: userMessage,
          conversationId: conversationId || "",
        };

        // Run the agent
        const response = yield* AgentRunner.run(options);

        // Store the conversation ID for continuity
        conversationId = response.conversationId;

        // Display the response
        console.log();
        console.log(`🤖 ${agent.name}:`);
        console.log(response.content);
        console.log();
      } catch (error) {
        console.log();
        console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        console.log();
        // Also log via structured logger
        const logger = yield* LoggerServiceTag;
        yield* logger.error("Agent chat processing error", { error });
      }
    }
  });
}
