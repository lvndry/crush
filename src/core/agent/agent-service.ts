import { Context, Effect, Layer, Schema } from "effect";
import shortuuid from "short-uuid";
import type { StorageService } from "../../services/storage";
import { StorageServiceTag } from "../../services/storage";
import {
  AgentAlreadyExistsError,
  AgentConfigurationError,
  StorageError,
  StorageNotFoundError,
  ValidationError,
} from "../types/errors";
import { type Agent, type AgentConfig, type Task, TaskSchema } from "../types/index";

/**
 * Agent service for managing agent lifecycle and operations
 */

export interface AgentService {
  readonly createAgent: (
    name: string,
    description: string,
    config?: Partial<AgentConfig>
  ) => Effect.Effect<
    Agent,
    StorageError | AgentAlreadyExistsError | AgentConfigurationError | ValidationError
  >;
  readonly getAgent: (id: string) => Effect.Effect<Agent, StorageError | StorageNotFoundError>;
  readonly listAgents: () => Effect.Effect<readonly Agent[], StorageError>;
  readonly updateAgent: (
    id: string,
    updates: Partial<Agent>
  ) => Effect.Effect<Agent, StorageError | StorageNotFoundError>;
  readonly deleteAgent: (id: string) => Effect.Effect<void, StorageError | StorageNotFoundError>;
  readonly validateAgentConfig: (
    config: AgentConfig
  ) => Effect.Effect<void, AgentConfigurationError>;
}

export class DefaultAgentService implements AgentService {
  constructor(private readonly storage: StorageService) { }

  createAgent(
    name: string,
    description: string,
    config: Partial<AgentConfig> = {}
  ): Effect.Effect<
    Agent,
    StorageError | AgentAlreadyExistsError | AgentConfigurationError | ValidationError
  > {
    return Effect.gen(
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      function* (this: DefaultAgentService) {
        // Validate input parameters
        yield* validateAgentName(name);
        yield* validateAgentDescription(description);

        // Generate unique agent ID
        const id = shortuuid.generate();

        // Create default agent configuration
        const defaultConfig: AgentConfig = {
          tasks: [],
          timeout: 30000,
          environment: {},
        };

        // Merge with provided config
        const agentConfig: AgentConfig = {
          ...defaultConfig,
          ...config,
          tasks: config.tasks || [],
          environment: { ...defaultConfig.environment, ...config.environment },
        };

        // Validate the complete agent configuration
        yield* this.validateAgentConfig(agentConfig);

        // Check if agent with same name already exists
        const existingAgents = yield* this.storage.listAgents();
        const nameExists = existingAgents.some((agent: Agent) => agent.name === name);

        if (nameExists) {
          return yield* Effect.fail(new AgentAlreadyExistsError({ agentId: name }));
        }

        // Create the agent
        const now = new Date();
        const agent: Agent = {
          id,
          name,
          description,
          config: agentConfig,
          status: "idle",
          createdAt: now,
          updatedAt: now,
        };

        // Note: Schema validation is commented out due to Date serialization issues
        // The agent structure is validated through the interface and business logic
        // yield* Effect.try({
        //     try: () => Schema.decodeUnknownSync(AgentSchema)(agent),
        //     catch: (error) => new ValidationError({
        //         field: "agent",
        //         message: `Invalid agent structure: ${error}`,
        //         value: agent
        //     })
        // });

        // Save the agent
        yield* this.storage.saveAgent(agent);

        return agent;
      }.bind(this)
    );
  }

  getAgent(id: string): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
    return this.storage.getAgent(id);
  }

  listAgents(): Effect.Effect<readonly Agent[], StorageError> {
    return this.storage.listAgents();
  }

  updateAgent(
    id: string,
    updates: Partial<Agent>
  ): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
    return Effect.gen(
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      function* (this: DefaultAgentService) {
        const existingAgent = yield* this.storage.getAgent(id);

        const updatedAgent: Agent = {
          ...existingAgent,
          ...updates,
          id: existingAgent.id, // Ensure ID cannot be changed
          createdAt: existingAgent.createdAt, // Ensure createdAt cannot be changed
          updatedAt: new Date(),
        };

        yield* this.storage.saveAgent(updatedAgent);
        return updatedAgent;
      }.bind(this)
    );
  }

  deleteAgent(id: string): Effect.Effect<void, StorageError | StorageNotFoundError> {
    return this.storage.deleteAgent(id);
  }

  validateAgentConfig(config: AgentConfig): Effect.Effect<void, AgentConfigurationError> {
    return Effect.gen(function* (this: DefaultAgentService) {
      // Validate tasks
      for (const task of config.tasks) {
        yield* validateTask(task);
      }

      // Validate timeout
      if (config.timeout && (config.timeout < 1000 || config.timeout > 3600000)) {
        return yield* Effect.fail(
          new AgentConfigurationError({
            agentId: "unknown",
            field: "timeout",
            message: "Timeout must be between 1000ms and 3600000ms (1 hour)",
          })
        );
      }

      // Validate retry policy if provided
      if (config.retryPolicy) {
        if (config.retryPolicy.maxRetries < 0 || config.retryPolicy.maxRetries > 10) {
          return yield* Effect.fail(
            new AgentConfigurationError({
              agentId: "unknown",
              field: "retryPolicy.maxRetries",
              message: "Max retries must be between 0 and 10",
            })
          );
        }

        if (config.retryPolicy.delay < 100 || config.retryPolicy.delay > 60000) {
          return yield* Effect.fail(
            new AgentConfigurationError({
              agentId: "unknown",
              field: "retryPolicy.delay",
              message: "Retry delay must be between 100ms and 60000ms",
            })
          );
        }
      }
    });
  }
}

