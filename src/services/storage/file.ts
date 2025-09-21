import { FileSystem } from "@effect/platform";
import { Effect, Layer } from "effect";
import { StorageError, StorageNotFoundError } from "../../core/types/errors";
import type { Agent, AgentResult, Automation, TaskResult } from "../../core/types/index";
import { StorageServiceTag, type StorageService } from "./service";

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

  private readAgentFile(path: string): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
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

        const rawData = JSON.parse(content) as Agent & { createdAt: string; updatedAt: string };

        // Convert date strings back to Date objects
        const agent: Agent = {
          ...rawData,
          createdAt: new Date(rawData.createdAt),
          updatedAt: new Date(rawData.updatedAt),
        };

        return agent;
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
    return this.readAgentFile(path);
  }

  listAgents(): Effect.Effect<readonly Agent[], StorageError> {
    return Effect.gen(
      function* (this: FileStorageService) {
        const dir = this.getAgentsDir();
        const files = yield* this.listJsonFiles(dir);

        const agents: Agent[] = [];
        for (const file of files) {
          const path = `${dir}/${file}`;
          const agent = yield* this.readAgentFile(path).pipe(
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
            if (
              error instanceof Error &&
              (error as unknown as { cause: { code: string } }).cause.code.includes("ENOENT")
            ) {
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
            if (
              error instanceof Error &&
              (error as unknown as { cause: { code: string } }).cause.code.includes("ENOENT")
            ) {
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
