# API Reference

Complete reference for Jazz's internal APIs, service interfaces, and type definitions.

## 📋 Overview

This document provides detailed information about Jazz's internal APIs, including:

- Service interfaces and implementations
- Type definitions and schemas
- Error types and handling
- Effect-TS patterns and utilities

## 🏗️ Core Types

### Agent Types

#### Agent Interface

```typescript
interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly config: AgentConfig;
  readonly status: AgentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

#### Agent Configuration

```typescript
interface AgentConfig {
  readonly tasks: readonly Task[];
  readonly schedule?: Schedule;
  readonly retryPolicy?: RetryPolicy;
  readonly timeout?: number;
  readonly environment?: Record<string, string>;
}
```

#### Agent Status

```typescript
type AgentStatus = "idle" | "running" | "paused" | "error" | "completed";
```

### Task Types

#### Task Interface

```typescript
interface Task {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: TaskType;
  readonly config: TaskConfig;
  readonly dependencies?: readonly string[];
  readonly retryCount?: number;
  readonly maxRetries?: number;
}
```

#### Task Types

```typescript
type TaskType = "command" | "script" | "api" | "file" | "webhook" | "custom";
```

#### Task Configuration

```typescript
interface TaskConfig {
  readonly command?: string;
  readonly script?: string;
  readonly url?: string;
  readonly method?: "GET" | "POST" | "PUT" | "DELETE";
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly filePath?: string;
  readonly workingDirectory?: string;
  readonly environment?: Record<string, string>;
}
```

### Automation Types

#### Automation Interface

```typescript
interface Automation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly agents: readonly string[];
  readonly triggers: readonly Trigger[];
  readonly status: AutomationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

#### Trigger Interface

```typescript
interface Trigger {
  readonly id: string;
  readonly type: TriggerType;
  readonly config: TriggerConfig;
  readonly enabled: boolean;
}
```

#### Trigger Types

```typescript
type TriggerType = "schedule" | "file" | "webhook" | "manual" | "event";
```

### Result Types

#### Task Result

```typescript
interface TaskResult {
  readonly taskId: string;
  readonly status: "success" | "failure" | "skipped";
  readonly output?: string;
  readonly error?: string;
  readonly duration: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
```

#### Agent Result

```typescript
interface AgentResult {
  readonly agentId: string;
  readonly status: "success" | "failure" | "partial";
  readonly taskResults: readonly TaskResult[];
  readonly duration: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
```

## 🔧 Service Interfaces

### Agent Service

#### Interface

```typescript
export interface AgentService {
  readonly createAgent: (
    name: string,
    description: string,
    config?: Partial<AgentConfig>,
  ) => Effect.Effect<Agent, AgentError>;

  readonly getAgent: (
    id: string,
  ) => Effect.Effect<Agent, StorageError | StorageNotFoundError>;
  readonly listAgents: () => Effect.Effect<readonly Agent[], StorageError>;
  readonly updateAgent: (
    id: string,
    updates: Partial<Agent>,
  ) => Effect.Effect<Agent, StorageError | StorageNotFoundError>;
  readonly deleteAgent: (
    id: string,
  ) => Effect.Effect<void, StorageError | StorageNotFoundError>;
  readonly validateAgentConfig: (
    config: AgentConfig,
  ) => Effect.Effect<void, AgentConfigurationError>;
}
```

#### Implementation

```typescript
export class DefaultAgentService implements AgentService {
  constructor(private readonly storage: StorageService) {}

  createAgent(
    name: string,
    description: string,
    config: Partial<AgentConfig> = {},
  ): Effect.Effect<Agent, AgentError> {
    return Effect.gen(
      function* (this: DefaultAgentService) {
        // Validation
        yield* validateAgentName(name);
        yield* validateAgentDescription(description);

        // Generate ID and create agent
        const id = crypto.randomUUID();
        const agent: Agent = {
          id,
          name,
          description,
          config: { ...defaultConfig, ...config },
          status: "idle",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Save and return
        yield* this.storage.saveAgent(agent);
        return agent;
      }.bind(this),
    );
  }

  // ... other methods
}
```

#### Usage

```typescript
// Create agent service layer
const agentServiceLayer = createAgentServiceLayer();

// Use in Effect
const createAgent = (name: string, description: string) =>
  Effect.gen(function* () {
    const agentService = yield* AgentService;
    return yield* agentService.createAgent(name, description);
  });
```

### Storage Service

#### Interface

