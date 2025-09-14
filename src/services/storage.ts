import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer, Ref } from "effect";
import { StorageError, StorageNotFoundError } from "../core/types/errors";
import type { Agent, AgentResult, Automation, TaskResult } from "../core/types/index";

/**
 * Storage service for persisting agents, automations, and results
 */

export interface StorageService {
  readonly saveAgent: (agent: Agent) => Effect.Effect<void, StorageError>;
  readonly getAgent: (id: string) => Effect.Effect<Agent, StorageError | StorageNotFoundError>;
  readonly listAgents: () => Effect.Effect<readonly Agent[], StorageError>;
  readonly deleteAgent: (id: string) => Effect.Effect<void, StorageError | StorageNotFoundError>;
  readonly saveAutomation: (automation: Automation) => Effect.Effect<void, StorageError>;
  readonly getAutomation: (
    id: string,
  ) => Effect.Effect<Automation, StorageError | StorageNotFoundError>;
  readonly listAutomations: () => Effect.Effect<readonly Automation[], StorageError>;
  readonly deleteAutomation: (
    id: string,
  ) => Effect.Effect<void, StorageError | StorageNotFoundError>;
  readonly saveTaskResult: (result: TaskResult) => Effect.Effect<void, StorageError>;
  readonly getTaskResults: (taskId: string) => Effect.Effect<readonly TaskResult[], StorageError>;
  readonly saveAgentResult: (result: AgentResult) => Effect.Effect<void, StorageError>;
  readonly getAgentResults: (
    agentId: string,
  ) => Effect.Effect<readonly AgentResult[], StorageError>;
}

// In-memory storage implementation for development
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

  getAgent(id: string): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.agents), (agents) => {
      const agent = agents.get(id);
      if (!agent) {
        return Effect.fail(new StorageNotFoundError({ path: `agent:${id}` }));
      }
      return Effect.succeed(agent);
    });
  }

  listAgents(): Effect.Effect<readonly Agent[], StorageError> {
    return Effect.map(Ref.get(this.agents), (agents) => Array.from(agents.values()));
  }

  deleteAgent(id: string): Effect.Effect<void, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.agents), (agents) => {
      if (!agents.has(id)) {
        return Effect.fail(new StorageNotFoundError({ path: `agent:${id}` }));
      }
      return Ref.update(this.agents, (map) => {
        const newMap = new Map(map);
        newMap.delete(id);
        return newMap;
      });
    });
  }

  saveAutomation(automation: Automation): Effect.Effect<void, StorageError> {
    return Ref.update(this.automations, (map) => new Map(map.set(automation.id, automation)));
  }

  getAutomation(id: string): Effect.Effect<Automation, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.automations), (automations) => {
      const automation = automations.get(id);
      if (!automation) {
        return Effect.fail(new StorageNotFoundError({ path: `automation:${id}` }));
      }
      return Effect.succeed(automation);
    });
  }

  listAutomations(): Effect.Effect<readonly Automation[], StorageError> {
    return Effect.map(Ref.get(this.automations), (automations) => Array.from(automations.values()));
  }

  deleteAutomation(id: string): Effect.Effect<void, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.automations), (automations) => {
      if (!automations.has(id)) {
        return Effect.fail(new StorageNotFoundError({ path: `automation:${id}` }));
      }
      return Ref.update(this.automations, (map) => {
        const newMap = new Map(map);
        newMap.delete(id);
        return newMap;
      });
    });
  }

  saveTaskResult(result: TaskResult): Effect.Effect<void, StorageError> {
    return Ref.update(this.taskResults, (map) => {
      const newMap = new Map(map);
      const existing = newMap.get(result.taskId) || [];
      newMap.set(result.taskId, [...existing, result]);
      return newMap;
    });
  }

  getTaskResults(taskId: string): Effect.Effect<readonly TaskResult[], StorageError> {
    return Effect.map(Ref.get(this.taskResults), (results) => results.get(taskId) || []);
  }

  saveAgentResult(result: AgentResult): Effect.Effect<void, StorageError> {
    return Ref.update(this.agentResults, (map) => {
      const newMap = new Map(map);
      const existing = newMap.get(result.agentId) || [];
      newMap.set(result.agentId, [...existing, result]);
      return newMap;
    });
  }

  getAgentResults(agentId: string): Effect.Effect<readonly AgentResult[], StorageError> {
    return Effect.map(Ref.get(this.agentResults), (results) => results.get(agentId) || []);
  }
}

export const StorageServiceTag = Context.GenericTag<StorageService>("StorageService");