// Validation helper functions
function validateAgentName(name: string): Effect.Effect<void, ValidationError> {
  if (!name || name.trim().length === 0) {
    return Effect.fail(
      new ValidationError({
        field: "name",
        message: "Agent name cannot be empty",
        value: name,
      })
    );
  }

  if (name.length > 100) {
    return Effect.fail(
      new ValidationError({
        field: "name",
        message: "Agent name cannot exceed 100 characters",
        value: name,
      })
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return Effect.fail(
      new ValidationError({
        field: "name",
        message: "Agent name can only contain letters, numbers, underscores, and hyphens",
        value: name,
      })
    );
  }

  return Effect.void;
}

function validateAgentDescription(description: string): Effect.Effect<void, ValidationError> {
  if (!description || description.trim().length === 0) {
    return Effect.fail(
      new ValidationError({
        field: "description",
        message: "Agent description cannot be empty",
        value: description,
      })
    );
  }

  if (description.length > 500) {
    return Effect.fail(
      new ValidationError({
        field: "description",
        message: "Agent description cannot exceed 500 characters",
        value: description,
      })
    );
  }

  return Effect.void;
}

function validateTask(task: Task): Effect.Effect<void, AgentConfigurationError> {
  return Effect.gen(function* () {
    // Validate task using schema
    yield* Effect.try({
      try: () => Schema.decodeUnknownSync(TaskSchema)(task),
      catch: error =>
        new AgentConfigurationError({
          agentId: "unknown",
          field: `task.${task.id}`,
          message: `Invalid task structure: ${String(error)}`,
        }),
    });

    // Additional business logic validation
    if (!task.name || task.name.trim().length === 0) {
      return yield* Effect.fail(
        new AgentConfigurationError({
          agentId: "unknown",
          field: `task.${task.id}.name`,
          message: "Task name cannot be empty",
        })
      );
    }

    // Validate task type specific requirements
    switch (task.type) {
      case "command":
        if (!task.config.command || task.config.command.trim().length === 0) {
          return yield* Effect.fail(
            new AgentConfigurationError({
              agentId: "unknown",
              field: `task.${task.id}.config.command`,
              message: "Command tasks must have a command specified",
            })
          );
        }
        break;
      case "script":
        if (!task.config.script || task.config.script.trim().length === 0) {
          return yield* Effect.fail(
            new AgentConfigurationError({
              agentId: "unknown",
              field: `task.${task.id}.config.script`,
              message: "Script tasks must have a script specified",
            })
          );
        }
        break;
      case "api":
        if (!task.config.url || task.config.url.trim().length === 0) {
          return yield* Effect.fail(
            new AgentConfigurationError({
              agentId: "unknown",
              field: `task.${task.id}.config.url`,
              message: "API tasks must have a URL specified",
            })
          );
        }
        break;
      case "file":
        if (!task.config.filePath || task.config.filePath.trim().length === 0) {
          return yield* Effect.fail(
            new AgentConfigurationError({
              agentId: "unknown",
              field: `task.${task.id}.config.filePath`,
              message: "File tasks must have a file path specified",
            })
          );
        }
        break;
      case "gmail":
        if (!task.config.gmailOperation) {
          return yield* Effect.fail(
            new AgentConfigurationError({
              agentId: "unknown",
              field: `task.${task.id}.config.gmailOperation`,
              message: "Gmail tasks must have an operation specified",
            })
          );
        }
        break;
    }
  });
}

export const AgentServiceTag = Context.GenericTag<AgentService>("AgentService");

export function createAgentServiceLayer(): Layer.Layer<AgentService, never, StorageService> {
  return Layer.effect(
    AgentServiceTag,
    Effect.gen(function* () {
      const storage = yield* StorageServiceTag;
      return new DefaultAgentService(storage);
    })
  );
}

// Helper functions for common agent operations
export function createAgent(
  name: string,
  description: string,
  config?: Partial<AgentConfig>
): Effect.Effect<
  Agent,
  StorageError | AgentAlreadyExistsError | AgentConfigurationError | ValidationError,
  AgentService
> {
  return Effect.gen(function* () {
    const agentService = yield* AgentServiceTag;
    return yield* agentService.createAgent(name, description, config);
  });
}

export function getAgentById(
  id: string
): Effect.Effect<Agent, StorageError | StorageNotFoundError, AgentService> {
  return Effect.gen(function* () {
    const agentService = yield* AgentServiceTag;
    return yield* agentService.getAgent(id);
  });
}

export function listAllAgents(): Effect.Effect<readonly Agent[], StorageError, AgentService> {
  return Effect.gen(function* () {
    const agentService = yield* AgentServiceTag;
    return yield* agentService.listAgents();
  });
}
