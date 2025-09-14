#!/usr/bin/env bun

import { FileSystem } from "@effect/platform";
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
import { gmailLoginCommand, gmailLogoutCommand, gmailStatusCommand } from "./cli/commands/auth";
import { createAgentServiceLayer } from "./core/agent/agent-service";
import { createToolRegistrationLayer } from "./core/agent/tools/register-tools";
import { createToolRegistryLayer } from "./core/agent/tools/tool-registry";
import { AgentConfigService, createConfigLayer } from "./services/config";
import { createGmailServiceLayer } from "./services/gmail";
import { createLiteLLMServiceLayer } from "./services/llm/litellm-service";
import { createLoggerLayer, LoggerServiceTag } from "./services/logger";
import { FileStorageService } from "./services/storage/file";
import { StorageServiceTag } from "./services/storage/service";

config();

/**
 * Main entry point for the Crush CLI
 */

function createAppLayer() {
  const fileSystemLayer = NodeFileSystem.layer;

  const configLayer = createConfigLayer().pipe(Layer.provide(fileSystemLayer));
  const loggerLayer = createLoggerLayer();

  const storageLayer = Layer.effect(
    StorageServiceTag,
    Effect.gen(function* () {
      const config = yield* AgentConfigService;
      const { storage } = yield* config.appConfig;
      const basePath = storage.type === "file" ? storage.path : "./.crush";
      const fs = yield* FileSystem.FileSystem;
      return new FileStorageService(basePath, fs);
    }),
  ).pipe(Layer.provide(fileSystemLayer), Layer.provide(configLayer));

  const gmailLayer = createGmailServiceLayer().pipe(
    Layer.provide(fileSystemLayer),
    Layer.provide(configLayer),
    Layer.provide(loggerLayer),
  );

  const llmLayer = createLiteLLMServiceLayer().pipe(Layer.provide(configLayer));

  const toolRegistryLayer = createToolRegistryLayer();

  const toolRegistrationLayer = createToolRegistrationLayer().pipe(
    Layer.provide(toolRegistryLayer),
  );

  const agentLayer = createAgentServiceLayer().pipe(Layer.provide(storageLayer));

  return Layer.mergeAll(
    fileSystemLayer,
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
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error listing agents:", error);
              }),
            ),
          ),
        );
      });

    agentCommand
      .command("create")
      .description("Create a new AI agent (interactive mode)")
      .action(() => {
        void Effect.runPromise(
          createAIAgentCommand().pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error creating AI agent:", error);
              }),
            ),
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
              Effect.provide(createAppLayer()),
              Effect.catchAll((error) =>
                Effect.sync(() => {
                  console.error("❌ Error creating agent:", error);
                }),
              ),
            ),
          );
        },
      );

    agentCommand
      .command("run <agentId>")
      .description("Run an agent")
      .option("--watch", "Watch for changes")
      .option("--dry-run", "Show what would be executed without running")
      .action((agentId: string, options: { watch?: boolean; dryRun?: boolean }) => {
        void Effect.runPromise(
          runAgentCommand(agentId, options).pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error running agent:", error);
              }),
            ),
          ),
        );
      });

    agentCommand
      .command("get <agentId>")
      .description("Get agent details")
      .action((agentId: string) => {
        void Effect.runPromise(
          getAgentCommand(agentId).pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error getting agent:", error);
              }),
            ),
          ),
        );
      });

    agentCommand
      .command("delete <agentId>")
      .description("Delete an agent")
      .action((agentId: string) => {
        void Effect.runPromise(
          deleteAgentCommand(agentId).pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error deleting agent:", error);
              }),
            ),
          ),
        );
      });

    agentCommand
      .command("chat <agentId>")
      .description("Start a chat with an agent")
      .action((agentId: string) => {
        void Effect.runPromise(
          chatWithAIAgentCommand(agentId).pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error chatting with AI agent:", error);
              }),
            ),
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
          }).pipe(Effect.provide(createAppLayer())),
        );
      });

    automationCommand
      .command("create")
      .description("Create a new automation")
      .option("-d, --description <description>", "Automation description")
      .action((name: string, options: { description?: string }) => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info(`Creating automation: ${name}`);
            if (options.description) {
              yield* logger.info(`Description: ${options.description}`);
            }
            // TODO: Implement automation creation
          }).pipe(Effect.provide(createAppLayer())),
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
          }).pipe(Effect.provide(createAppLayer())),
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
          }).pipe(Effect.provide(createAppLayer())),
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
          }).pipe(Effect.provide(createAppLayer())),
        );
      });

    // Auth commands
    const authCommand = program.command("auth").description("Manage authentication");
    const gmailAuthCommand = authCommand
      .command("gmail")
      .description("Gmail authentication commands");

    gmailAuthCommand
      .command("login")
      .description("Authenticate with Gmail")
      .action(() => {
        void Effect.runPromise(
          gmailLoginCommand().pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error during Gmail login:", error);
              }),
            ),
          ),
        );
      });

    gmailAuthCommand
      .command("logout")
      .description("Logout from Gmail")
      .action(() => {
        void Effect.runPromise(
          gmailLogoutCommand().pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error during Gmail logout:", error);
              }),
            ),
          ),
        );
      });

    gmailAuthCommand
      .command("status")
      .description("Check Gmail authentication status")
      .action(() => {
        void Effect.runPromise(
          gmailStatusCommand().pipe(
            Effect.provide(createAppLayer()),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error("❌ Error checking Gmail status:", error);
              }),
            ),
          ),
        );
      });

    // Logs command
    program
      .command("logs")
      .description("View logs")
      .option("-f, --follow", "Follow log output")
      .option("-l, --level <level>", "Filter by log level", "info")
      .action((options: { follow?: boolean; level: string }) => {
        void Effect.runPromise(
          Effect.gen(function* () {
            const logger = yield* LoggerServiceTag;
            yield* logger.info("Viewing logs...");
            if (options.follow) {
              yield* logger.info("Following log output");
            }
            yield* logger.info(`Log level: ${options.level}`);
            // TODO: Implement log viewing
          }).pipe(Effect.provide(createAppLayer())),
        );
      });

    program.parse();
  });
}

Effect.runPromise(main()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