export function createInMemoryStorageLayer(): Layer.Layer<StorageService> {
  return Layer.effect(
    StorageServiceTag,
    Effect.gen(function* () {
      const agents = yield* Ref.make(new Map<string, Agent>());
      const automations = yield* Ref.make(new Map<string, Automation>());
      const taskResults = yield* Ref.make(new Map<string, TaskResult[]>());
      const agentResults = yield* Ref.make(new Map<string, AgentResult[]>());

      return new InMemoryStorageService(agents, automations, taskResults, agentResults);
    }),
  );
}

// Helper functions for common storage operations
export function saveAgent(agent: Agent): Effect.Effect<void, StorageError, StorageService> {
  return Effect.gen(function* () {
    const storage = yield* StorageServiceTag;
    yield* storage.saveAgent(agent);
  });
}

export function getAgent(
  id: string,
): Effect.Effect<Agent, StorageError | StorageNotFoundError, StorageService> {
  return Effect.gen(function* () {
    const storage = yield* StorageServiceTag;
    return yield* storage.getAgent(id);
  });
}

export function listAgents(): Effect.Effect<readonly Agent[], StorageError, StorageService> {
  return Effect.gen(function* () {
    const storage = yield* StorageServiceTag;
    return yield* storage.listAgents();
  });
}

export function saveAutomation(
  automation: Automation,
): Effect.Effect<void, StorageError, StorageService> {
  return Effect.gen(function* () {
    const storage = yield* StorageServiceTag;
    yield* storage.saveAutomation(automation);
  });
}

export function getAutomation(
  id: string,
): Effect.Effect<Automation, StorageError | StorageNotFoundError, StorageService> {
  return Effect.gen(function* () {
    const storage = yield* StorageServiceTag;
    return yield* storage.getAutomation(id);
  });
}

export function listAutomations(): Effect.Effect<
  readonly Automation[],
  StorageError,
  StorageService
> {
  return Effect.gen(function* () {
    const storage = yield* StorageServiceTag;
    return yield* storage.listAutomations();
  });
}

// File-based storage implementation for persistent CLI usage
export class FileStorageService implements StorageService {
  constructor(
    private readonly basePath: string,
    private readonly fs: FileSystem.FileSystem,
  ) {}

  private getAgentPath(id: string): string {
    return `${this.basePath}/agents/${id}.json`;
  }

  private getAgentsDir(): string {
    return `${this.basePath}/agents`;
  }

  private getAutomationPath(id: string): string {
    return `${this.basePath}/automations/${id}.json`;
  }

  private getAutomationsDir(): string {
    return `${this.basePath}/automations`;
  }

  private getTaskResultsPath(taskId: string): string {
    return `${this.basePath}/task-results/${taskId}.json`;
  }

  private getTaskResultsDir(): string {
    return `${this.basePath}/task-results`;
  }

  private getAgentResultsPath(agentId: string): string {
    return `${this.basePath}/agent-results/${agentId}.json`;
  }

  private getAgentResultsDir(): string {
    return `${this.basePath}/agent-results`;
  }

