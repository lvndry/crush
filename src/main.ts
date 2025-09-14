#!/usr/bin/env bun

import { NodeFileSystem } from "@effect/platform-node";
import { Command } from "commander";
import { config } from "dotenv";
import { Effect, Layer } from "effect";
import {
  createAgentCommand,
  deleteAgentCommand,
  getAgentCommand,
  listAgentsCommand,
  runAgentCommand,
} from "./cli/commands/agent";
import { chatWithAIAgentCommand, createAIAgentCommand } from "./cli/commands/ai-agent";
import { createAgentServiceLayer } from "./core/agent/agent-service";
import { createToolRegistrationLayer } from "./core/agent/tools/register-tools";
import { createToolRegistryLayer } from "./core/agent/tools/tool-registry";
import type { AppConfig } from "./core/types/index";
import { createConfigLayer } from "./services/config";
import { createGmailServiceLayer } from "./services/gmail";
import { createLLMServiceLayer } from "./services/llm/llm-service";
import { createLoggerLayer, LoggerServiceTag } from "./services/logger";
import { createFileStorageLayer } from "./services/storage";

config();

/**
 * Main entry point for the Crush CLI
 */

function createAppLayer(config: AppConfig) {
  // Provide FileSystem explicitly to layers that require it
  const fileSystemLayer = NodeFileSystem.layer;

  const configLayer = createConfigLayer().pipe(Layer.provide(fileSystemLayer));
  const loggerLayer = createLoggerLayer(config);

  const storageLayer = createFileStorageLayer(config.storage.path || "./data").pipe(
    Layer.provide(fileSystemLayer),
  );

  // Create Gmail service layer (requires FileSystem)
  const gmailLayer = createGmailServiceLayer().pipe(Layer.provide(fileSystemLayer));

  // Create LLM service layer (production OpenAI) - no FileSystem required
  const llmLayer = createLLMServiceLayer();

  // Create tool registry layer
  const toolRegistryLayer = createToolRegistryLayer();

  // Register tools (requires only ToolRegistry)
  const toolRegistrationLayer = createToolRegistrationLayer().pipe(
    Layer.provide(toolRegistryLayer),
  );

  // Create agent service layer (requires StorageService)
  const agentLayer = createAgentServiceLayer().pipe(Layer.provide(storageLayer));

  return Layer.mergeAll(
    configLayer,
    loggerLayer,
    storageLayer,
    gmailLayer,
    llmLayer,
    toolRegistryLayer,
    toolRegistrationLayer,
    agentLayer,
  );
}

