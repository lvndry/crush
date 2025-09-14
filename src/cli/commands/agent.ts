import { Effect } from "effect";
import {
  AgentServiceTag,
  getAgentById,
  listAllAgents,
  type AgentService,
} from "../../core/agent/agent-service";
import { executeGmailTask } from "../../core/agent/gmail-agent";
import {
  AgentAlreadyExistsError,
  AgentConfigurationError,
  StorageError,
  StorageNotFoundError,
  ValidationError,
} from "../../core/types/errors";
import type { AgentConfig } from "../../core/types/index";
import type { GmailEmail, GmailService } from "../../services/gmail";

/**
 * CLI commands for agent management
 */

export function createAgentCommand(
  name: string,
  description: string,
  options: {
    description?: string;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    retryBackoff?: "linear" | "exponential" | "fixed";
  },
): Effect.Effect<
  void,
  StorageError | AgentAlreadyExistsError | AgentConfigurationError | ValidationError,
  AgentService
> {
  return Effect.gen(function* () {
    const agentService = yield* AgentServiceTag;

    // Use provided description or default
    const agentDescription = description || options.description || `Agent for ${name}`;

    // Build agent configuration from options
    const config: Partial<AgentConfig> = {};

    if (options.timeout) {
      config.timeout = options.timeout;
    }

    if (
      options.maxRetries !== undefined ||
      options.retryDelay !== undefined ||
      options.retryBackoff
    ) {
      config.retryPolicy = {
        maxRetries: options.maxRetries || 3,
        delay: options.retryDelay || 1000,
        backoff: options.retryBackoff || "exponential",
      };
    }

    // Create the agent
    const agent = yield* agentService.createAgent(name, agentDescription, config);

    // Display success message
    console.log(`✅ Agent created successfully!`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Description: ${agent.description}`);
    console.log(`   Status: ${agent.status}`);
    console.log(`   Created: ${agent.createdAt.toISOString()}`);

    if (config.timeout) {
      console.log(`   Timeout: ${config.timeout}ms`);
    }

    if (config.retryPolicy) {
      console.log(
        `   Retry Policy: ${config.retryPolicy.maxRetries} retries, ${config.retryPolicy.delay}ms delay, ${config.retryPolicy.backoff} backoff`,
      );
    }
  });
}

export function listAgentsCommand(): Effect.Effect<void, StorageError, AgentService> {
  return Effect.gen(function* () {
    const agents = yield* listAllAgents();

    if (agents.length === 0) {
      console.log("No agents found. Create your first agent with: crush agent create");
      return;
    }

    console.log(`Found ${agents.length} agent(s):`);
    console.log();

    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (${agent.id})`);
      console.log(`   Description: ${agent.description}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Tasks: ${agent.config.tasks.length}`);
      console.log(`   Created: ${new Date(agent.createdAt).toISOString()}`);
      console.log(`   Updated: ${new Date(agent.updatedAt).toISOString()}`);
      console.log();
    });
  });
}

export function runAgentCommand(
  agentId: string,
  options: {
    watch?: boolean;
    dryRun?: boolean;
  },
): Effect.Effect<void, StorageError | StorageNotFoundError, AgentService | GmailService> {
  return Effect.gen(function* () {
    const agent = yield* getAgentById(agentId);

    console.log(`🚀 Running agent: ${agent.name} (${agent.id})`);
    console.log(`   Description: ${agent.description}`);
    console.log(`   Status: ${agent.status}`);
    console.log(`   Tasks: ${agent.config.tasks.length}`);

    if (options.dryRun) {
      console.log(`   Mode: DRY RUN (no actual execution)`);
      console.log();
      console.log("Tasks that would be executed:");
      agent.config.tasks.forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.name} (${task.type})`);
        console.log(`      Description: ${task.description}`);
        if (task.dependencies && task.dependencies.length > 0) {
          console.log(`      Dependencies: ${task.dependencies.join(", ")}`);
        }
      });
      return;
    }

    if (options.watch) {
      console.log(`   Mode: WATCH (continuous execution)`);
    }

    console.log();

    // Check if this agent has Gmail tasks
    const gmailTasks = agent.config.tasks.filter((task) => task.type === "gmail");

    if (gmailTasks.length > 0) {
      console.log(`🔍 Found ${gmailTasks.length} Gmail task(s) to execute`);

      // Import the Gmail task executor dynamically

      // Execute each Gmail task
      for (const task of gmailTasks) {
        console.log(`\n📨 Executing Gmail task: ${task.name}`);
        console.log(`   Operation: ${task.config.gmailOperation}`);

        const result = yield* executeGmailTask(task).pipe(
          Effect.catchAll((error) =>
            Effect.succeed({
              taskId: task.id,
              status: "failure",
              error: error instanceof Error ? error.message : String(error),
              duration: 0,
              timestamp: new Date(),
              output: "[]",
            }),
          ),
        );

        if (result.status === "success") {
          console.log(`✅ Task completed successfully in ${result.duration}ms`);

          // Display the output based on the operation
          if (
            task.config.gmailOperation === "listEmails" ||
            task.config.gmailOperation === "searchEmails"
          ) {
            try {
              const emails = JSON.parse(result.output || "[]") as GmailEmail[];
              console.log(`\n📬 Found ${emails.length} email(s):`);

              emails.forEach((email: GmailEmail, index: number) => {
                console.log(`\n${index + 1}. ${email.subject}`);
                console.log(`   From: ${email.from}`);
                console.log(`   Date: ${new Date(email.date).toLocaleString()}`);
                console.log(`   ${email.snippet}`);
              });
            } catch {
              console.log(`\n${result.output}`);
            }
          } else {
            console.log(`\n${result.output}`);
          }
        } else {
          console.log(`❌ Task failed: ${result.error}`);
        }
      }
    } else {
      console.log("⚠️  No Gmail tasks found in this agent.");
      console.log("   Other task types are not yet implemented.");
    }
  });
}

export function deleteAgentCommand(
  agentId: string,
): Effect.Effect<void, StorageError | StorageNotFoundError, AgentService> {
  return Effect.gen(function* () {
    const agentService = yield* AgentServiceTag;

    // First check if agent exists
    const agent = yield* agentService.getAgent(agentId);

    // Delete the agent
    yield* agentService.deleteAgent(agentId);

    console.log(`🗑️  Agent deleted successfully!`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   ID: ${agent.id}`);
  });
}