  private ensureDirectoryExists(path: string): Effect.Effect<void, StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        yield* this.fs.makeDirectory(path, { recursive: true }).pipe(
          Effect.mapError(
            (error) =>
              new StorageError({
                operation: "mkdir",
                path,
                reason: `Failed to create directory: ${String(error)}`,
              }),
          ),
          Effect.catchAll(() => Effect.void), // Ignore if directory already exists
        );
      }.bind(this),
    );
  }

  private readJsonFile<T>(path: string): Effect.Effect<T, StorageError | StorageNotFoundError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const content = yield* this.fs.readFileString(path).pipe(
          Effect.mapError(
            (error) =>
              new StorageError({
                operation: "read",
                path,
                reason: `Failed to read file: ${String(error.message)}`,
              }),
          ),
        );
        return JSON.parse(content) as T;
      }.bind(this),
    );
  }

  private writeJsonFile<T>(path: string, data: T): Effect.Effect<void, StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const content = JSON.stringify(data, null, 2);
        yield* this.fs.writeFileString(path, content).pipe(
          Effect.mapError(
            (error) =>
              new StorageError({
                operation: "write",
                path,
                reason: `Failed to write file: ${String(error)}`,
              }),
          ),
        );
      }.bind(this),
    );
  }

  private listJsonFiles(dir: string): Effect.Effect<readonly string[], StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        yield* this.ensureDirectoryExists(dir);
        const files = yield* this.fs.readDirectory(dir).pipe(
          Effect.mapError(
            (error) =>
              new StorageError({
                operation: "list",
                path: dir,
                reason: `Failed to list directory: ${String(error)}`,
              }),
          ),
        );
        return files.filter((file: string) => file.endsWith(".json"));
      }.bind(this),
    );
  }

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

  getAgent(id: string): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
    const path = this.getAgentPath(id);
    return this.readJsonFile<Agent>(path);
  }

  listAgents(): Effect.Effect<readonly Agent[], StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const dir = this.getAgentsDir();
        const files = yield* this.listJsonFiles(dir);

        const agents: Agent[] = [];
        for (const file of files) {
          const path = `${dir}/${file}`;
          const agent = yield* this.readJsonFile<Agent>(path).pipe(
            Effect.catchAll(() => Effect.void), // Skip corrupted files
          );
          if (agent) {
            agents.push(agent);
          }
        }

        return agents;
      }.bind(this),
    );
  }

  deleteAgent(id: string): Effect.Effect<void, StorageError | StorageNotFoundError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const path = this.getAgentPath(id);
        yield* this.fs.remove(path).pipe(
          Effect.mapError((error) => {
            if (error instanceof Error && error.message.includes("ENOENT")) {
              return new StorageNotFoundError({ path });
            }
            return new StorageError({
              operation: "delete",
              path,
              reason: `Failed to delete file: ${String(error)}`,
            });
          }),
        );
      }.bind(this),
    );
  }

  saveAutomation(automation: Automation): Effect.Effect<void, StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const dir = this.getAutomationsDir();
        yield* this.ensureDirectoryExists(dir);
        const path = this.getAutomationPath(automation.id);
        yield* this.writeJsonFile(path, automation);
      }.bind(this),
    );
  }

  getAutomation(id: string): Effect.Effect<Automation, StorageError | StorageNotFoundError> {
    const path = this.getAutomationPath(id);
    return this.readJsonFile<Automation>(path);
  }

  listAutomations(): Effect.Effect<readonly Automation[], StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const dir = this.getAutomationsDir();
        const files = yield* this.listJsonFiles(dir);

        const automations: Automation[] = [];
        for (const file of files) {
          const path = `${dir}/${file}`;
          const automation = yield* this.readJsonFile<Automation>(path).pipe(
            Effect.catchAll(() => Effect.void), // Skip corrupted files
          );
          if (automation) {
            automations.push(automation);
          }
        }

        return automations;
      }.bind(this),
    );
  }

  deleteAutomation(id: string): Effect.Effect<void, StorageError | StorageNotFoundError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const path = this.getAutomationPath(id);
        yield* this.fs.remove(path).pipe(
          Effect.mapError((error) => {
            if (error instanceof Error && error.message.includes("ENOENT")) {
              return new StorageNotFoundError({ path });
            }
            return new StorageError({
              operation: "delete",
              path,
              reason: `Failed to delete file: ${String(error)}`,
            });
          }),
        );
      }.bind(this),
    );
  }

  saveTaskResult(result: TaskResult): Effect.Effect<void, StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const dir = this.getTaskResultsDir();
        yield* this.ensureDirectoryExists(dir);
        const path = this.getTaskResultsPath(result.taskId);

        // Read existing results, append new one, write back
        const existing = yield* this.readJsonFile<TaskResult[]>(path).pipe(
          Effect.catchAll(() => Effect.succeed([])),
        );
        const updated = [...existing, result];
        yield* this.writeJsonFile(path, updated);
      }.bind(this),
    );
  }

  getTaskResults(taskId: string): Effect.Effect<readonly TaskResult[], StorageError> {
    const path = this.getTaskResultsPath(taskId);
    return this.readJsonFile<TaskResult[]>(path).pipe(Effect.catchAll(() => Effect.succeed([])));
  }

  saveAgentResult(result: AgentResult): Effect.Effect<void, StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const dir = this.getAgentResultsDir();
        yield* this.ensureDirectoryExists(dir);
        const path = this.getAgentResultsPath(result.agentId);

        // Read existing results, append new one, write back
        const existing = yield* this.readJsonFile<AgentResult[]>(path).pipe(
          Effect.catchAll(() => Effect.succeed([])),
        );
        const updated = [...existing, result];
        yield* this.writeJsonFile(path, updated);
      }.bind(this),
    );
  }

  getAgentResults(agentId: string): Effect.Effect<readonly AgentResult[], StorageError> {
    const path = this.getAgentResultsPath(agentId);
    return this.readJsonFile<AgentResult[]>(path).pipe(Effect.catchAll(() => Effect.succeed([])));
  }
}

export function createFileStorageLayer(
  basePath: string,
): Layer.Layer<StorageService, never, FileSystem.FileSystem> {
  return Layer.effect(
    StorageServiceTag,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return new FileStorageService(basePath, fs);
    }),
  );
}