function main() {
  return Effect.sync(() => {
    // Default configuration
    const defaultConfig: AppConfig = {
      storage: {
        type: "file",
        path: "./data",
      },
      logging: {
        level: "info",
        format: "pretty",
        output: "console",
      },
      security: {},
      performance: {
        maxConcurrentAgents: 5,
        maxConcurrentTasks: 10,
        timeout: 30000,
      },
    };

    const appLayer = createAppLayer(defaultConfig);

    // Initialize CLI
    const program = new Command();

    program.name("crush").description("A powerful agentic automation CLI").version("0.1.0");

    // Global options
    program
      .option("-v, --verbose", "Enable verbose logging")
      .option("-q, --quiet", "Suppress output")
      .option("--config <path>", "Path to configuration file");

    // Agent commands
    const agentCommand = program.command("agent").description("Manage agents");

    agentCommand
      .command("list")
      .description("List all agents")
      .action(() => {
        void Effect.runPromise(
          listAgentsCommand().pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const logger = yield* LoggerServiceTag;
                yield* logger.error("❌ Error listing agents", { error });
                return yield* Effect.void;
              }),
            ),
            Effect.provide(appLayer),
          ),
        );
      });

    agentCommand
      .command("create")
      .description("Create a new AI agent (interactive mode)")
      .action(() => {
        void Effect.runPromise(
          createAIAgentCommand().pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const logger = yield* LoggerServiceTag;
                yield* logger.error("❌ Error creating AI agent", { error });
                return yield* Effect.void;
              }),
            ),
            Effect.provide(appLayer),
          ),
        );
      });

    agentCommand
      .command("create-quick <name>")
      .description("Create a new agent quickly with command line options")
      .option("-d, --description <description>", "Agent description")
      .option("-t, --timeout <timeout>", "Agent timeout in milliseconds", (value) =>
        parseInt(value, 10),
      )
      .option("-r, --max-retries <retries>", "Maximum number of retries", (value) =>
        parseInt(value, 10),
      )
      .option("--retry-delay <delay>", "Retry delay in milliseconds", (value) =>
        parseInt(value, 10),
      )
      .option("--retry-backoff <backoff>", "Retry backoff strategy", "exponential")
      .action(
        (
          name: string,
          options: {
            description?: string;
            timeout?: number;
            maxRetries?: number;
            retryDelay?: number;
            retryBackoff?: "linear" | "exponential" | "fixed";
          },
        ) => {
          void Effect.runPromise(
            createAgentCommand(name, options.description || "", options).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  const logger = yield* LoggerServiceTag;
                  yield* logger.error("❌ Error creating agent", { error });
                  return yield* Effect.void;
                }),
              ),
              Effect.provide(appLayer),
            ),
          );
        },
      );

    agentCommand
      .command("run <agentId>")
      .description("Run an agent")
      .option("--watch", "Watch for changes")
      .option("--dry-run", "Show what would be executed without running")
      .action((agentId: string, options: { watch?: boolean; dryRun?: boolean; }) => {
        void Effect.runPromise(
          runAgentCommand(agentId, options).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const logger = yield* LoggerServiceTag;
                yield* logger.error("❌ Error running agent", { error });
                return yield* Effect.void;
              }),
            ),
            Effect.provide(appLayer),
          ),
        );
      });

    agentCommand
      .command("get <agentId>")
      .description("Get agent details")
      .action((agentId: string) => {
        void Effect.runPromise(
          getAgentCommand(agentId).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const logger = yield* LoggerServiceTag;
                yield* logger.error("❌ Error getting agent", { error });
                return yield* Effect.void;
              }),
            ),
            Effect.provide(appLayer),
          ),
        );
      });

    agentCommand
      .command("delete <agentId>")
      .description("Delete an agent")
      .action((agentId: string) => {
        void Effect.runPromise(
          deleteAgentCommand(agentId).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const logger = yield* LoggerServiceTag;
                yield* logger.error("❌ Error deleting agent", { error });
                return yield* Effect.void;
              }),
            ),
            Effect.provide(appLayer),
          ),
        );
      });

    agentCommand
      .command("chat <agentId>")
      .description("Start a chat with an agent")
      .action((agentId: string) => {
        void Effect.runPromise(
          chatWithAIAgentCommand(agentId).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const logger = yield* LoggerServiceTag;
                yield* logger.error("❌ Error chatting with AI agent", { error });
                return yield* Effect.void;
              }),
            ),
            Effect.provide(appLayer),
          ),
        );
      });

    // Automation commands
    const automationCommand = program.command("automation").description("Manage automations");

    automationCommand
      .command("list")
      .description("List all automations")
      .action(() => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info("Listing automations...");
            // TODO: Implement automation listing
          }).pipe(Effect.provide(appLayer)),
        );
      });

    automationCommand
      .command("create <name>")
      .description("Create a new automation")
      .option("-d, --description <description>", "Automation description")
      .action((name: string, options: { description?: string; }) => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info(`Creating automation: ${name}`);
            if (options.description) {
              yield* logger.info(`Description: ${options.description}`);
            }
            // TODO: Implement automation creation
          }).pipe(Effect.provide(appLayer)),
        );
      });

    // Config commands
    const configCommand = program.command("config").description("Manage configuration");

    configCommand
      .command("get <key>")
      .description("Get a configuration value")
      .action((key: string) => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info(`Getting config: ${key}`);
            // TODO: Implement config retrieval
          }).pipe(Effect.provide(appLayer)),
        );
      });

    configCommand
      .command("set <key> <value>")
      .description("Set a configuration value")
      .action((key: string, value: string) => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info(`Setting config: ${key} = ${value}`);
            // TODO: Implement config setting
          }).pipe(Effect.provide(appLayer)),
        );
      });

    configCommand
      .command("list")
      .description("List all configuration values")
      .action(() => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info("Listing configuration...");
            // TODO: Implement config listing
          }).pipe(Effect.provide(appLayer)),
        );
      });

    // Logs command
    program
      .command("logs")
      .description("View logs")
      .option("-f, --follow", "Follow log output")
      .option("-l, --level <level>", "Filter by log level", "info")
      .action((options: { follow?: boolean; level: string; }) => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info("Viewing logs...");
            if (options.follow) {
              yield* logger.info("Following log output");
            }
            yield* logger.info(`Log level: ${options.level}`);
            // TODO: Implement log viewing
          }).pipe(Effect.provide(appLayer)),
        );
      });

    // Parse command line arguments
    program.parse();
  });
}

// Run the main function
Effect.runPromise(main()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