export function getAgentCommand(
  agentId: string,
): Effect.Effect<void, StorageError | StorageNotFoundError, AgentService> {
  return Effect.gen(function* () {
    const agent = yield* getAgentById(agentId);

    console.log(`📋 Agent Details:`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Description: ${agent.description}`);
    console.log(`   Status: ${agent.status}`);
    console.log(`   Created: ${new Date(agent.createdAt).toISOString()}`);
    console.log(`   Updated: ${new Date(agent.updatedAt).toISOString()}`);
    console.log();

    console.log(`⚙️  Configuration:`);
    console.log(`   Timeout: ${agent.config.timeout || "default"}ms`);
    console.log(`   Tasks: ${agent.config.tasks.length}`);

    if (agent.config.retryPolicy) {
      console.log(`   Retry Policy:`);
      console.log(`     Max Retries: ${agent.config.retryPolicy.maxRetries}`);
      console.log(`     Delay: ${agent.config.retryPolicy.delay}ms`);
      console.log(`     Backoff: ${agent.config.retryPolicy.backoff}`);
    }

    if (agent.config.environment && Object.keys(agent.config.environment).length > 0) {
      console.log(`   Environment Variables: ${Object.keys(agent.config.environment).length}`);
    }

    if (agent.config.schedule) {
      console.log(`   Schedule: ${agent.config.schedule.type} - ${agent.config.schedule.value}`);
    }

    console.log();

    if (agent.config.tasks.length > 0) {
      console.log(`📝 Tasks:`);
      agent.config.tasks.forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.name} (${task.type})`);
        console.log(`      Description: ${task.description}`);
        console.log(`      ID: ${task.id}`);

        if (task.dependencies && task.dependencies.length > 0) {
          console.log(`      Dependencies: ${task.dependencies.join(", ")}`);
        }

        if (task.maxRetries !== undefined) {
          console.log(`      Max Retries: ${task.maxRetries}`);
        }

        // Show task-specific config
        switch (task.type) {
          case "command":
            if (task.config.command) {
              console.log(`      Command: ${task.config.command}`);
            }
            break;
          case "script":
            if (task.config.script) {
              console.log(
                `      Script: ${task.config.script.substring(0, 100)}${task.config.script.length > 100 ? "..." : ""}`,
              );
            }
            break;
          case "api":
            if (task.config.url) {
              console.log(`      URL: ${task.config.url}`);
              if (task.config.method) {
                console.log(`      Method: ${task.config.method}`);
              }
            }
            break;
          case "file":
            if (task.config.filePath) {
              console.log(`      File Path: ${task.config.filePath}`);
            }
            break;
          case "gmail":
            if (task.config.gmailOperation) {
              console.log(`      Gmail Operation: ${task.config.gmailOperation}`);
              if (task.config.gmailQuery) {
                console.log(`      Query: ${task.config.gmailQuery}`);
              }
              if (task.config.gmailMaxResults) {
                console.log(`      Max Results: ${task.config.gmailMaxResults}`);
              }
            }
            break;
        }
        console.log();
      });
    } else {
      console.log(`📝 No tasks configured for this agent.`);
    }
  });
}
