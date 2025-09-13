import { Effect } from "effect";
import inquirer from "inquirer";
import { AgentService } from "../../core/agent/agent-service.js";
import {
  AgentAlreadyExistsError,
  AgentConfigurationError,
  StorageError,
  ValidationError,
} from "../../core/types/errors.js";
import type { AgentConfig } from "../../core/types/index.js";

/**
 * Interactive CLI for agent creation and management
 */

interface AgentCreationAnswers {
  name: string;
  description: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  retryBackoff: "linear" | "exponential" | "fixed";
  addTasks: boolean;
}

interface TaskCreationAnswers {
  taskName: string;
  taskDescription: string;
  taskType: "command" | "script" | "api" | "file" | "webhook" | "custom";
  addMoreTasks: boolean;
}

interface CommandTaskAnswers {
  command: string;
  workingDirectory?: string;
}

interface ScriptTaskAnswers {
  script: string;
  workingDirectory?: string;
}

interface ApiTaskAnswers {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: string;
  body?: string;
}

interface FileTaskAnswers {
  filePath: string;
}

/**
 * Interactive agent creation command
 */
export function createInteractiveAgentCommand(): Effect.Effect<
  void,
  StorageError | AgentAlreadyExistsError | AgentConfigurationError | ValidationError,
  AgentService
