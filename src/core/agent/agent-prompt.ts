import { Effect } from "effect";
import { type ChatMessage } from "../../services/llm/types";

/**
 * Agent prompt system for constructing effective prompts for different agent types
 */

export interface AgentPromptTemplate {
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly userPromptTemplate: string;
  readonly toolDescriptions?: Record<string, string>;
}

export interface AgentPromptOptions {
  readonly agentName: string;
  readonly agentDescription: string;
  readonly userInput: string;
  readonly conversationHistory?: ChatMessage[];
  readonly toolNames?: string[];
  readonly availableTools?: Record<string, string>;
}

export class AgentPromptBuilder {
  private templates: Record<string, AgentPromptTemplate>;

  constructor() {
    this.templates = {
      default: {
        name: "Default Agent",
        description: "A general-purpose agent that can assist with various tasks.",
        systemPrompt: `You are {agentName}, an AI assistant that helps users with their tasks.
{agentDescription}

Your goal is to be helpful, harmless, and honest in your interactions.

{toolInstructions}`,
        userPromptTemplate: "{userInput}",
      },
      gmail: {
        name: "Gmail Agent",
        description: "An agent specialized in handling email-related tasks.",
        systemPrompt: `You are {agentName}, an AI assistant specialized in helping users manage their emails.
{agentDescription}

You can help with reading, searching, and organizing emails.

{toolInstructions}`,
        userPromptTemplate: "{userInput}",
        toolDescriptions: {
          listEmails: "List the user's emails with optional filtering.",
          getEmail: "Get the full content of a specific email by ID.",
          searchEmails: "Search for emails matching specific criteria.",
          sendEmail: "Send an email on behalf of the user.",
        },
      },
      coder: {
        name: "Coding Assistant",
        description: "An agent specialized in helping with coding tasks.",
        systemPrompt: `You are {agentName}, an AI coding assistant that helps users with programming tasks.
{agentDescription}

You can help with writing code, debugging issues, and explaining programming concepts.

{toolInstructions}`,
        userPromptTemplate: "{userInput}",
      },
    };
  }

  /**
   * Get a prompt template by name
   */
  getTemplate(name: string): Effect.Effect<AgentPromptTemplate, Error> {
    return Effect.try({
      try: () => {
        const template = this.templates[name];
        if (!template) {
          throw new Error(`Prompt template not found: ${name}`);
        }
        return template;
      },
      catch: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    });
  }

  /**
   * List available prompt templates
   */
  listTemplates(): Effect.Effect<readonly string[], never> {
    return Effect.succeed(Object.keys(this.templates));
  }

  /**
   * Build a system prompt from a template and options
   */
  buildSystemPrompt(
    templateName: string,
    options: AgentPromptOptions
  ): Effect.Effect<string, Error> {
    return Effect.gen(
      function* (this: AgentPromptBuilder) {
        const template = yield* this.getTemplate(templateName);

        // Replace placeholders in system prompt
        let systemPrompt = template.systemPrompt
          .replace("{agentName}", options.agentName)
          .replace("{agentDescription}", options.agentDescription);

        // Add tool instructions if tools are available
        if (options.toolNames && options.toolNames.length > 0) {
          let toolInstructions = "You have access to the following tools:\n\n";

          options.toolNames.forEach(toolName => {
            const description =
              options.availableTools?.[toolName] ||
              template.toolDescriptions?.[toolName] ||
              `Use the ${toolName} tool.`;

            toolInstructions += `- ${toolName}: ${description}\n`;
          });

          toolInstructions +=
            "\nWhen you need to use a tool, respond with the appropriate tool name and parameters.";

          systemPrompt = systemPrompt.replace("{toolInstructions}", toolInstructions);
        } else {
          systemPrompt = systemPrompt.replace("{toolInstructions}", "");
        }

        return systemPrompt;
      }.bind(this)
    );
  }

  /**
   * Build a user prompt from a template and options
   */
  buildUserPrompt(templateName: string, options: AgentPromptOptions): Effect.Effect<string, Error> {
    return Effect.gen(
      function* (this: AgentPromptBuilder) {
        const template = yield* this.getTemplate(templateName);

        // Replace placeholders in user prompt
        return template.userPromptTemplate.replace("{userInput}", options.userInput);
      }.bind(this)
    );
  }

  /**
   * Build complete messages for an agent, including system prompt and conversation history
   */
  buildAgentMessages(
    templateName: string,
    options: AgentPromptOptions
  ): Effect.Effect<ChatMessage[], Error> {
    return Effect.gen(
      function* (this: AgentPromptBuilder) {
        const systemPrompt = yield* this.buildSystemPrompt(templateName, options);
        const userPrompt = yield* this.buildUserPrompt(templateName, options);

        const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

        // Add conversation history if available
        if (options.conversationHistory && options.conversationHistory.length > 0) {
          // Filter out system messages from history
          const filteredHistory = options.conversationHistory.filter(msg => msg.role !== "system");

          messages.push(...filteredHistory);
        }

        // Add the current user input if not already in history
        if (
          !options.conversationHistory ||
          options.conversationHistory[options.conversationHistory.length - 1]?.role !== "user"
        ) {
          messages.push({ role: "user", content: userPrompt });
        }

        return messages;
      }.bind(this)
    );
  }
}

// Create a singleton instance
export const agentPromptBuilder = new AgentPromptBuilder();
