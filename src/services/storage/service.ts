import { Context, Effect } from "effect";
import type { Automation, TaskResult } from "../../core/types";

import type { Agent, AgentResult } from "../../core/types";

import type { StorageError, StorageNotFoundError } from "../../core/types/errors";

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

export const StorageServiceTag = Context.GenericTag<StorageService>("StorageService");

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