> {
  return Effect.gen(function* () {
    console.log("🤖 Welcome to the Crush Agent Creation Wizard!");
    console.log("Let's create a new agent step by step.\n");

    // Get agent basic information
    const agentAnswers = yield* Effect.promise(() => promptForAgentInfo());

    // Get tasks if user wants to add them
    const tasks = [];
    if (agentAnswers.addTasks) {
      const taskAnswers = yield* Effect.promise(() => promptForTasks());
      tasks.push(...taskAnswers);
    }

    // Build agent configuration
    const config: Partial<AgentConfig> = {
      timeout: agentAnswers.timeout,
      retryPolicy: {
        maxRetries: agentAnswers.maxRetries,
        delay: agentAnswers.retryDelay,
        backoff: agentAnswers.retryBackoff,
      },
      tasks,
    };

    // Create the agent
    const agentService = yield* AgentService;
    const agent = yield* agentService.createAgent(
      agentAnswers.name,
      agentAnswers.description,
      config
    );

    // Display success message
    console.log("\n✅ Agent created successfully!");
    console.log(`   ID: ${agent.id}`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Description: ${agent.description}`);
    console.log(`   Status: ${agent.status}`);
    console.log(`   Created: ${agent.createdAt.toISOString()}`);
    console.log(`   Timeout: ${config.timeout}ms`);
    console.log(
      `   Retry Policy: ${config.retryPolicy?.maxRetries} retries, ${config.retryPolicy?.delay}ms delay, ${config.retryPolicy?.backoff} backoff`
    );

    if (tasks.length > 0) {
      console.log(`   Tasks: ${tasks.length}`);
      tasks.forEach((task, index) => {
        console.log(`     ${index + 1}. ${task.name} (${task.type})`);
      });
    }
  });
}

/**
 * Prompt for basic agent information
 */
async function promptForAgentInfo(): Promise<AgentCreationAnswers> {
  const questions = [
    {
      type: "input",
      name: "name",
      message: "What would you like to name your agent?",
      validate: (input: string) => {
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
      message: "Describe what this agent will do:",
      validate: (input: string) => {
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
      type: "number",
      name: "timeout",
      message: "What should be the timeout for this agent (in milliseconds)?",
      default: 30000,
      validate: (input: number) => {
        if (input < 1000 || input > 3600000) {
          return "Timeout must be between 1000ms and 3600000ms (1 hour)";
        }
        return true;
      },
    },
    {
      type: "number",
      name: "maxRetries",
      message: "How many retries should this agent attempt on failure?",
      default: 3,
      validate: (input: number) => {
        if (input < 0 || input > 10) {
          return "Max retries must be between 0 and 10";
        }
        return true;
      },
    },
    {
      type: "number",
      name: "retryDelay",
      message: "What should be the delay between retries (in milliseconds)?",
      default: 1000,
      validate: (input: number) => {
        if (input < 100 || input > 60000) {
          return "Retry delay must be between 100ms and 60000ms";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "retryBackoff",
      message: "What retry backoff strategy should be used?",
      choices: [
        { name: "Linear (constant delay)", value: "linear" },
        { name: "Exponential (increasing delay)", value: "exponential" },
        { name: "Fixed (same delay every time)", value: "fixed" },
      ],
      default: "exponential",
    },
    {
      type: "confirm",
      name: "addTasks",
      message: "Would you like to add tasks to this agent now?",
      default: false,
    },
  ];

  const answers = (await inquirer.prompt(questions as any)) as AgentCreationAnswers;
  return answers;
}

/**
 * Prompt for tasks to add to the agent
 */
async function promptForTasks(): Promise<any[]> {
  const tasks = [];
  let addMoreTasks = true;

  while (addMoreTasks) {
    const taskQuestions = [
      {
        type: "input",
        name: "taskName",
        message: "What should this task be called?",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Task name cannot be empty";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "taskDescription",
        message: "Describe what this task does:",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Task description cannot be empty";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "taskType",
        message: "What type of task is this?",
        choices: [
          { name: "Command (execute a shell command)", value: "command" },
          { name: "Script (run a script file)", value: "script" },
          { name: "API (make an HTTP request)", value: "api" },
          { name: "File (process a file)", value: "file" },
          { name: "Webhook (trigger a webhook)", value: "webhook" },
          { name: "Custom (custom task type)", value: "custom" },
        ],
      },
    ];

    const taskAnswers = (await inquirer.prompt(taskQuestions as any)) as TaskCreationAnswers;

    // Get task-specific configuration based on type
    const taskConfig = await getTaskConfig(taskAnswers.taskType);

    const task = {
      id: crypto.randomUUID(),
      name: taskAnswers.taskName,
      description: taskAnswers.taskDescription,
      type: taskAnswers.taskType,
      config: taskConfig,
    };

    tasks.push(task);

    const continueAnswer = await inquirer.prompt([
      {
        type: "confirm",
        name: "addMoreTasks",
        message: "Would you like to add another task?",
        default: false,
      },
    ]);

    addMoreTasks = continueAnswer.addMoreTasks;
  }

  return tasks;
}

/**
 * Get task-specific configuration based on task type
 */
async function getTaskConfig(taskType: string): Promise<any> {
  switch (taskType) {
    case "command":
      const commandQuestions = [
        {
          type: "input",
          name: "command",
          message: "What command should be executed?",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "Command cannot be empty";
            }
            return true;
          },
        },
        {
          type: "input",
          name: "workingDirectory",
          message: "Working directory (optional):",
          default: "",
        },
      ];
      const commandAnswers = (await inquirer.prompt(commandQuestions as any)) as CommandTaskAnswers;
      return {
        command: commandAnswers.command,
        workingDirectory: commandAnswers.workingDirectory || undefined,
      };

    case "script":
      const scriptQuestions = [
        {
          type: "input",
          name: "script",
          message: "What script should be executed?",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "Script cannot be empty";
            }
            return true;
          },
        },
        {
          type: "input",
          name: "workingDirectory",
          message: "Working directory (optional):",
          default: "",
        },
      ];
      const scriptAnswers = (await inquirer.prompt(scriptQuestions as any)) as ScriptTaskAnswers;
      return {
        script: scriptAnswers.script,
        workingDirectory: scriptAnswers.workingDirectory || undefined,
      };

    case "api":
      const apiQuestions = [
        {
          type: "input",
          name: "url",
          message: "What URL should be called?",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "URL cannot be empty";
            }
            try {
              new URL(input);
              return true;
            } catch {
              return "Please enter a valid URL";
            }
          },
        },
        {
          type: "list",
          name: "method",
          message: "What HTTP method should be used?",
          choices: ["GET", "POST", "PUT", "DELETE"],
          default: "GET",
        },
        {
          type: "input",
          name: "headers",
          message: "Headers (JSON format, optional):",
          default: "",
        },
        {
          type: "input",
          name: "body",
          message: "Request body (optional):",
          default: "",
        },
      ];
      const apiAnswers = (await inquirer.prompt(apiQuestions as any)) as ApiTaskAnswers;

      const config: any = {
        url: apiAnswers.url,
        method: apiAnswers.method,
      };

      if (apiAnswers.headers) {
        try {
          config.headers = JSON.parse(apiAnswers.headers);
        } catch {
          console.log("⚠️  Invalid JSON for headers, skipping...");
        }
      }

      if (apiAnswers.body) {
        config.body = apiAnswers.body;
      }

      return config;

    case "file":
      const fileQuestions = [
        {
          type: "input",
          name: "filePath",
          message: "What file should be processed?",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "File path cannot be empty";
            }
            return true;
          },
        },
      ];
      const fileAnswers = (await inquirer.prompt(fileQuestions as any)) as FileTaskAnswers;
      return {
        filePath: fileAnswers.filePath,
      };

    case "webhook":
      const webhookQuestions = [
        {
          type: "input",
          name: "url",
          message: "What webhook URL should be called?",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "Webhook URL cannot be empty";
            }
            try {
              new URL(input);
              return true;
            } catch {
              return "Please enter a valid URL";
            }
          },
        },
      ];
      const webhookAnswers = (await inquirer.prompt(webhookQuestions as any)) as any;
      return {
        url: webhookAnswers.url,
      };

    case "custom":
      const customQuestions = [
        {
          type: "input",
          name: "customConfig",
          message: "Enter custom configuration (JSON format):",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "Custom configuration cannot be empty";
            }
            try {
              JSON.parse(input);
              return true;
            } catch {
              return "Please enter valid JSON";
            }
          },
        },
      ];
      const customAnswers = (await inquirer.prompt(customQuestions as any)) as any;
      return JSON.parse(customAnswers.customConfig);

    default:
      return {};
  }
}