```typescript
export interface StorageService {
  readonly saveAgent: (agent: Agent) => Effect.Effect<void, StorageError>;
  readonly getAgent: (
    id: string,
  ) => Effect.Effect<Agent, StorageError | StorageNotFoundError>;
  readonly listAgents: () => Effect.Effect<readonly Agent[], StorageError>;
  readonly deleteAgent: (
    id: string,
  ) => Effect.Effect<void, StorageError | StorageNotFoundError>;

  readonly saveAutomation: (
    automation: Automation,
  ) => Effect.Effect<void, StorageError>;
  readonly getAutomation: (
    id: string,
  ) => Effect.Effect<Automation, StorageError | StorageNotFoundError>;
  readonly listAutomations: () => Effect.Effect<
    readonly Automation[],
    StorageError
  >;
  readonly deleteAutomation: (
    id: string,
  ) => Effect.Effect<void, StorageError | StorageNotFoundError>;

  readonly saveTaskResult: (
    result: TaskResult,
  ) => Effect.Effect<void, StorageError>;
  readonly getTaskResults: (
    taskId: string,
  ) => Effect.Effect<readonly TaskResult[], StorageError>;
  readonly saveAgentResult: (
    result: AgentResult,
  ) => Effect.Effect<void, StorageError>;
  readonly getAgentResults: (
    agentId: string,
  ) => Effect.Effect<readonly AgentResult[], StorageError>;
}
```

#### File Storage Implementation

```typescript
export class FileStorageService implements StorageService {
  constructor(
    private readonly basePath: string,
    private readonly fs: FileSystem.FileSystem,
  ) {}

  saveAgent(agent: Agent): Effect.Effect<void, StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const dir = this.getAgentsDir();
        yield* this.ensureDirectoryExists(dir);
        const path = this.getAgentPath(agent.id);
        yield* this.writeJsonFile(path, agent);
      }.bind(this),
    );
  }

  getAgent(
    id: string,
  ): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
    const path = this.getAgentPath(id);
    return this.readJsonFile<Agent>(path);
  }

  // ... other methods
}
```

#### In-Memory Storage Implementation

```typescript
export class InMemoryStorageService implements StorageService {
  constructor(
    private readonly agents: Ref.Ref<Map<string, Agent>>,
    private readonly automations: Ref.Ref<Map<string, Automation>>,
    private readonly taskResults: Ref.Ref<Map<string, TaskResult[]>>,
    private readonly agentResults: Ref.Ref<Map<string, AgentResult[]>>,
  ) {}

  saveAgent(agent: Agent): Effect.Effect<void, StorageError> {
    return Ref.update(this.agents, (map) => new Map(map.set(agent.id, agent)));
  }

  getAgent(
    id: string,
  ): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.agents), (agents) => {
      const agent = agents.get(id);
      if (!agent) {
        return Effect.fail(new StorageNotFoundError({ path: `agent:${id}` }));
      }
      return Effect.succeed(agent);
    });
  }

  // ... other methods
}
```

### Logger Service

#### Interface

```typescript
export interface LoggerService {
  readonly debug: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void>;
  readonly info: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void>;
  readonly warn: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void>;
  readonly error: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void>;
}
```

#### Implementation

```typescript
export class LoggerServiceImpl implements LoggerService {
  constructor(_config: AppConfig) {
    void _config;
  }

  debug(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logDebug(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logInfo(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logWarning(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logError(message, meta);
  }
}
```

### Configuration Service

#### Interface

```typescript
export interface ConfigService {
  readonly get: <A>(key: string) => Effect.Effect<A, never>;
  readonly getOrElse: <A>(key: string, fallback: A) => Effect.Effect<A, never>;
  readonly getOrFail: <A>(key: string) => Effect.Effect<A, never>;
  readonly has: (key: string) => Effect.Effect<boolean, never>;
  readonly set: <A>(key: string, value: A) => Effect.Effect<void, never>;
  readonly appConfig: Effect.Effect<AppConfig, never>;
}
```

## ❌ Error Types

### Storage Errors

```typescript
export class StorageError extends Data.TaggedError("StorageError")<{
  readonly operation: string;
  readonly path: string;
  readonly reason: string;
}> {}

export class StorageNotFoundError extends Data.TaggedError(
  "StorageNotFoundError",
)<{
  readonly path: string;
}> {}
```

### Agent Errors

```typescript
export class AgentNotFoundError extends Data.TaggedError("AgentNotFoundError")<{
  readonly agentId: string;
}> {}

export class AgentAlreadyExistsError extends Data.TaggedError(
  "AgentAlreadyExistsError",
)<{
  readonly agentId: string;
}> {}

export class AgentConfigurationError extends Data.TaggedError(
  "AgentConfigurationError",
)<{
  readonly agentId: string;
  readonly field: string;
  readonly message: string;
}> {}
```

### Validation Errors

```typescript
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
  readonly value: unknown;
}> {}
```

### Error Handling Patterns

```typescript
// Error handling in Effect
const result =
  yield *
  someOperation.pipe(
    Effect.catchAll((error) => {
      if (error._tag === "StorageError") {
        return Effect.fail(
          new CustomError({ message: "Storage operation failed" }),
        );
      }
      return Effect.fail(error);
    }),
  );

// Error recovery
const result =
  yield *
  someOperation.pipe(
    Effect.retry(Schedule.exponential("100 millis")),
    Effect.catchAll(() => Effect.succeed(defaultValue)),
  );
```

## 🔄 Effect-TS Patterns

### Effect.gen Usage

```typescript
// Async workflow composition
function createAgent(
  name: string,
  description: string,
): Effect.Effect<Agent, AgentError, AgentService> {
  return Effect.gen(function* () {
    const agentService = yield* AgentService;
    const agent = yield* agentService.createAgent(name, description);
    yield* logAgentOperation(agent.id, "created");
    return agent;
  });
}
```

### Layer Composition

```typescript
// Service layer creation
export function createAgentServiceLayer(): Layer.Layer<
  AgentService,
  never,
  StorageService
> {
  return Layer.effect(
    AgentService,
    Effect.gen(function* () {
      const storage = yield* StorageService;
      return new DefaultAgentService(storage);
    }),
  );
}

// Application layer composition
function createAppLayer(config: AppConfig) {
  const baseLayer = Layer.mergeAll(
    createConfigLayer(),
    createLoggerLayer(config),
    NodeFileSystem.layer,
  );

  const storageLayer = createFileStorageLayer(
    config.storage.path || "./data",
  ).pipe(Layer.provide(baseLayer));

  return Layer.mergeAll(
    baseLayer,
    storageLayer,
    createAgentServiceLayer(),
  ).pipe(Layer.provide(Layer.mergeAll(baseLayer, storageLayer)));
}
```

### Context Usage

```typescript
// Service tags
export const AgentService = Context.GenericTag<AgentService>("AgentService");
export const StorageService =
  Context.GenericTag<StorageService>("StorageService");
export const LoggerService = Context.GenericTag<LoggerService>("LoggerService");

// Service usage
const operation = Effect.gen(function* () {
  const agentService = yield* AgentService;
  const logger = yield* LoggerService;

  yield* logger.info("Starting operation");
  const result = yield* agentService.createAgent("test", "Test agent");
  yield* logger.info("Operation completed", { agentId: result.id });

  return result;
});
```

### Error Handling

```typescript
// Tagged error creation
export class CustomError extends Data.TaggedError("CustomError")<{
  readonly message: string;
  readonly code: number;
}> {}

// Error handling
const result =
  yield *
  someOperation.pipe(
    Effect.catchAll((error) => {
      if (error._tag === "StorageError") {
        return Effect.fail(
          new CustomError({
            message: "Storage operation failed",
            code: 500,
          }),
        );
      }
      return Effect.fail(error);
    }),
  );
```

## 📊 Schema Definitions

### Agent Schema

```typescript
export const AgentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  config: Schema.Struct({
    tasks: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        description: Schema.String,
        type: Schema.Literal(
          "command",
          "script",
          "api",
          "file",
          "webhook",
          "custom",
        ),
        config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
        dependencies: Schema.optional(Schema.Array(Schema.String)),
        retryCount: Schema.optional(Schema.Number),
        maxRetries: Schema.optional(Schema.Number),
      }),
    ),
    schedule: Schema.optional(
      Schema.Struct({
        type: Schema.Literal("cron", "interval", "once"),
        value: Schema.Union(Schema.String, Schema.Number),
        timezone: Schema.optional(Schema.String),
        enabled: Schema.Boolean,
      }),
    ),
    retryPolicy: Schema.optional(
      Schema.Struct({
        maxRetries: Schema.Number,
        backoff: Schema.Literal("linear", "exponential", "fixed"),
        delay: Schema.Number,
        maxDelay: Schema.optional(Schema.Number),
      }),
    ),
    timeout: Schema.optional(Schema.Number),
    environment: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.String }),
    ),
  }),
  status: Schema.Literal("idle", "running", "paused", "error", "completed"),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
```

### Task Schema

```typescript
export const TaskSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  type: Schema.Literal("command", "script", "api", "file", "webhook", "custom"),
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  dependencies: Schema.optional(Schema.Array(Schema.String)),
  retryCount: Schema.optional(Schema.Number),
  maxRetries: Schema.optional(Schema.Number),
});
```

### Schema Validation

```typescript
// Validate data against schema
const validateAgent = (
  data: unknown,
): Effect.Effect<Agent, ValidationError> => {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(AgentSchema)(data),
    catch: (error) =>
      new ValidationError({
        field: "agent",
        message: `Invalid agent structure: ${error}`,
        value: data,
      }),
  });
};
```

## 🛠️ Utility Functions

### Helper Functions

```typescript
// Agent operations
export function createAgent(
  name: string,
  description: string,
  config?: Partial<AgentConfig>,
): Effect.Effect<Agent, AgentError, AgentService> {
  return Effect.gen(function* () {
    const agentService = yield* AgentService;
    return yield* agentService.createAgent(name, description, config);
  });
}

export function getAgentById(
  id: string,
): Effect.Effect<Agent, StorageError | StorageNotFoundError, AgentService> {
  return Effect.gen(function* () {
    const agentService = yield* AgentService;
    return yield* agentService.getAgent(id);
  });
}

export function listAllAgents(): Effect.Effect<
  readonly Agent[],
  StorageError,
  AgentService
> {
  return Effect.gen(function* () {
    const agentService = yield* AgentService;
    return yield* agentService.listAgents();
  });
}

// Storage operations
export function saveAgent(
  agent: Agent,
): Effect.Effect<void, StorageError, StorageService> {
  return Effect.gen(function* () {
    const storage = yield* StorageService;
    yield* storage.saveAgent(agent);
  });
}

// Logging operations
export function logAgentOperation(
  agentId: string,
  operation: string,
  meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerService;
    yield* logger.info(`Agent ${agentId}: ${operation}`, {
      agentId,
      operation,
      ...meta,
    });
  });
}
```

### Validation Functions

```typescript
// Input validation
function validateAgentName(name: string): Effect.Effect<void, ValidationError> {
  if (!name || name.trim().length === 0) {
    return Effect.fail(
      new ValidationError({
        field: "name",
        message: "Agent name cannot be empty",
        value: name,
      }),
    );
  }

  if (name.length > 100) {
    return Effect.fail(
      new ValidationError({
        field: "name",
        message: "Agent name cannot exceed 100 characters",
        value: name,
      }),
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return Effect.fail(
      new ValidationError({
        field: "name",
        message:
          "Agent name can only contain letters, numbers, underscores, and hyphens",
        value: name,
      }),
    );
  }

  return Effect.void;
}
```

## 🔧 CLI Integration

### Command Handlers

```typescript
// CLI command implementation
export function createAgentCommand(
  name: string,
  description: string,
  options: AgentOptions,
): Effect.Effect<void, AgentError, AgentService> {
  return Effect.gen(function* () {
    const agentService = yield* AgentService;

    const config: Partial<AgentConfig> = {};
    if (options.timeout) {
      config.timeout = options.timeout;
    }

    const agent = yield* agentService.createAgent(name, description, config);

    console.log(`✅ Agent created successfully!`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Description: ${agent.description}`);
    console.log(`   Status: ${agent.status}`);
  });
}
```

### Error Handling in CLI

```typescript
// CLI error handling
const runCommand = (command: Effect.Effect<void, Error>) => {
  Effect.runPromise(
    command.pipe(
      Effect.catchAll((error) => {
        if (error._tag === "StorageError") {
          console.error(`❌ Storage error: ${error.reason}`);
        } else if (error._tag === "AgentNotFoundError") {
          console.error(`❌ Agent with ID "${error.agentId}" not found`);
        } else {
          console.error("❌ Error:", error);
        }
        return Effect.void;
      }),
    ),
  );
};
```

## 📚 Related Documentation

- [Architecture Overview](architecture.md) - System architecture and design
- [CLI Reference](cli-reference.md) - Command-line interface
- [Agent Development](agent-development.md) - Agent creation and management
- [Task Types](task-types.md) - Task type definitions and usage
- [Configuration](configuration.md) - Configuration options and file format
